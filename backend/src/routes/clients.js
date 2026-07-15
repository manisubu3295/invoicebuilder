const router = require('express').Router();
const { Client, Quotation, Invoice, Job, DeliveryLog, Category, ClientCategory } = require('../models');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const { isTestModeEnabled } = require('../services/testMode');

router.use(auth);

const categoriesInclude = { model: Category, as: 'categories', attributes: ['id', 'name', 'invoicePrefix'], through: { attributes: [] } };

router.get('/', async (req, res) => {
  try {
    const clients = await Client.findAll({ where: { isTest: isTestModeEnabled() }, include: [categoriesInclude], order: [['companyName', 'ASC']] });
    res.json(clients);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const client = await Client.findOne({ where: { id: req.params.id, isTest: isTestModeEnabled() }, include: [categoriesInclude] });
    if (!client) return res.status(404).json({ message: 'Client not found' });
    res.json(client);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', rbac('admin'), async (req, res) => {
  try {
    const { companyName, clientCode, contactPerson, email, phone, address, invoicePrefix, invoiceStartNumber, quotationPrefix, quotationStartNumber, requiresRunSheet, bulkRunSheet, itemMatrix, categoryIds } = req.body;
    if (!companyName || !clientCode) return res.status(400).json({ message: 'Company name and client code required' });

    const isTest = isTestModeEnabled();
    const existing = await Client.findOne({ where: { clientCode: clientCode.toUpperCase(), isTest } });
    if (existing) return res.status(409).json({ message: 'Client code already exists' });

    const client = await Client.create({
      companyName, clientCode: clientCode.toUpperCase(),
      contactPerson, email, phone, address, isTest,
      invoicePrefix: invoicePrefix?.trim() || null,
      invoiceStartNumber: invoiceStartNumber || null,
      quotationPrefix: quotationPrefix?.trim() || null,
      quotationStartNumber: quotationStartNumber || null,
      requiresRunSheet: !!requiresRunSheet,
      bulkRunSheet: !!bulkRunSheet,
      itemMatrix: !!itemMatrix,
    });
    await client.setCategories(Array.isArray(categoryIds) ? categoryIds : []);

    const full = await Client.findByPk(client.id, { include: [categoriesInclude] });
    res.status(201).json(full);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', rbac('admin'), async (req, res) => {
  try {
    const client = await Client.findOne({ where: { id: req.params.id, isTest: isTestModeEnabled() } });
    if (!client) return res.status(404).json({ message: 'Client not found' });

    const { companyName, clientCode, contactPerson, email, phone, address, isActive, invoicePrefix, invoiceStartNumber, quotationPrefix, quotationStartNumber, requiresRunSheet, bulkRunSheet, itemMatrix, categoryIds } = req.body;
    await client.update({
      companyName, clientCode: clientCode?.toUpperCase(), contactPerson, email, phone, address, isActive,
      invoicePrefix: invoicePrefix?.trim() || null,
      invoiceStartNumber: invoiceStartNumber || null,
      quotationPrefix: quotationPrefix?.trim() || null,
      quotationStartNumber: quotationStartNumber || null,
      requiresRunSheet: requiresRunSheet !== undefined ? !!requiresRunSheet : client.requiresRunSheet,
      bulkRunSheet: bulkRunSheet !== undefined ? !!bulkRunSheet : client.bulkRunSheet,
      itemMatrix: itemMatrix !== undefined ? !!itemMatrix : client.itemMatrix,
    });
    if (categoryIds !== undefined) await client.setCategories(Array.isArray(categoryIds) ? categoryIds : []);

    const full = await Client.findByPk(client.id, { include: [categoriesInclude] });
    res.json(full);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', rbac('admin'), async (req, res) => {
  try {
    const client = await Client.findOne({ where: { id: req.params.id, isTest: isTestModeEnabled() } });
    if (!client) return res.status(404).json({ message: 'Client not found' });
    await client.update({ isActive: false });
    res.json({ message: 'Client deactivated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Hard delete — permanently removes the client. Admin-only, blocked if any
// quotation/invoice/job/delivery log references it.
router.delete('/:id/permanent', rbac('admin'), async (req, res) => {
  try {
    const client = await Client.findOne({ where: { id: req.params.id, isTest: isTestModeEnabled() } });
    if (!client) return res.status(404).json({ message: 'Client not found' });

    const [quotationCount, invoiceCount, jobCount, deliveryLogCount] = await Promise.all([
      Quotation.count({ where: { clientId: client.id } }),
      Invoice.count({ where: { clientId: client.id } }),
      Job.count({ where: { clientId: client.id } }),
      DeliveryLog.count({ where: { clientId: client.id } }),
    ]);
    const blockers = [];
    if (quotationCount) blockers.push(`${quotationCount} quotation(s)`);
    if (invoiceCount) blockers.push(`${invoiceCount} invoice(s)`);
    if (jobCount) blockers.push(`${jobCount} job(s)`);
    if (deliveryLogCount) blockers.push(`${deliveryLogCount} delivery log(s)`);
    if (blockers.length) {
      return res.status(409).json({ message: `Cannot permanently delete: this client has ${blockers.join(', ')}. Remove those first.` });
    }

    await ClientCategory.destroy({ where: { clientId: client.id } });
    await client.destroy();
    res.json({ message: 'Client permanently deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
