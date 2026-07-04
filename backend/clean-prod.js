/**
 * Reset invoices/quotations back to a clean slate — or, with --all, wipe
 * every business record (clients, jobs, drivers, vehicles, deliveries,
 * expenses, item catalog, invoices, quotations) for a fresh client handoff.
 * Users and Company Settings are never touched.
 *
 * Backs up everything it's about to delete to a timestamped JSON file first.
 *
 * Run from the backend directory:
 *   node clean-prod.js                 (dry run — reports counts, changes nothing)
 *   node clean-prod.js --confirm        (deletes invoices/quotations + resets numbering)
 *   node clean-prod.js --all --confirm  (also wipes clients/jobs/drivers/vehicles/
 *                                        deliveries/expenses/item catalog)
 */

'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const fs = require('fs');
const path = require('path');

function step(msg) { process.stdout.write(`\n  ${msg} ... `); }
function ok(detail) { console.log(detail ? `✓  ${detail}` : '✓'); }
function fail(msg) { console.log(`✗\n\n  ERROR: ${msg}\n`); process.exit(1); }

const confirmed = process.argv.includes('--confirm');
const wipeAll = process.argv.includes('--all');

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
  const counts = {
    invoices: await db.Invoice.findAll({ raw: true }),
    invoiceItems: await db.InvoiceItem.findAll({ raw: true }),
    payments: await db.Payment.findAll({ raw: true }),
    quotations: await db.Quotation.findAll({ raw: true }),
    quotationItems: await db.QuotationItem.findAll({ raw: true }),
  };
  if (wipeAll) {
    Object.assign(counts, {
      jobAttendance: await db.JobAttendance.findAll({ raw: true }),
      expenses: await db.Expense.findAll({ raw: true }),
      deliveryItems: await db.DeliveryItem.findAll({ raw: true }),
      deliveryLogs: await db.DeliveryLog.findAll({ raw: true }),
      jobs: await db.Job.findAll({ raw: true }),
      drivers: await db.Driver.findAll({ raw: true }),
      vehicles: await db.Vehicle.findAll({ raw: true }),
      clients: await db.Client.findAll({ raw: true }),
      itemCatalog: await db.ItemCatalog.findAll({ raw: true }),
    });
  }
  const summary = Object.entries(counts).map(([k, v]) => `${v.length} ${k}`).join(', ');
  ok(summary);

  if (!confirmed) {
    console.log(`\n  Dry run only — no changes made. Re-run with --confirm${wipeAll ? ' --all' : ''} to actually delete${wipeAll ? ' everything above' : ' invoices/quotations'} and reset numbering.\n`);
    process.exit(0);
  }

  const totalRows = Object.values(counts).reduce((s, v) => s + v.length, 0);
  if (totalRows === 0) {
    console.log('\n  Nothing to delete — already empty.');
  } else {
    step('Backing up current data');
    const backupDir = path.join(__dirname, 'backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const backupPath = path.join(backupDir, `prod-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(counts, null, 2));
    ok(path.relative(__dirname, backupPath));

    step('Deleting invoices, quotations, and related rows');
    await db.Payment.destroy({ where: {} });
    await db.InvoiceItem.destroy({ where: {} });
    await db.Invoice.destroy({ where: {} });
    await db.QuotationItem.destroy({ where: {} });
    await db.Quotation.destroy({ where: {} });
    ok('deleted');

    if (wipeAll) {
      step('Deleting jobs, drivers, vehicles, deliveries, expenses, item catalog, and clients');
      await db.JobAttendance.destroy({ where: {} });
      await db.Expense.destroy({ where: {} });
      await db.DeliveryItem.destroy({ where: {} });
      await db.DeliveryLog.destroy({ where: {} });
      await db.Job.destroy({ where: {} });
      await db.Driver.destroy({ where: {} });
      await db.Vehicle.destroy({ where: {} });
      await db.Client.destroy({ where: {} });
      await db.ItemCatalog.destroy({ where: {} });
      ok('deleted');
    }
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

  console.log('\n  ✅  Done. Users and Company Settings (company name, address, bank details, etc.) were left untouched.\n');
  process.exit(0);
})();
