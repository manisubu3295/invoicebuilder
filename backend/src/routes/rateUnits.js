const router = require('express').Router();
const { RateUnit, InvoiceItem, QuotationItem } = require('../models');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');

router.use(auth);

function slugify(label) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'unit';
}

async function uniqueCode(label) {
  const base = slugify(label);
  let candidate = base;
  let i = 1;
  while (await RateUnit.findOne({ where: { code: candidate } })) {
    candidate = `${base}_${i++}`;
  }
  return candidate;
}

// GET all — all authenticated users can read (needed to render the Per/Qty dropdown).
// Deactivated units are hidden unless includeInactive=true (used by the admin
// management page, and by detail/PDF views to correctly label historical items).
router.get('/', async (req, res) => {
  try {
    const { includeInactive } = req.query;
    const where = includeInactive === 'true' ? {} : { isActive: true };
    const units = await RateUnit.findAll({ where, order: [['sortOrder', 'ASC'], ['label', 'ASC']] });
    res.json(units);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST — admin only
router.post('/', rbac('admin'), async (req, res) => {
  try {
    const { label, divisorDays } = req.body;
    if (!label?.trim()) return res.status(400).json({ message: 'label is required' });
    const days = parseInt(divisorDays, 10);
    if (!days || days < 1) return res.status(400).json({ message: 'divisorDays must be a positive integer' });
    const unit = await RateUnit.create({
      code: await uniqueCode(label.trim()),
      label: label.trim(),
      divisorDays: days,
    });
    res.status(201).json(unit);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /:id — admin only. code is immutable — existing invoices/quotations
// reference it directly and would mislabel if it ever changed.
router.put('/:id', rbac('admin'), async (req, res) => {
  try {
    const unit = await RateUnit.findByPk(req.params.id);
    if (!unit) return res.status(404).json({ message: 'Not found' });
    const { label, divisorDays, isActive } = req.body;
    if (!label?.trim()) return res.status(400).json({ message: 'label is required' });
    const days = parseInt(divisorDays, 10);
    if (!days || days < 1) return res.status(400).json({ message: 'divisorDays must be a positive integer' });

    if (isActive === false && unit.isActive) {
      const activeCount = await RateUnit.count({ where: { isActive: true } });
      if (activeCount <= 1) return res.status(400).json({ message: 'Cannot deactivate the last active billing unit' });
    }

    await unit.update({
      label: label.trim(),
      divisorDays: days,
      isActive: isActive !== undefined ? !!isActive : unit.isActive,
    });
    res.json(unit);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /:id — soft delete (deactivate). Admin only.
router.delete('/:id', rbac('admin'), async (req, res) => {
  try {
    const unit = await RateUnit.findByPk(req.params.id);
    if (!unit) return res.status(404).json({ message: 'Not found' });
    if (unit.isActive) {
      const activeCount = await RateUnit.count({ where: { isActive: true } });
      if (activeCount <= 1) return res.status(400).json({ message: 'Cannot deactivate the last active billing unit' });
    }
    await unit.update({ isActive: false });
    res.json({ message: 'Unit deactivated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /:id/permanent — hard delete. Admin only. Blocked if any invoice or
// quotation item still stores this unit's code, since rateType isn't a real
// FK — deleting it out from under history would break their PDF/detail labels.
router.delete('/:id/permanent', rbac('admin'), async (req, res) => {
  try {
    const unit = await RateUnit.findByPk(req.params.id);
    if (!unit) return res.status(404).json({ message: 'Not found' });
    const [invoiceUse, quotationUse] = await Promise.all([
      InvoiceItem.count({ where: { rateType: unit.code } }),
      QuotationItem.count({ where: { rateType: unit.code } }),
    ]);
    if (invoiceUse || quotationUse) {
      return res.status(400).json({ message: 'This unit is used by existing invoices or quotations and cannot be permanently deleted. Deactivate it instead.' });
    }
    await unit.destroy();
    res.json({ message: 'Unit permanently deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
