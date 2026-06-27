const router = require('express').Router();
const { Op } = require('sequelize');
const { JobAttendance, Job, Driver, Vehicle, User } = require('../models');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');

router.use(auth);

const driverInclude = {
  model: Driver,
  as: 'driver',
  include: [{ model: User, as: 'user', attributes: ['id', 'name', 'phone'] }],
};

// GET /api/job-attendance?jobId=X — list attendance for a job
router.get('/', async (req, res) => {
  try {
    const { jobId } = req.query;
    if (!jobId) return res.status(400).json({ message: 'jobId is required' });

    const where = { jobId };

    // Drivers can only see their own records
    if (req.user.role === 'driver') {
      const driver = await Driver.findOne({ where: { userId: req.user.id } });
      if (!driver) return res.json([]);
      where.driverId = driver.id;
    }

    const records = await JobAttendance.findAll({
      where,
      include: [driverInclude],
      order: [['date', 'ASC']],
    });
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/job-attendance/active — today's active sessions with GPS (admin/staff only)
router.get('/active', rbac('admin', 'staff'), async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const records = await JobAttendance.findAll({
      where: {
        date: today,
        startLat: { [Op.ne]: null },
        endTime: null,
      },
      include: [
        driverInclude,
        {
          model: Job,
          as: 'job',
          attributes: ['id', 'description'],
          include: [{ model: Vehicle, as: 'vehicle', attributes: ['plateNumber', 'type'] }],
        },
      ],
    });
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/job-attendance — driver checks in for the day
router.post('/', async (req, res) => {
  try {
    const { jobId, date, startLat, startLng, startAddress, notes } = req.body;
    if (!jobId || !date) return res.status(400).json({ message: 'jobId and date are required' });

    // Resolve driver
    let driverId;
    if (req.user.role === 'driver') {
      const driver = await Driver.findOne({ where: { userId: req.user.id } });
      if (!driver) return res.status(403).json({ message: 'No driver profile found' });
      driverId = driver.id;
    } else {
      driverId = req.body.driverId;
      if (!driverId) return res.status(400).json({ message: 'driverId required for non-driver users' });
    }

    // Prevent duplicate check-in for same job+driver+date
    const existing = await JobAttendance.findOne({ where: { jobId, driverId, date } });
    if (existing) return res.status(400).json({ message: 'Already checked in for this date' });

    const record = await JobAttendance.create({
      jobId,
      driverId,
      date,
      startTime: new Date(),
      startLat: startLat || null,
      startLng: startLng || null,
      startAddress: startAddress || null,
      status: 'started',
      notes,
    });

    const full = await JobAttendance.findByPk(record.id, { include: [driverInclude] });
    res.status(201).json(full);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/job-attendance/:id/end — driver checks out
router.put('/:id/end', async (req, res) => {
  try {
    const record = await JobAttendance.findByPk(req.params.id);
    if (!record) return res.status(404).json({ message: 'Attendance record not found' });

    // Drivers can only update their own records
    if (req.user.role === 'driver') {
      const driver = await Driver.findOne({ where: { userId: req.user.id } });
      if (!driver || record.driverId !== driver.id) {
        return res.status(403).json({ message: 'Not authorised' });
      }
    }

    if (record.endTime) return res.status(400).json({ message: 'Already checked out for this day' });

    const { endLat, endLng, endAddress, notes } = req.body;
    await record.update({
      endTime: new Date(),
      endLat: endLat || null,
      endLng: endLng || null,
      endAddress: endAddress || null,
      status: 'completed',
      notes: notes || record.notes,
    });

    const full = await JobAttendance.findByPk(record.id, { include: [driverInclude] });
    res.json(full);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
