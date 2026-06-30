const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { Driver, User, Vehicle } = require('../models');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');

router.use(auth, rbac('admin', 'staff'));

router.get('/', async (req, res) => {
  try {
    const drivers = await Driver.findAll({
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'username', 'phone', 'isActive'] },
        { model: Vehicle, as: 'assignedVehicle', attributes: ['id', 'plateNumber', 'size', 'type'] },
      ],
    });
    res.json(drivers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', rbac('admin'), async (req, res) => {
  try {
    const { name, username, phone, password, licenseNumber, licenseExpiry, licenseClass, nric, emergencyContact, emergencyPhone, assignedVehicleId, dailyRate } = req.body;
    if (!name || !username || !password) return res.status(400).json({ message: 'name, username, and password are required' });

    const clean = username.trim().toLowerCase();
    const existing = await User.findOne({ where: { username: clean } });
    if (existing) return res.status(409).json({ message: `Username "${clean}" is already taken` });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, username: clean, phone, passwordHash, role: 'driver' });
    const driver = await Driver.create({
      userId: user.id,
      licenseNumber: licenseNumber || null,
      licenseExpiry: licenseExpiry || null,
      licenseClass: licenseClass || null,
      nric: nric || null,
      emergencyContact: emergencyContact || null,
      emergencyPhone: emergencyPhone || null,
      assignedVehicleId: assignedVehicleId || null,
      dailyRate: dailyRate || null,
    });

    res.status(201).json({ ...driver.toJSON(), user: { id: user.id, name, username: clean, phone } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', rbac('admin'), async (req, res) => {
  try {
    const driver = await Driver.findByPk(req.params.id, { include: [{ model: User, as: 'user' }] });
    if (!driver) return res.status(404).json({ message: 'Driver not found' });

    const { name, phone, licenseNumber, licenseExpiry, licenseClass, nric, emergencyContact, emergencyPhone, assignedVehicleId, isActive, dailyRate, password } = req.body;
    const userUpdates = { name, phone, isActive };
    if (password) userUpdates.passwordHash = await bcrypt.hash(password, 10);
    await driver.user.update(userUpdates);
    await driver.update({
      licenseNumber: licenseNumber || null,
      licenseExpiry: licenseExpiry || null,
      licenseClass: licenseClass || null,
      nric: nric || null,
      emergencyContact: emergencyContact || null,
      emergencyPhone: emergencyPhone || null,
      assignedVehicleId: assignedVehicleId || null,
      dailyRate: dailyRate || null,
    });
    res.json(driver);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
