const router = require('express').Router();
const { ItemCatalog } = require('../models');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');

router.use(auth);

// GET all — all authenticated users can read (drivers need it for delivery form).
// Deactivated items are hidden unless includeInactive=true (used by the admin
// management page so deactivated items can still be found and reactivated).
router.get('/', async (req, res) => {
  try {
    const { search, includeInactive } = req.query;
    const where = includeInactive === 'true' ? {} : { isActive: true };
    if (search) where.name = { [require('sequelize').Op.like]: `%${search}%` };
    const items = await ItemCatalog.findAll({ where, order: [['name', 'ASC']], limit: 200 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST — admin only
router.post('/', rbac('admin'), async (req, res) => {
  try {
    const { name, unit, unitPrice } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'name is required' });
    const item = await ItemCatalog.create({
      name: name.trim(),
      unit: unit?.trim() || '',
      unitPrice: parseFloat(unitPrice || 0),
    });
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /:id — admin only
router.put('/:id', rbac('admin'), async (req, res) => {
  try {
    const item = await ItemCatalog.findByPk(req.params.id);
    if (!item) return res.status(404).json({ message: 'Not found' });
    const { name, unit, unitPrice, isActive } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'name is required' });
    await item.update({
      name: name.trim(),
      unit: unit?.trim() || '',
      unitPrice: parseFloat(unitPrice || 0),
      isActive: isActive !== undefined ? !!isActive : item.isActive,
    });
    res.json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /:id — soft delete (deactivate). Admin only.
router.delete('/:id', rbac('admin'), async (req, res) => {
  try {
    const item = await ItemCatalog.findByPk(req.params.id);
    if (!item) return res.status(404).json({ message: 'Not found' });
    await item.update({ isActive: false });
    res.json({ message: 'Item deactivated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /:id/permanent — hard delete. Admin only. Nothing else references
// ItemCatalog by foreign key, so no dependent-record check is needed.
router.delete('/:id/permanent', rbac('admin'), async (req, res) => {
  try {
    const item = await ItemCatalog.findByPk(req.params.id);
    if (!item) return res.status(404).json({ message: 'Not found' });
    await item.destroy();
    res.json({ message: 'Item permanently deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
