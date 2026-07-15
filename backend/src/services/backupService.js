// Daily PostgreSQL backups via pg_dump, written as gzipped SQL into
// backend/backups/ (gitignored — contains real client data).
// Runs every day at BACKUP_HOUR (default 2 AM server time), plus a catch-up
// at startup if the newest backup is older than 24h (covers servers that were
// off at the scheduled time). Old backups beyond BACKUP_RETENTION_DAYS are
// deleted — only files matching db-*.sql.gz; anything else in the folder is safe.
//
// Can also be run manually: node src/services/backupService.js
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { pipeline } = require('stream');
const logger = require('../config/logger');

const env = process.env.NODE_ENV || 'development';
const dbConfig = require('../config/database')[env];

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '../../backups');
const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10);
const BACKUP_HOUR = parseInt(process.env.BACKUP_HOUR || '2', 10); // 24h clock, server-local time
const PG_DUMP = process.env.PG_DUMP_PATH || 'pg_dump';
const BACKUP_FILE_RE = /^db-.*\.sql\.gz$/;

function runPgDump() {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const stamp = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '');
    const filePath = path.join(BACKUP_DIR, `db-${stamp}.sql.gz`);

    const dump = spawn(PG_DUMP, [
      '-h', dbConfig.host,
      '-p', String(dbConfig.port),
      '-U', dbConfig.username,
      '-d', dbConfig.database,
      '--no-owner', '--no-acl',
    ], {
      env: {
        ...process.env,
        PGPASSWORD: dbConfig.password,
        ...(process.env.DB_SSL === 'true' ? { PGSSLMODE: 'require' } : {}),
      },
    });

    let stderr = '';
    dump.stderr.on('data', (d) => { stderr += d; });

    let settled = false;
    const fail = (message) => {
      if (settled) return;
      settled = true;
      fs.rm(filePath, { force: true }, () => {});
      reject(new Error(message));
    };

    // Resolve only when BOTH the process exited cleanly and the file is fully written
    let exitCode = null;
    let fileDone = false;
    const maybeResolve = () => {
      if (settled || exitCode !== 0 || !fileDone) return;
      settled = true;
      resolve(filePath);
    };

    dump.on('error', (err) =>
      fail(`pg_dump could not start (is the PostgreSQL client installed and on PATH? set PG_DUMP_PATH otherwise): ${err.message}`));
    dump.on('close', (code) => {
      exitCode = code;
      if (code !== 0) return fail(`pg_dump exited with code ${code}: ${stderr.trim()}`);
      maybeResolve();
    });

    pipeline(dump.stdout, zlib.createGzip(), fs.createWriteStream(filePath), (err) => {
      if (err) return fail(`Failed writing backup file: ${err.message}`);
      fileDone = true;
      maybeResolve();
    });
  });
}

function cleanOldBackups() {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 3600 * 1000;
  let names = [];
  try { names = fs.readdirSync(BACKUP_DIR); } catch { return; }
  for (const name of names) {
    if (!BACKUP_FILE_RE.test(name)) continue;
    const full = path.join(BACKUP_DIR, name);
    try {
      if (fs.statSync(full).mtimeMs < cutoff) {
        fs.unlinkSync(full);
        logger.info('Deleted old DB backup past retention', { file: name, retentionDays: RETENTION_DAYS });
      }
    } catch { /* file vanished or unreadable — skip */ }
  }
}

function latestBackupAgeMs() {
  try {
    const times = fs.readdirSync(BACKUP_DIR)
      .filter((n) => BACKUP_FILE_RE.test(n))
      .map((n) => fs.statSync(path.join(BACKUP_DIR, n)).mtimeMs);
    return times.length ? Date.now() - Math.max(...times) : Infinity;
  } catch {
    return Infinity;
  }
}

async function backupNow(trigger) {
  try {
    const file = await runPgDump();
    const { size } = fs.statSync(file);
    logger.info('Database backup completed', {
      file: path.basename(file),
      dir: BACKUP_DIR,
      sizeKB: Math.round(size / 1024),
      trigger,
    });
    cleanOldBackups();
    return true;
  } catch (err) {
    logger.error('Database backup FAILED', { message: err.message, trigger });
    return false;
  }
}

function msUntilNextRun() {
  const next = new Date();
  next.setHours(BACKUP_HOUR, 0, 0, 0);
  if (next <= new Date()) next.setDate(next.getDate() + 1);
  return next - new Date();
}

function scheduleDailyBackups() {
  if (process.env.BACKUP_ENABLED === 'false') {
    logger.info('Daily DB backups disabled (BACKUP_ENABLED=false)');
    return;
  }

  if (latestBackupAgeMs() > 24 * 3600 * 1000) backupNow('startup catch-up');

  const scheduleNext = () => {
    const ms = msUntilNextRun();
    logger.info('Next daily DB backup scheduled', {
      inHours: Math.round(ms / 3600000 * 10) / 10,
      hourLocal: BACKUP_HOUR,
      dir: BACKUP_DIR,
    });
    setTimeout(async () => {
      await backupNow('daily schedule');
      scheduleNext();
    }, ms);
  };
  scheduleNext();
}

module.exports = { scheduleDailyBackups, backupNow };

if (require.main === module) {
  backupNow('manual').then((ok) => process.exit(ok ? 0 : 1));
}
