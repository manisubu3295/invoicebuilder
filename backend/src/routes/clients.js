const router = require('express').Router();
const { Client } = require('../models');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const { isTestModeEnabled } = require('../services/testMode');

router.use(auth);

router.get('/', async (req, res) => {
  try {
    const clients = await Client.findAll({ where: { isTest: isTestModeEnabled() }, order: [['companyName', 'ASC']] });
    res.json(clients);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const client = await Client.findOne({ where: { id: req.params.id, isTest: isTestModeEnabled() } });
    if (!client) return res.status(404).json({ message: 'Client not found' });
    res.json(client);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', rbac('admin'), async (req, res) => {
  try {
    const { companyName, clientCode, contactPerson, email, phone, address, invoicePrefix, invoiceStartNumber, quotationPrefix, quotationStartNumber } = req.body;
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
    });
    res.status(201).json(client);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', rbac('admin'), async (req, res) => {
  try {
    const client = await Client.findOne({ where: { id: req.params.id, isTest: isTestModeEnabled() } });
    if (!client) return res.status(404).json({ message: 'Client not found' });

    const { companyName, clientCode, contactPerson, email, phone, address, isActive, invoicePrefix, invoiceStartNumber, quotationPrefix, quotationStartNumber } = req.body;
    await client.update({
      companyName, clientCode: clientCode?.toUpperCase(), contactPerson, email, phone, address, isActive,
      invoicePrefix: invoicePrefix?.trim() || null,
      invoiceStartNumber: invoiceStartNumber || null,
      quotationPrefix: quotationPrefix?.trim() || null,
      quotationStartNumber: quotationStartNumber || null,
    });
    res.json(client);
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

module.exports = router;
