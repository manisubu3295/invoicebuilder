const router = require('express').Router();
const fs = require('fs');
const { Op } = require('sequelize');
const { Invoice, InvoiceItem, Client, Payment, CompanySettings, DeliveryLog, Job, Driver, Vehicle, User } = require('../models');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const { generateInvoiceNumber } = require('../services/invoiceNumber');
const { generateInvoicePDF } = require('../services/pdfService');
const { sendInvoiceEmail } = require('../services/emailService');

router.use(auth);

router.get('/', async (req, res) => {
  try {
    const { status, clientId, driverId, vehicleId, fromDate, toDate } = req.query;
    const where = {};
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

router.get('/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findByPk(req.params.id, {
      include: [
        { model: Client, as: 'client' },
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
    const { clientId, date, dueDate, items, notes, quotationId, jobId } = req.body;
    if (!clientId || !date || !items?.length) {
      return res.status(400).json({ message: 'clientId, date, and items are required' });
    }

    const invoiceNo = await generateInvoiceNumber(clientId);
    const totalAmount = items.reduce((sum, i) => sum + parseFloat(i.totalAmount || 0), 0);

    const invoice = await Invoice.create({
      invoiceNo, clientId, date, dueDate, notes, quotationId, jobId,
      totalAmount, status: 'draft',
    });

    const invoiceItems = items.map((item, idx) => ({
      invoiceId: invoice.id,
      sno: item.sno || idx + 1,
      jobDescription: item.jobDescription,
      itemType: item.itemType || 'service',
      fromDate: item.fromDate,
      toDate: item.toDate,
      rate: item.rate,
      rateType: item.rateType || 'per_week',
      deliveryDate: item.deliveryDate,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalAmount: item.totalAmount,
    }));
    await InvoiceItem.bulkCreate(invoiceItems);

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
    const invoice = await Invoice.findByPk(req.params.id, {
      include: [{ model: InvoiceItem, as: 'items' }],
    });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    const { date, dueDate, notes, items, status } = req.body;

    if (items) {
      await InvoiceItem.destroy({ where: { invoiceId: invoice.id } });
      const totalAmount = items.reduce((sum, i) => sum + parseFloat(i.totalAmount || 0), 0);
      const invoiceItems = items.map((item, idx) => ({
        invoiceId: invoice.id,
        sno: item.sno || idx + 1,
        jobDescription: item.jobDescription,
        itemType: item.itemType || 'service',
        fromDate: item.fromDate,
        toDate: item.toDate,
        rate: item.rate,
        rateType: item.rateType || 'per_week',
        deliveryDate: item.deliveryDate,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalAmount: item.totalAmount,
      }));
      await InvoiceItem.bulkCreate(invoiceItems);
      await invoice.update({ date, dueDate, notes, status, totalAmount });
    } else {
      await invoice.update({ date, dueDate, notes, status });
    }

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
    const invoice = await Invoice.findByPk(req.params.id, {
      include: [{ model: Client, as: 'client' }, { model: InvoiceItem, as: 'items' }],
    });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    const settings = await CompanySettings.findOne() || {};
    const pdfPath = await generateInvoicePDF(invoice, invoice.client, invoice.items, settings);
    await invoice.update({ pdfPath });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Invoice-${invoice.invoiceNo.replace(/\//g, '-')}.pdf"`);
    fs.createReadStream(pdfPath).pipe(res);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/send-email', rbac('admin', 'staff'), async (req, res) => {
  try {
    const invoice = await Invoice.findByPk(req.params.id, {
      include: [{ model: Client, as: 'client' }, { model: InvoiceItem, as: 'items' }],
    });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    if (!invoice.client.email) return res.status(400).json({ message: 'Client has no email address' });

    const settings = await CompanySettings.findOne() || {};
    const pdfPath = await generateInvoicePDF(invoice, invoice.client, invoice.items, settings);
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
    const { clientId, date, dueDate, periodStart, periodEnd, notes, rows } = req.body;
    if (!clientId || !date || !rows?.length || !periodStart || !periodEnd) {
      return res.status(400).json({ message: 'clientId, date, periodStart, periodEnd, and rows are required' });
    }

    const invoiceNo = await generateInvoiceNumber(clientId);
    const totalAmount = rows.reduce((sum, r) => sum + parseFloat(r.totalAmount || 0), 0);

    const invoice = await Invoice.create({
      invoiceNo, clientId, date, dueDate, notes,
      totalAmount, status: 'draft',
      invoiceType: 'delivery',
      periodStart, periodEnd,
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

router.delete('/:id', rbac('admin', 'staff'), async (req, res) => {
  try {
    const invoice = await Invoice.findByPk(req.params.id);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    if (!['draft', 'cancelled'].includes(invoice.status)) {
      return res.status(400).json({ message: 'Only draft invoices can be deleted' });
    }
    await InvoiceItem.destroy({ where: { invoiceId: invoice.id } });
    await invoice.destroy();
    res.json({ message: 'Invoice deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/mark-sent', rbac('admin', 'staff'), async (req, res) => {
  try {
    const invoice = await Invoice.findByPk(req.params.id);
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
    const invoice = await Invoice.findByPk(req.params.id);
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
