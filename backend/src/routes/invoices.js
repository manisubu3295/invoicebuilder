const router = require('express').Router();
const fs = require('fs');
const { Op } = require('sequelize');
const { Invoice, InvoiceItem, Client, Payment, CompanySettings, DeliveryLog, Job, Driver, Vehicle, User, Quotation, Category, ItemCatalog } = require('../models');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const { createInvoiceWithNumber, generateInvoiceNumber } = require('../services/invoiceNumber');
const { generateInvoicePDF } = require('../services/pdfService');
const { sendInvoiceEmail } = require('../services/emailService');
const { isTestModeEnabled } = require('../services/testMode');
const { findInvalidCatalogItem } = require('../services/catalogValidation');

router.use(auth);

const num = (v) => (v === '' || v === null || v === undefined) ? null : parseFloat(v);

// Item Amount Matrix format needs each item's current catalog price — only
// fetched when actually needed (invoice.itemAmountMatrix), not on every PDF/
// email request.
async function buildCatalogPriceMap() {
  const cat = await ItemCatalog.findAll({ attributes: ['name', 'unitPrice'] });
  return new Map(cat.map(c => [c.name.trim().toLowerCase(), parseFloat(c.unitPrice)]));
}

router.get('/', async (req, res) => {
  try {
    const { status, clientId, driverId, vehicleId, fromDate, toDate } = req.query;
    const where = { isTest: isTestModeEnabled() };
    if (status) where.status = status;
    if (clientId) where.clientId = clientId;
    if (fromDate || toDate) {
      where.date = {};
      if (fromDate) where.date[Op.gte] = fromDate;
      if (toDate) where.date[Op.lte] = toDate;
    }

    const jobInclude = {
      model: Job,
      as: 'job',
      attributes: ['id', 'driverId', 'vehicleId'],
      include: [
        { model: Driver, as: 'driver', include: [{ model: User, as: 'user', attributes: ['name'] }] },
        { model: Vehicle, as: 'vehicle', attributes: ['plateNumber', 'type'] },
      ],
    };

    let invoices = await Invoice.findAll({
      where,
      include: [
        { model: Client, as: 'client', attributes: ['id', 'companyName', 'clientCode', 'email'] },
        { model: Category, as: 'category', attributes: ['id', 'name', 'invoicePrefix'] },
        { model: InvoiceItem, as: 'items' },
        jobInclude,
      ],
      order: [['createdAt', 'DESC']],
    });

    // Filter by driverId/vehicleId (via linked job)
    if (driverId) invoices = invoices.filter(inv => inv.job?.driverId === driverId);
    if (vehicleId) invoices = invoices.filter(inv => inv.job?.vehicleId === vehicleId);

    res.json(invoices);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/next-number', async (req, res) => {
  try {
    const nextNumber = await generateInvoiceNumber(req.query.clientId || null, isTestModeEnabled(), req.query.categoryId || null);
    res.json({ nextNumber });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      where: { id: req.params.id, isTest: isTestModeEnabled() },
      include: [
        { model: Client, as: 'client' },
        { model: Category, as: 'category', attributes: ['id', 'name', 'invoicePrefix'] },
        { model: InvoiceItem, as: 'items' },
        { model: Payment, as: 'payments' },
      ],
    });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', rbac('admin', 'staff'), async (req, res) => {
  try {
    const { clientId, date, dueDate, items, notes, quotationId, jobId, categoryId } = req.body;
    if (!clientId || !date || !items?.length) {
      return res.status(400).json({ message: 'clientId, date, and items are required' });
    }
    if (!categoryId) return res.status(400).json({ message: 'Category is required' });

    const catalogErr = await findInvalidCatalogItem(items, { nameField: 'jobDescription', deliveryOnly: true });
    if (catalogErr) return res.status(400).json({ message: catalogErr });

    let quotation = null;
    if (quotationId) {
      quotation = await Quotation.findOne({ where: { id: quotationId, isTest: isTestModeEnabled() } });
      if (!quotation) return res.status(404).json({ message: 'Quotation not found' });
      if (quotation.status === 'converted') return res.status(400).json({ message: 'This quotation has already been converted to an invoice' });
    }

    const totalAmount = items.reduce((sum, i) => sum + parseFloat(i.totalAmount || 0), 0);

    const invoice = await createInvoiceWithNumber(clientId, {
      date, dueDate: dueDate || null, notes, quotationId: quotationId || null, jobId, totalAmount, status: 'draft', categoryId,
      bulkRunSheet: !!req.body.bulkRunSheet,
      itemMatrix: !!req.body.itemMatrix,
      itemAmountMatrix: !!req.body.itemAmountMatrix,
    });

    const invoiceItems = items.map((item, idx) => {
      const dates = Array.isArray(item.deliveryDates) ? item.deliveryDates : [];
      return {
        invoiceId: invoice.id,
        sno: item.sno || idx + 1,
        jobDescription: item.jobDescription,
        itemType: item.itemType || 'service',
        fromDate: item.fromDate || null,
        toDate: item.toDate || null,
        rate: num(item.rate),
        rateType: item.rateType || 'per_week',
        deliveryDate: dates[0] || item.deliveryDate || null,
        deliveryDates: dates.length ? JSON.stringify(dates) : null,
        quantity: num(item.quantity),
        unitPrice: num(item.unitPrice),
        totalAmount: num(item.totalAmount),
        runSheetNo: item.runSheetNo || null,
        notes: item.notes || null,
      };
    });
    await InvoiceItem.bulkCreate(invoiceItems);

    if (quotation) await quotation.update({ status: 'converted' });

    const full = await Invoice.findByPk(invoice.id, {
      include: [{ model: Client, as: 'client' }, { model: InvoiceItem, as: 'items' }],
    });
    res.status(201).json(full);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', rbac('admin', 'staff'), async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      where: { id: req.params.id, isTest: isTestModeEnabled() },
      include: [{ model: InvoiceItem, as: 'items' }],
    });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    const { date, dueDate, notes, items, status, bulkRunSheet, itemMatrix, itemAmountMatrix } = req.body;

    if (items) {
      const catalogErr = await findInvalidCatalogItem(items, { nameField: 'jobDescription', deliveryOnly: true });
      if (catalogErr) return res.status(400).json({ message: catalogErr });
    }

    // Only touch fields actually present in the request — this route also
    // serves narrow updates like toggling bulkRunSheet/itemMatrix alone, and
    // blindly passing every destructured field (most of them undefined)
    // would wipe date/dueDate/notes/status via Sequelize treating
    // `undefined` as "set this field", and the `|| null` fallbacks turn a
    // missing dueDate into an explicit null.
    const fields = {};
    if (date !== undefined) fields.date = date;
    if (dueDate !== undefined) fields.dueDate = dueDate || null;
    if (notes !== undefined) fields.notes = notes;
    if (status !== undefined) fields.status = status;
    if (bulkRunSheet !== undefined) fields.bulkRunSheet = !!bulkRunSheet;
    if (itemMatrix !== undefined) fields.itemMatrix = !!itemMatrix;
    if (itemAmountMatrix !== undefined) fields.itemAmountMatrix = !!itemAmountMatrix;

    if (items) {
      await InvoiceItem.destroy({ where: { invoiceId: invoice.id } });
      fields.totalAmount = items.reduce((sum, i) => sum + parseFloat(i.totalAmount || 0), 0);
      const invoiceItems = items.map((item, idx) => {
        const dates = Array.isArray(item.deliveryDates) ? item.deliveryDates : [];
        return {
          invoiceId: invoice.id,
          sno: item.sno || idx + 1,
          jobDescription: item.jobDescription,
          itemType: item.itemType || 'service',
          fromDate: item.fromDate || null,
          toDate: item.toDate || null,
          rate: num(item.rate),
          rateType: item.rateType || 'per_week',
          deliveryDate: dates[0] || item.deliveryDate || null,
          deliveryDates: dates.length ? JSON.stringify(dates) : null,
          quantity: num(item.quantity),
          unitPrice: num(item.unitPrice),
          totalAmount: num(item.totalAmount),
          runSheetNo: item.runSheetNo || null,
          notes: item.notes || null,
        };
      });
      await InvoiceItem.bulkCreate(invoiceItems);
    }
    if (Object.keys(fields).length) await invoice.update(fields);

    const full = await Invoice.findByPk(invoice.id, {
      include: [{ model: Client, as: 'client' }, { model: InvoiceItem, as: 'items' }],
    });
    res.json(full);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id/pdf', async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      where: { id: req.params.id, isTest: isTestModeEnabled() },
      include: [{ model: Client, as: 'client' }, { model: InvoiceItem, as: 'items' }, { model: Payment, as: 'payments' }],
    });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    const settings = await CompanySettings.findOne() || {};
    const catalogPriceMap = invoice.itemAmountMatrix ? await buildCatalogPriceMap() : null;
    const pdfPath = await generateInvoicePDF(invoice, invoice.client, invoice.items, settings, catalogPriceMap);
    await invoice.update({ pdfPath });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Invoice-${invoice.invoiceNo.replace(/\//g, '-')}.pdf"`);
    fs.createReadStream(pdfPath).pipe(res);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/send-email', rbac('admin', 'staff'), async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      where: { id: req.params.id, isTest: isTestModeEnabled() },
      include: [{ model: Client, as: 'client' }, { model: InvoiceItem, as: 'items' }, { model: Payment, as: 'payments' }],
    });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    if (!invoice.client.email) return res.status(400).json({ message: 'Client has no email address' });

    const settings = await CompanySettings.findOne() || {};
    const catalogPriceMap = invoice.itemAmountMatrix ? await buildCatalogPriceMap() : null;
    const pdfPath = await generateInvoicePDF(invoice, invoice.client, invoice.items, settings, catalogPriceMap);
    await invoice.update({ pdfPath });

    await sendInvoiceEmail({
      to: invoice.client.email,
      clientName: invoice.client.contactPerson || invoice.client.companyName,
      invoiceNo: invoice.invoiceNo,
      pdfPath,
      settings: settings?.dataValues || settings || {},
    });

    await invoice.update({ status: 'sent', emailSentAt: new Date() });
    res.json({ message: 'Invoice emailed successfully', emailSentAt: invoice.emailSentAt });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/invoices/from-deliveries — create delivery-type invoice from preview rows
router.post('/from-deliveries', rbac('admin', 'staff'), async (req, res) => {
  try {
    const { clientId, date, dueDate, periodStart, periodEnd, notes, rows, categoryId } = req.body;
    if (!clientId || !date || !rows?.length || !periodStart || !periodEnd) {
      return res.status(400).json({ message: 'clientId, date, periodStart, periodEnd, and rows are required' });
    }
    if (!categoryId) return res.status(400).json({ message: 'Category is required' });

    const totalAmount = rows.reduce((sum, r) => sum + parseFloat(r.totalAmount || 0), 0);

    const invoice = await createInvoiceWithNumber(clientId, {
      date, dueDate: dueDate || null, notes,
      totalAmount, status: 'draft',
      invoiceType: 'delivery',
      periodStart, periodEnd, categoryId,
      bulkRunSheet: !!req.body.bulkRunSheet,
      itemMatrix: !!req.body.itemMatrix,
      itemAmountMatrix: !!req.body.itemAmountMatrix,
    });

    const invoiceItems = rows.map((row, idx) => ({
      invoiceId: invoice.id,
      sno: idx + 1,
      jobDescription: row.itemName,
      fromDate: row.deliveryDate,
      toDate: row.deliveryDate,
      rate: parseFloat(row.unitPrice || 0),
      rateType: 'per_unit',
      quantity: parseFloat(row.quantity || 0),
      totalAmount: parseFloat(row.totalAmount || 0),
      deliveryLogId: row.deliveryLogId,
      deliveredBy: row.deliveredBy,
      runSheetNo: row.runSheetNo || null,
      notes: row.notes || null,
    }));
    await InvoiceItem.bulkCreate(invoiceItems);

    // Mark all delivery logs covered by these rows as invoiced
    const logIds = [...new Set(rows.map(r => r.deliveryLogId).filter(Boolean))];
    if (logIds.length) {
      await DeliveryLog.update({ status: 'invoiced' }, { where: { id: logIds } });
    }

    const full = await Invoice.findByPk(invoice.id, {
      include: [{ model: Client, as: 'client' }, { model: InvoiceItem, as: 'items' }],
    });
    res.status(201).json(full);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id/number', rbac('admin'), async (req, res) => {
  try {
    const newNo = (req.body.invoiceNo || '').trim();
    if (!newNo) return res.status(400).json({ message: 'Invoice number is required' });

    const conflict = await Invoice.findOne({ where: { invoiceNo: newNo, isTest: isTestModeEnabled() } });
    if (conflict && conflict.id !== req.params.id) {
      return res.status(409).json({ message: `Invoice number "${newNo}" is already used by another invoice` });
    }

    const invoice = await Invoice.findOne({ where: { id: req.params.id, isTest: isTestModeEnabled() } });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    await invoice.update({ invoiceNo: newNo });
    res.json({ invoiceNo: invoice.invoiceNo });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Soft delete — cancels the invoice without removing it, keeping it in reports/history.
router.post('/:id/cancel', rbac('admin', 'staff'), async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ where: { id: req.params.id, isTest: isTestModeEnabled() } });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    if (invoice.status === 'cancelled') return res.status(400).json({ message: 'Invoice is already cancelled' });
    await invoice.update({ status: 'cancelled' });
    res.json({ message: 'Invoice cancelled' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Hard delete — permanently removes the invoice, including any recorded
// payments against it. Admin-only, and only for draft/cancelled invoices
// (cancel it first). Deleting a paid invoice destroys its payment history
// with no way to recover it — there is no confirmation beyond the
// frontend's dialog, so treat this as a last resort, not routine cleanup.
router.delete('/:id', rbac('admin'), async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ where: { id: req.params.id, isTest: isTestModeEnabled() } });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    if (!['draft', 'cancelled'].includes(invoice.status)) {
      return res.status(400).json({ message: 'Only draft or cancelled invoices can be permanently deleted — cancel it first' });
    }
    await Payment.destroy({ where: { invoiceId: invoice.id } });
    await InvoiceItem.destroy({ where: { invoiceId: invoice.id } });
    await invoice.destroy();
    res.json({ message: 'Invoice permanently deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/mark-sent', rbac('admin', 'staff'), async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ where: { id: req.params.id, isTest: isTestModeEnabled() } });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    if (invoice.status !== 'draft') return res.status(400).json({ message: 'Only draft invoices can be marked as sent' });
    await invoice.update({ status: 'sent' });
    res.json({ message: 'Invoice marked as sent' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/mark-paid', rbac('admin'), async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ where: { id: req.params.id, isTest: isTestModeEnabled() } });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    const { amount, paymentDate, method, reference, notes } = req.body;
    await Payment.create({
      invoiceId: invoice.id,
      amount: amount || invoice.totalAmount,
      paymentDate: paymentDate || new Date(),
      method, reference, notes,
    });

    await invoice.update({ status: 'paid', paidDate: paymentDate || new Date() });
    res.json({ message: 'Invoice marked as paid' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
