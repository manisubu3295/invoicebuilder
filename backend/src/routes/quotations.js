const router = require('express').Router();
const fs = require('fs');
const { Op } = require('sequelize');
const { Quotation, QuotationItem, Invoice, InvoiceItem, Client, CompanySettings } = require('../models');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const { createQuotationWithNumber, createInvoiceWithNumber, generateQuotationNumber } = require('../services/invoiceNumber');
const { generateQuotationPDF } = require('../services/pdfService');
const { sendQuotationEmail } = require('../services/emailService');
const { isTestModeEnabled } = require('../services/testMode');

router.use(auth);

const num = (v) => (v === '' || v === null || v === undefined) ? null : parseFloat(v);
const dateStr = (v) => (v === '' || v === null || v === undefined) ? null : v;

router.get('/', async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    const where = { isTest: isTestModeEnabled() };
    if (fromDate || toDate) {
      where.date = {};
      if (fromDate) where.date[Op.gte] = fromDate;
      if (toDate) where.date[Op.lte] = toDate;
    }
    const quotations = await Quotation.findAll({
      where,
      include: [
        { model: Client, as: 'client', attributes: ['id', 'companyName', 'clientCode'] },
        { model: QuotationItem, as: 'items' },
      ],
      order: [['createdAt', 'DESC']],
    });
    res.json(quotations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/next-number', async (req, res) => {
  try {
    const nextNumber = await generateQuotationNumber(req.query.clientId || null, isTestModeEnabled());
    res.json({ nextNumber });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const q = await Quotation.findOne({
      where: { id: req.params.id, isTest: isTestModeEnabled() },
      include: [{ model: Client, as: 'client' }, { model: QuotationItem, as: 'items' }],
    });
    if (!q) return res.status(404).json({ message: 'Quotation not found' });
    res.json(q);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', rbac('admin', 'staff'), async (req, res) => {
  try {
    const { clientId, date, validUntil, items, notes } = req.body;
    if (!clientId || !date || !items?.length) {
      return res.status(400).json({ message: 'clientId, date, and items are required' });
    }

    const totalAmount = items.reduce((sum, i) => sum + parseFloat(i.totalAmount || 0), 0);

    const quotation = await createQuotationWithNumber(clientId, { date, validUntil: validUntil || null, notes, totalAmount });
    const qItems = items.map((item, idx) => ({
      quotationId: quotation.id,
      sno: item.sno || idx + 1,
      jobDescription: item.jobDescription,
      itemType: item.itemType || 'service',
      fromDate: dateStr(item.fromDate),
      toDate: dateStr(item.toDate),
      rate: num(item.rate),
      rateType: item.rateType || 'per_week',
      deliveryDate: dateStr(item.deliveryDate),
      quantity: num(item.quantity),
      unitPrice: num(item.unitPrice),
      totalAmount: num(item.totalAmount),
    }));
    await QuotationItem.bulkCreate(qItems);

    const full = await Quotation.findByPk(quotation.id, {
      include: [{ model: Client, as: 'client' }, { model: QuotationItem, as: 'items' }],
    });
    res.status(201).json(full);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', rbac('admin', 'staff'), async (req, res) => {
  try {
    const q = await Quotation.findOne({ where: { id: req.params.id, isTest: isTestModeEnabled() } });
    if (!q) return res.status(404).json({ message: 'Quotation not found' });

    const { date, validUntil, notes, status, items } = req.body;
    if (items) {
      await QuotationItem.destroy({ where: { quotationId: q.id } });
      const totalAmount = items.reduce((sum, i) => sum + parseFloat(i.totalAmount || 0), 0);
      const qItems = items.map((item, idx) => ({
        quotationId: q.id,
        sno: item.sno || idx + 1,
        jobDescription: item.jobDescription,
        itemType: item.itemType || 'service',
        fromDate: dateStr(item.fromDate),
        toDate: dateStr(item.toDate),
        rate: num(item.rate),
        rateType: item.rateType || 'per_week',
        deliveryDate: dateStr(item.deliveryDate),
        quantity: num(item.quantity),
        unitPrice: num(item.unitPrice),
        totalAmount: num(item.totalAmount),
      }));
      await QuotationItem.bulkCreate(qItems);
      await q.update({ date, validUntil: validUntil || null, notes, status, totalAmount });
    } else {
      await q.update({ date, validUntil: validUntil || null, notes, status });
    }

    const full = await Quotation.findByPk(q.id, {
      include: [{ model: Client, as: 'client' }, { model: QuotationItem, as: 'items' }],
    });
    res.json(full);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id/pdf', async (req, res) => {
  try {
    const q = await Quotation.findOne({
      where: { id: req.params.id, isTest: isTestModeEnabled() },
      include: [{ model: Client, as: 'client' }, { model: QuotationItem, as: 'items' }],
    });
    if (!q) return res.status(404).json({ message: 'Quotation not found' });

    const settings = await CompanySettings.findOne() || {};
    const pdfPath = await generateQuotationPDF(q, q.client, q.items, settings);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Quotation-${q.quotationNo.replace(/\//g, '-')}.pdf"`);
    fs.createReadStream(pdfPath).pipe(res);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/send-email', rbac('admin', 'staff'), async (req, res) => {
  try {
    const q = await Quotation.findOne({
      where: { id: req.params.id, isTest: isTestModeEnabled() },
      include: [{ model: Client, as: 'client' }, { model: QuotationItem, as: 'items' }],
    });
    if (!q) return res.status(404).json({ message: 'Quotation not found' });
    if (!q.client.email) return res.status(400).json({ message: 'Client has no email address' });

    const settings = await CompanySettings.findOne() || {};
    const pdfPath = await generateQuotationPDF(q, q.client, q.items, settings);
    await sendQuotationEmail({
      to: q.client.email,
      clientName: q.client.contactPerson || q.client.companyName,
      quotationNo: q.quotationNo,
      pdfPath,
      settings: settings?.dataValues || settings || {},
    });

    await q.update({ status: 'sent' });
    res.json({ message: 'Quotation emailed successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id/number', rbac('admin'), async (req, res) => {
  try {
    const newNo = (req.body.quotationNo || '').trim();
    if (!newNo) return res.status(400).json({ message: 'Quotation number is required' });

    const conflict = await Quotation.findOne({ where: { quotationNo: newNo, isTest: isTestModeEnabled() } });
    if (conflict && conflict.id !== req.params.id) {
      return res.status(409).json({ message: `Quotation number "${newNo}" is already used by another quotation` });
    }

    const q = await Quotation.findOne({ where: { id: req.params.id, isTest: isTestModeEnabled() } });
    if (!q) return res.status(404).json({ message: 'Quotation not found' });

    await q.update({ quotationNo: newNo });
    res.json({ quotationNo: q.quotationNo });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', rbac('admin', 'staff'), async (req, res) => {
  try {
    const q = await Quotation.findOne({ where: { id: req.params.id, isTest: isTestModeEnabled() } });
    if (!q) return res.status(404).json({ message: 'Quotation not found' });
    if (q.status !== 'draft') {
      return res.status(400).json({ message: 'Only draft quotations can be deleted' });
    }
    await QuotationItem.destroy({ where: { quotationId: q.id } });
    await q.destroy();
    res.json({ message: 'Quotation deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/convert-to-invoice', rbac('admin', 'staff'), async (req, res) => {
  try {
    const q = await Quotation.findOne({
      where: { id: req.params.id, isTest: isTestModeEnabled() },
      include: [{ model: Client, as: 'client' }, { model: QuotationItem, as: 'items' }],
    });
    if (!q) return res.status(404).json({ message: 'Quotation not found' });
    if (q.status === 'converted') return res.status(400).json({ message: 'Quotation already converted' });

    const invoice = await createInvoiceWithNumber(q.clientId, {
      quotationId: q.id, date: new Date(), totalAmount: q.totalAmount, status: 'draft',
    });

    const invoiceItems = q.items.map(item => ({
      invoiceId: invoice.id,
      sno: item.sno,
      jobDescription: item.jobDescription,
      itemType: item.itemType || 'service',
      fromDate: dateStr(item.fromDate),
      toDate: dateStr(item.toDate),
      rate: num(item.rate),
      rateType: item.rateType,
      deliveryDate: dateStr(item.deliveryDate),
      quantity: num(item.quantity),
      unitPrice: num(item.unitPrice),
      totalAmount: num(item.totalAmount),
    }));
    await InvoiceItem.bulkCreate(invoiceItems);
    await q.update({ status: 'converted' });

    const full = await Invoice.findByPk(invoice.id, {
      include: [{ model: Client, as: 'client' }, { model: InvoiceItem, as: 'items' }],
    });
    res.status(201).json(full);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
