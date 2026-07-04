/**
 * Reset invoices/quotations back to a clean slate.
 *
 * Deletes ALL Invoice/Quotation rows (test and real alike) and resets the
 * document-numbering settings back to defaults. Backs up everything it's
 * about to delete to a timestamped JSON file first.
 *
 * Run from the backend directory:
 *   node clean-prod.js            (dry run — reports counts, changes nothing)
 *   node clean-prod.js --confirm  (actually deletes + resets)
 */

'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const fs = require('fs');
const path = require('path');

function step(msg) { process.stdout.write(`\n  ${msg} ... `); }
function ok(detail) { console.log(detail ? `✓  ${detail}` : '✓'); }
function fail(msg) { console.log(`✗\n\n  ERROR: ${msg}\n`); process.exit(1); }

const confirmed = process.argv.includes('--confirm');

(async () => {
  const db = require('./src/models');

  step('Connecting to PostgreSQL');
  try {
    await db.sequelize.authenticate();
    ok(`${db.sequelize.config.database}@${db.sequelize.config.host}`);
  } catch (e) {
    fail(`Cannot connect: ${e.message}`);
  }

  step('Counting current rows');
  const [invoices, invoiceItems, payments, quotations, quotationItems] = await Promise.all([
    db.Invoice.findAll({ raw: true }),
    db.InvoiceItem.findAll({ raw: true }),
    db.Payment.findAll({ raw: true }),
    db.Quotation.findAll({ raw: true }),
    db.QuotationItem.findAll({ raw: true }),
  ]);
  ok(`${invoices.length} invoices, ${invoiceItems.length} invoice items, ${payments.length} payments, ${quotations.length} quotations, ${quotationItems.length} quotation items`);

  if (!confirmed) {
    console.log('\n  Dry run only — no changes made. Re-run with --confirm to actually delete and reset.\n');
    process.exit(0);
  }

  if (invoices.length + quotations.length === 0) {
    console.log('\n  Nothing to delete — invoices and quotations are already empty.');
  } else {
    step('Backing up current data');
    const backupDir = path.join(__dirname, 'backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const backupPath = path.join(backupDir, `prod-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(backupPath, JSON.stringify({ invoices, invoiceItems, payments, quotations, quotationItems }, null, 2));
    ok(path.relative(__dirname, backupPath));

    step('Deleting invoices, quotations, and related rows');
    await db.Payment.destroy({ where: {} });
    await db.InvoiceItem.destroy({ where: {} });
    await db.Invoice.destroy({ where: {} });
    await db.QuotationItem.destroy({ where: {} });
    await db.Quotation.destroy({ where: {} });
    ok('deleted');
  }

  step('Resetting document numbering settings');
  const settings = await db.CompanySettings.findOne();
  if (settings) {
    await settings.update({
      invoicePrefix: 'INV',
      invoiceStartNumber: 1,
      quotationPrefix: 'QUO',
      quotationStartNumber: 1,
      testModeEnabled: false,
    });
    ok('invoicePrefix=INV, quotationPrefix=QUO, start numbers=1, testModeEnabled=false');
  } else {
    ok('no settings row found — nothing to reset');
  }

  console.log('\n  ✅  Done.\n');
  process.exit(0);
})();
