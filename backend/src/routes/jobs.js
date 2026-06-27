const router = require('express').Router();
const { Job, Client, Vehicle, Driver, User } = require('../models');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');

router.use(auth);

router.get('/', async (req, res) => {
  try {
    const where = {};
    if (req.user.role === 'driver') {
      const driver = await Driver.findOne({ where: { userId: req.user.id } });
      if (driver) where.driverId = driver.id;
    }
    const { status, clientId } = req.query;
    if (status) where.status = status;
    if (clientId) where.clientId = clientId;

    const jobs = await Job.findAll({
      where,
      include: [
        { model: Client, as: 'client', attributes: ['id', 'companyName'] },
        { model: Vehicle, as: 'vehicle', attributes: ['id', 'plateNumber', 'size', 'type'] },
        { model: Driver, as: 'driver', include: [{ model: User, as: 'user', attributes: ['name', 'phone'] }] },
      ],
      order: [['fromDate', 'DESC']],
    });
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const job = await Job.findByPk(req.params.id, {
      include: [
        { model: Client, as: 'client' },
        { model: Vehicle, as: 'vehicle' },
        { model: Driver, as: 'driver', include: [{ model: User, as: 'user', attributes: ['name', 'phone', 'email'] }] },
      ],
    });
    if (!job) return res.status(404).json({ message: 'Job not found' });
    res.json(job);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', rbac('admin', 'staff'), async (req, res) => {
  try {
    const { clientId, vehicleId, driverId, description, fromDate, toDate, notes } = req.body;
    if (!clientId || !description || !fromDate || !toDate) {
      return res.status(400).json({ message: 'clientId, description, fromDate, toDate required' });
    }
    const job = await Job.create({ clientId, vehicleId, driverId, description, fromDate, toDate, notes });
    res.status(201).json(job);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', rbac('admin', 'staff'), async (req, res) => {
  try {
    const job = await Job.findByPk(req.params.id);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    const { clientId, vehicleId, driverId, description, fromDate, toDate, notes } = req.body;
    await job.update({ clientId, vehicleId, driverId, description, fromDate, toDate, notes });
    res.json(job);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id/status', async (req, res) => {
  try {
    const job = await Job.findByPk(req.params.id);
    if (!job) return res.status(404).json({ message: 'Job not found' });

    if (req.user.role === 'driver') {
      const driver = await Driver.findOne({ where: { userId: req.user.id } });
      if (!driver || job.driverId !== driver.id) {
        return res.status(403).json({ message: 'Not authorized for this job' });
      }
    }

    const { status } = req.body;
    const allowed = ['pending', 'in_transit', 'delivered', 'cancelled'];
    if (!allowed.includes(status)) return res.status(400).json({ message: 'Invalid status' });

    await job.update({ status });
    res.json(job);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
