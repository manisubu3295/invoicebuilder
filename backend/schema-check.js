'use strict';
/**
 * Schema Check & Repair
 *
 * Compares the Sequelize model definitions (source of truth) against
 * the live PostgreSQL database and reports missing tables / columns.
 * Then runs ALTER TABLE / CREATE TABLE via Sequelize sync to fix them.
 *
 * Run from repo root:
 *   node backend/schema-check.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

function header(msg) { console.log(`\n${'─'.repeat(60)}\n  ${msg}\n${'─'.repeat(60)}`); }
function ok(msg)     { console.log(`  ✓  ${msg}`); }
function warn(msg)   { console.log(`  ⚠  ${msg}`); }
function fixed(msg)  { console.log(`  ✅ ${msg}`); }
function info(msg)   { console.log(`  ℹ  ${msg}`); }

(async () => {
  // ── 1. Load models (connects to PostgreSQL via .env) ──────────────────────
  header('Loading Sequelize models');
  const db = require('./src/models');
  try {
    await db.sequelize.authenticate();
    const cfg = db.sequelize.config;
    ok(`Connected to ${cfg.database}@${cfg.host}:${cfg.port || 5432}`);
  } catch (e) {
    console.error(`  ✗  Cannot connect: ${e.message}`);
    process.exit(1);
  }

  // ── 2. Read current PostgreSQL schema ─────────────────────────────────────
  header('Reading current PostgreSQL schema');
  const [pgTableRows] = await db.sequelize.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  const pgTableNames = new Set(pgTableRows.map(r => r.table_name));
  info(`Found ${pgTableNames.size} table(s) in PostgreSQL: ${[...pgTableNames].join(', ')}`);

  // Fetch column names per table
  const pgColumns = {}; // tableName → Set<columnName>
  for (const tbl of pgTableNames) {
    const [cols] = await db.sequelize.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
    `, { bind: [tbl] });
    pgColumns[tbl] = new Set(cols.map(c => c.column_name));
  }

  // ── 3. Compare models vs PostgreSQL ───────────────────────────────────────
  header('Comparing model definitions vs PostgreSQL');

  const missingTables  = [];
  const missingColumns = []; // { table, column }

  const modelEntries = Object.entries(db).filter(([, v]) => v?.getTableName);

  for (const [modelName, model] of modelEntries) {
    const tableName = typeof model.getTableName === 'function'
      ? model.getTableName()
      : model.tableName;

    if (!pgTableNames.has(tableName)) {
      missingTables.push({ modelName, tableName });
      warn(`MISSING TABLE  "${tableName}"  (model: ${modelName})`);
      continue;
    }

    // Compare columns
    const rawAttrs = model.rawAttributes || {};
    for (const [attrName, attr] of Object.entries(rawAttrs)) {
      // Sequelize may map camelCase attr to a different DB field via attr.field
      const dbColName = attr.field || attrName;
      if (!pgColumns[tableName].has(dbColName)) {
        missingColumns.push({ modelName, tableName, attrName, dbColName });
        warn(`MISSING COLUMN "${tableName}"."${dbColName}"  (model attr: ${modelName}.${attrName})`);
      }
    }

    if (![...Object.entries(model.rawAttributes || {})].some(([a, at]) => {
      const col = at.field || a;
      return !pgColumns[tableName].has(col);
    })) {
      ok(`"${tableName}" — all columns present`);
    }
  }

  // ── 4. Summary before fix ──────────────────────────────────────────────────
  header('Summary');
  if (missingTables.length === 0 && missingColumns.length === 0) {
    ok('Schema is fully in sync — nothing to fix.');
    await db.sequelize.close();
    process.exit(0);
  }

  if (missingTables.length)  warn(`${missingTables.length} missing table(s)`);
  if (missingColumns.length) warn(`${missingColumns.length} missing column(s)`);

  // ── 5. Auto-fix via Sequelize sync ────────────────────────────────────────
  header('Fixing: running sequelize.sync({ alter: { drop: false } })');
  info('This will CREATE missing tables and ADD missing columns.');
  info('Existing data is safe — no columns or tables will be dropped.');
  try {
    await db.sequelize.sync({ alter: { drop: false } });
    fixed('Sync complete.');
  } catch (e) {
    console.error(`  ✗  Sync failed: ${e.message}`);
    await db.sequelize.close();
    process.exit(1);
  }

  // ── 6. Verify the fix ─────────────────────────────────────────────────────
  header('Verifying fix');
  let allGood = true;

  for (const { tableName } of missingTables) {
    const [rows] = await db.sequelize.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name=$1
    `, { bind: [tableName] });
    if (rows.length) { fixed(`Table "${tableName}" now exists.`); }
    else             { warn(`Table "${tableName}" STILL missing — check model definition.`); allGood = false; }
  }

  for (const { tableName, dbColName } of missingColumns) {
    const [rows] = await db.sequelize.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=$1 AND column_name=$2
    `, { bind: [tableName, dbColName] });
    if (rows.length) { fixed(`Column "${tableName}"."${dbColName}" now exists.`); }
    else             { warn(`Column "${tableName}"."${dbColName}" STILL missing — check model definition.`); allGood = false; }
  }

  header(allGood ? '✅  All issues resolved.' : '⚠️   Some issues remain — see warnings above.');
  await db.sequelize.close();
  process.exit(allGood ? 0 : 1);
})();
