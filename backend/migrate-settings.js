/**
 * One-time migration: SQLite CompanySettings → PostgreSQL
 *
 * Run from the backend directory:
 *   node migrate-settings.js
 *
 * Requirements:
 *   - .env must have valid PostgreSQL credentials (DB_HOST, DB_NAME, DB_USER, DB_PASSWORD)
 *   - akb_transport.sqlite must be in this directory (copy from old server if needed)
 *   - PostgreSQL database must already exist: psql -c "CREATE DATABASE akb_transport;"
 */

'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');

// ── helpers ────────────────────────────────────────────────────────────────

function step(msg) { process.stdout.write(`\n  ${msg} ... `); }
function ok(detail) { console.log(detail ? `✓  ${detail}` : '✓'); }
function fail(msg) { console.log(`✗\n\n  ERROR: ${msg}\n`); process.exit(1); }

// ── 1. Read SQLite ─────────────────────────────────────────────────────────

step('Reading SQLite database');
const sqlitePath = path.join(__dirname, 'akb_transport.sqlite');
let sqliteSettings = null;

try {
  const Database = require('better-sqlite3');
  const sqlite = new Database(sqlitePath, { readonly: true });
  sqliteSettings = sqlite.prepare('SELECT * FROM CompanySettings LIMIT 1').get();
  sqlite.close();
  ok(sqliteSettings ? `found settings for "${sqliteSettings.companyName}"` : 'no settings row (will use defaults)');
} catch (e) {
  if (e.code === 'ENOENT' || e.message?.includes('no such file')) {
    ok('sqlite file not found — will create fresh settings in PostgreSQL');
  } else {
    fail(`Could not read SQLite file: ${e.message}`);
  }
}

// ── 2. Connect to PostgreSQL (create DB if missing) ────────────────────────

step('Connecting to PostgreSQL');
const config = require('./src/config/database')[process.env.NODE_ENV || 'development'];

(async () => {
  // Connect to the default 'postgres' database first to create our DB if needed
  const admin = new Sequelize('postgres', config.username, config.password, {
    host: config.host,
    port: config.port || 5432,
    dialect: 'postgres',
    logging: false,
    dialectOptions: config.dialectOptions || {},
  });

  try {
    await admin.authenticate();
    const [[{ count }]] = await admin.query(
      `SELECT COUNT(*) AS count FROM pg_database WHERE datname = '${config.database}'`
    );
    if (parseInt(count, 10) === 0) {
      await admin.query(`CREATE DATABASE "${config.database}"`);
      console.log(`created database "${config.database}"`);
    }
    await admin.close();
  } catch (e) {
    fail(`Cannot connect to PostgreSQL: ${e.message}\n  Check DB_HOST, DB_USER, DB_PASSWORD in .env`);
  }

  const sequelize = new Sequelize(config.database, config.username, config.password, {
    ...config,
    logging: false,
  });

  try {
    await sequelize.authenticate();
    ok(`${config.database}@${config.host}`);
  } catch (e) {
    fail(`Cannot connect to database "${config.database}": ${e.message}`);
  }

  // ── 3. Sync schema (create all tables) ──────────────────────────────────

  step('Syncing schema (creating tables)');
  try {
    // Register all models so Sequelize knows the full schema
    const db = require('./src/models');
    await db.sequelize.sync({ alter: { drop: false } });
    ok('all tables created/verified');
  } catch (e) {
    fail(`Schema sync failed: ${e.message}`);
  }

  // ── 4. Migrate settings ────────────────────────────────────────────────

  step('Migrating CompanySettings');
  try {
    const { CompanySettings } = require('./src/models');
    const existing = await CompanySettings.findOne();

    if (existing) {
      console.log(`already exists ("${existing.companyName}") — skipping insert`);
    } else if (sqliteSettings) {
      const fieldsToMigrate = [
        'id', 'companyName', 'registrationNo', 'address', 'phone', 'email', 'website',
        'bankName', 'bankAccountNo', 'bankAccountName',
        'currency', 'currencySymbol', 'paymentTermsDays', 'signatoryName', 'logoText',
        'logoImage', 'sealImage', 'signatureImage',
      ];
      const row = {};
      for (const f of fieldsToMigrate) {
        if (sqliteSettings[f] !== undefined) row[f] = sqliteSettings[f] || null;
      }
      // Ensure currency defaults are set
      row.currency = row.currency || 'SGD';
      row.currencySymbol = row.currencySymbol || 'S$';
      row.paymentTermsDays = row.paymentTermsDays || 30;

      await CompanySettings.create(row);
      ok(`inserted "${row.companyName}"`);
    } else {
      await CompanySettings.create({ companyName: 'AKB Transport Pte Ltd' });
      ok('created default settings row — fill in details via Settings page');
    }
  } catch (e) {
    fail(`Settings migration failed: ${e.message}`);
  }

  // ── 5. Seed admin user ─────────────────────────────────────────────────

  step('Checking admin user');
  try {
    const { User } = require('./src/models');
    const { v4: uuidv4 } = require('uuid');
    const bcrypt = require('bcryptjs');

    const count = await User.count();
    if (count > 0) {
      ok(`${count} user(s) already exist — skipping seed`);
    } else {
      const adminPass = process.env.ADMIN_PASSWORD || 'Admin@AKB2026';
      await User.create({
        id: uuidv4(),
        name: 'AK.BALAN',
        username: 'admin',
        passwordHash: await bcrypt.hash(adminPass, 12),
        role: 'admin',
        phone: '+6584590123',
        isActive: true,
      });
      ok(`admin user created — login with username: admin`);
      if (!process.env.ADMIN_PASSWORD) {
        console.log('\n  ⚠️  Default password used. Change it immediately after first login.');
      }
    }
  } catch (e) {
    fail(`Admin seed failed: ${e.message}`);
  }

  console.log('\n  ✅  Migration complete. You can now start the app: pm2 start ecosystem.config.js --env production\n');
  process.exit(0);
})();
