const router = require('express').Router();
const { Category, ClientCategory, DeliveryLog, Invoice } = require('../models');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');

router.use(auth);

// GET all — all authenticated users can read (needed for delivery/invoice forms).
// Deactivated categories are hidden unless includeInactive=true (admin management page).
router.get('/', async (req, res) => {
  try {
    const { includeInactive } = req.query;
    const where = includeInactive === 'true' ? {} : { isActive: true };
    const categories = await Category.findAll({ where, order: [['name', 'ASC']] });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST — admin only
router.post('/', rbac('admin'), async (req, res) => {
  try {
    const { name, invoicePrefix } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Category name is required' });
    if (!invoicePrefix?.trim()) return res.status(400).json({ message: 'Invoice prefix is required' });
    const category = await Category.create({
      name: name.trim(),
      invoicePrefix: invoicePrefix.trim().toUpperCase(),
    });
    res.status(201).json(category);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /:id — admin only
router.put('/:id', rbac('admin'), async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) return res.status(404).json({ message: 'Not found' });
    const { name, invoicePrefix, isActive } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Category name is required' });
    if (!invoicePrefix?.trim()) return res.status(400).json({ message: 'Invoice prefix is required' });
    await category.update({
      name: name.trim(),
      invoicePrefix: invoicePrefix.trim().toUpperCase(),
      isActive: isActive !== undefined ? !!isActive : category.isActive,
    });
    res.json(category);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /:id — soft delete (deactivate). Admin only.
router.delete('/:id', rbac('admin'), async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) return res.status(404).json({ message: 'Not found' });
    await category.update({ isActive: false });
    res.json({ message: 'Category deactivated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /:id/permanent — hard delete. Admin only. Blocked if any client is
// assigned this category, or any delivery log/invoice references it.
router.delete('/:id/permanent', rbac('admin'), async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) return res.status(404).json({ message: 'Not found' });

    const [clientCount, deliveryCount, invoiceCount] = await Promise.all([
      ClientCategory.count({ where: { categoryId: category.id } }),
      DeliveryLog.count({ where: { categoryId: category.id } }),
      Invoice.count({ where: { categoryId: category.id } }),
    ]);
    const blockers = [];
    if (clientCount) blockers.push(`${clientCount} client(s)`);
    if (deliveryCount) blockers.push(`${deliveryCount} delivery log(s)`);
    if (invoiceCount) blockers.push(`${invoiceCount} invoice(s)`);
    if (blockers.length) {
      return res.status(409).json({ message: `Cannot permanently delete: this category is used by ${blockers.join(', ')}. Remove those first.` });
    }

    await category.destroy();
    res.json({ message: 'Category permanently deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
