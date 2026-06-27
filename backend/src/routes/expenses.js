const router = require('express').Router();
const { Expense, Driver, Vehicle, Job, User, Client } = require('../models');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');

router.use(auth);

const fullInclude = [
  {
    model: Driver,
    as: 'driver',
    include: [{ model: User, as: 'user', attributes: ['id', 'name'] }],
  },
  { model: Vehicle, as: 'vehicle', attributes: ['id', 'plateNumber', 'type'] },
  {
    model: Job,
    as: 'job',
    attributes: ['id', 'description'],
    include: [{ model: Client, as: 'client', attributes: ['id', 'companyName'] }],
  },
  { model: User, as: 'approvedBy', attributes: ['id', 'name'] },
];

// GET /api/expenses
router.get('/', async (req, res) => {
  try {
    const where = {};

    if (req.user.role === 'driver') {
      const driver = await Driver.findOne({ where: { userId: req.user.id } });
      if (!driver) return res.json([]);
      where.driverId = driver.id;
    } else {
      if (req.query.driverId) where.driverId = req.query.driverId;
      if (req.query.vehicleId) where.vehicleId = req.query.vehicleId;
      if (req.query.status) where.status = req.query.status;
    }

    if (req.query.startDate || req.query.endDate) {
      const { Op } = require('sequelize');
      where.date = {};
      if (req.query.startDate) where.date[Op.gte] = req.query.startDate;
      if (req.query.endDate) where.date[Op.lte] = req.query.endDate;
    }

    const expenses = await Expense.findAll({
      where,
      include: fullInclude,
      order: [['date', 'DESC']],
    });
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/expenses — driver creates
router.post('/', async (req, res) => {
  try {
    const { date, category, amount, description, fuelLiters, odometer, jobId, vehicleId } = req.body;
    if (!date || !category || !amount) {
      return res.status(400).json({ message: 'date, category, and amount are required' });
    }

    let driverId;
    if (req.user.role === 'driver') {
      const driver = await Driver.findOne({ where: { userId: req.user.id } });
      if (!driver) return res.status(403).json({ message: 'No driver profile found' });
      driverId = driver.id;
    } else {
      driverId = req.body.driverId;
      if (!driverId) return res.status(400).json({ message: 'driverId required' });
    }

    const expense = await Expense.create({
      driverId,
      jobId: jobId || null,
      vehicleId: vehicleId || null,
      date,
      category,
      amount,
      description,
      fuelLiters: fuelLiters || null,
      odometer: odometer || null,
      status: 'pending',
    });

    const full = await Expense.findByPk(expense.id, { include: fullInclude });
    res.status(201).json(full);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/expenses/:id — driver edits own pending expense
router.put('/:id', async (req, res) => {
  try {
    const expense = await Expense.findByPk(req.params.id);
    if (!expense) return res.status(404).json({ message: 'Expense not found' });

    if (req.user.role === 'driver') {
      const driver = await Driver.findOne({ where: { userId: req.user.id } });
      if (!driver || expense.driverId !== driver.id) {
        return res.status(403).json({ message: 'Not authorised' });
      }
      if (expense.status !== 'pending') {
        return res.status(400).json({ message: 'Cannot edit a reviewed expense' });
      }
    }

    const { date, category, amount, description, fuelLiters, odometer, jobId, vehicleId } = req.body;
    await expense.update({
      date, category, amount, description,
      fuelLiters: fuelLiters || null,
      odometer: odometer || null,
      jobId: jobId || null,
      vehicleId: vehicleId || null,
    });

    const full = await Expense.findByPk(expense.id, { include: fullInclude });
    res.json(full);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/expenses/:id
router.delete('/:id', async (req, res) => {
  try {
    const expense = await Expense.findByPk(req.params.id);
    if (!expense) return res.status(404).json({ message: 'Expense not found' });

    if (req.user.role === 'driver') {
      const driver = await Driver.findOne({ where: { userId: req.user.id } });
      if (!driver || expense.driverId !== driver.id) {
        return res.status(403).json({ message: 'Not authorised' });
      }
      if (expense.status !== 'pending') {
        return res.status(400).json({ message: 'Cannot delete a reviewed expense' });
      }
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin only' });
    }

    await expense.destroy();
    res.json({ message: 'Expense deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/expenses/:id/approve — admin only
router.post('/:id/approve', rbac('admin'), async (req, res) => {
  try {
    const expense = await Expense.findByPk(req.params.id);
    if (!expense) return res.status(404).json({ message: 'Expense not found' });
    await expense.update({
      status: 'approved',
      approvedById: req.user.id,
      approvedAt: new Date(),
      adminNote: req.body.adminNote || null,
    });
    const full = await Expense.findByPk(expense.id, { include: fullInclude });
    res.json(full);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/expenses/:id/reject — admin only
router.post('/:id/reject', rbac('admin'), async (req, res) => {
  try {
    const expense = await Expense.findByPk(req.params.id);
    if (!expense) return res.status(404).json({ message: 'Expense not found' });
    await expense.update({
      status: 'rejected',
      approvedById: req.user.id,
      approvedAt: new Date(),
      adminNote: req.body.adminNote || null,
    });
    const full = await Expense.findByPk(expense.id, { include: fullInclude });
    res.json(full);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
