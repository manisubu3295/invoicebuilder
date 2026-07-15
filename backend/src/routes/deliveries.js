const router = require('express').Router();
const { Op } = require('sequelize');
const { DeliveryLog, DeliveryItem, Client, User, InvoiceItem, Category } = require('../models');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const { findInvalidCatalogItem } = require('../services/catalogValidation');

router.use(auth);

// Drivers may only log items that exist in the catalog — no free-typed
// items — so a delivery entry always ties back to a priced catalog item.
// Admin/staff keep the ability to type a custom item.
function validateDriverItems(items) {
  return findInvalidCatalogItem(items, { nameField: 'itemName' });
}

const fullInclude = [
  { model: Client, as: 'client', attributes: ['id', 'companyName', 'clientCode'] },
  { model: Category, as: 'category', attributes: ['id', 'name', 'invoicePrefix'] },
  { model: User, as: 'deliveredBy', attributes: ['id', 'name'] },
  { model: DeliveryItem, as: 'items' },
];

// GET /api/deliveries — list with filters
router.get('/', async (req, res) => {
  try {
    const { clientId, startDate, endDate } = req.query;
    const where = {};
    if (clientId) where.clientId = clientId;
    if (startDate && endDate) where.deliveryDate = { [Op.between]: [startDate, endDate] };
    else if (startDate) where.deliveryDate = { [Op.gte]: startDate };
    else if (endDate) where.deliveryDate = { [Op.lte]: endDate };

    // Drivers only see their own entries
    if (req.user.role === 'driver') where.deliveredById = req.user.id;

    const logs = await DeliveryLog.findAll({
      where,
      include: fullInclude,
      order: [['deliveryDate', 'DESC'], ['createdAt', 'DESC']],
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/deliveries/deliverers — active users who can make deliveries
router.get('/deliverers', async (req, res) => {
  try {
    const users = await User.findAll({
      where: { isActive: true },
      attributes: ['id', 'name', 'role'],
      order: [['name', 'ASC']],
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/deliveries/preview — editable preview for invoice generation
// MUST come before /:id to avoid "preview" being treated as an ID
router.get('/preview', rbac('admin', 'staff'), async (req, res) => {
  try {
    const { clientId, startDate, endDate, categoryId } = req.query;
    if (!clientId || !startDate || !endDate) {
      return res.status(400).json({ message: 'clientId, startDate, and endDate are required' });
    }

    const where = {
      clientId,
      deliveryDate: { [Op.between]: [startDate, endDate] },
      status: 'pending',
    };
    if (categoryId) where.categoryId = categoryId;

    const logs = await DeliveryLog.findAll({
      where,
      include: fullInclude,
      order: [['deliveryDate', 'ASC'], ['createdAt', 'ASC']],
    });

    const client = await Client.findByPk(clientId, { include: [{ model: Category, as: 'categories', attributes: ['id', 'name', 'invoicePrefix'], through: { attributes: [] } }] });
    const rows = [];
    logs.forEach(log => {
      log.items.forEach(item => {
        rows.push({
          deliveryLogId: log.id,
          deliveryItemId: item.id,
          deliveryDate: log.deliveryDate,
          deliveredBy: log.deliveredBy?.name || '',
          deliveredById: log.deliveredById,
          categoryId: log.categoryId,
          itemName: item.itemName,
          quantity: parseFloat(item.quantity),
          unitPrice: parseFloat(item.unitPrice),
          totalAmount: parseFloat(item.totalAmount),
          notes: item.notes || '',
          runSheetNo: item.runSheetNo || '',
        });
      });
    });

    res.json({
      client,
      rows,
      totalAmount: rows.reduce((s, r) => s + r.totalAmount, 0),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/deliveries/:id
router.get('/:id', async (req, res) => {
  try {
    const log = await DeliveryLog.findByPk(req.params.id, { include: fullInclude });
    if (!log) return res.status(404).json({ message: 'Not found' });
    res.json(log);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/deliveries
router.post('/', async (req, res) => {
  try {
    const { clientId, categoryId, deliveryDate, items, notes } = req.body;
    if (!clientId || !deliveryDate || !items?.length) {
      return res.status(400).json({ message: 'clientId, deliveryDate, and items are required' });
    }
    if (!categoryId) return res.status(400).json({ message: 'Category is required' });

    if (req.user.role === 'driver') {
      const err = await validateDriverItems(items);
      if (err) return res.status(400).json({ message: err });
    }

    const canChooseDeliverer = req.user.role === 'admin' || req.user.role === 'staff';
    const deliveredById = canChooseDeliverer && req.body.deliveredById
      ? req.body.deliveredById
      : req.user.id;

    const log = await DeliveryLog.create({
      clientId,
      categoryId,
      deliveredById,
      deliveryDate,
      notes,
      status: 'pending',
    });

    const deliveryItems = items.map(item => ({
      deliveryLogId: log.id,
      itemName: item.itemName,
      quantity: parseFloat(item.quantity || 0),
      unitPrice: parseFloat(item.unitPrice || 0),
      totalAmount: parseFloat(item.quantity || 0) * parseFloat(item.unitPrice || 0),
      notes: item.notes || '',
      runSheetNo: item.runSheetNo || null,
    }));
    await DeliveryItem.bulkCreate(deliveryItems);

    const full = await DeliveryLog.findByPk(log.id, { include: fullInclude });
    res.status(201).json(full);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/deliveries/:id
router.put('/:id', async (req, res) => {
  try {
    const log = await DeliveryLog.findByPk(req.params.id);
    if (!log) return res.status(404).json({ message: 'Not found' });
    if (log.status === 'invoiced') {
      return res.status(400).json({ message: 'Cannot edit an invoiced delivery entry' });
    }
    // Staff/drivers can only edit their own entries
    if (req.user.role !== 'admin' && log.deliveredById !== req.user.id) {
      return res.status(403).json({ message: 'Not authorised' });
    }

    const { deliveryDate, notes, items, deliveredById, categoryId } = req.body;
    if (categoryId !== undefined && !categoryId) return res.status(400).json({ message: 'Category is required' });

    if (items && req.user.role === 'driver') {
      const err = await validateDriverItems(items);
      if (err) return res.status(400).json({ message: err });
    }

    const updateFields = { deliveryDate, notes };
    if (categoryId) updateFields.categoryId = categoryId;
    if (req.user.role === 'admin' && deliveredById) updateFields.deliveredById = deliveredById;
    await log.update(updateFields);

    if (items) {
      await DeliveryItem.destroy({ where: { deliveryLogId: log.id } });
      await DeliveryItem.bulkCreate(items.map(item => ({
        deliveryLogId: log.id,
        itemName: item.itemName,
        quantity: parseFloat(item.quantity || 0),
        unitPrice: parseFloat(item.unitPrice || 0),
        totalAmount: parseFloat(item.quantity || 0) * parseFloat(item.unitPrice || 0),
        notes: item.notes || '',
        runSheetNo: item.runSheetNo || null,
      })));
    }

    const full = await DeliveryLog.findByPk(log.id, { include: fullInclude });
    res.json(full);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/deliveries/:id
router.delete('/:id', async (req, res) => {
  try {
    const log = await DeliveryLog.findByPk(req.params.id);
    if (!log) return res.status(404).json({ message: 'Not found' });
    if (log.status === 'invoiced') {
      return res.status(400).json({ message: 'Cannot delete an invoiced delivery entry' });
    }
    if (req.user.role !== 'admin' && log.deliveredById !== req.user.id) {
      return res.status(403).json({ message: 'Not authorised' });
    }
    await DeliveryItem.destroy({ where: { deliveryLogId: log.id } });
    await log.destroy();
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Hard delete — permanently removes the delivery entry, even one already
// marked invoiced. Admin-only, blocked if an invoice line item still
// references it (the real dependency — status alone isn't checked here so
// this also recovers from a stale/incorrect "invoiced" status).
router.delete('/:id/permanent', rbac('admin'), async (req, res) => {
  try {
    const log = await DeliveryLog.findByPk(req.params.id);
    if (!log) return res.status(404).json({ message: 'Not found' });

    const linkedItemCount = await InvoiceItem.count({ where: { deliveryLogId: log.id } });
    if (linkedItemCount > 0) {
      return res.status(409).json({ message: `Cannot permanently delete: this delivery is on ${linkedItemCount} invoice line item(s). Remove those first.` });
    }

    await DeliveryItem.destroy({ where: { deliveryLogId: log.id } });
    await log.destroy();
    res.json({ message: 'Delivery entry permanently deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
