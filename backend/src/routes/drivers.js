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
        { model: User, as: 'user', attributes: ['id', 'name', 'email', 'phone', 'isActive'] },
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
    const { name, email, phone, password, licenseNumber, licenseExpiry, licenseClass, nric, emergencyContact, emergencyPhone, assignedVehicleId, dailyRate } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'name, email, password required' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, phone, passwordHash, role: 'driver' });
    const driver = await Driver.create({ userId: user.id, licenseNumber: licenseNumber || null, licenseExpiry: licenseExpiry || null, licenseClass: licenseClass || null, nric: nric || null, emergencyContact: emergencyContact || null, emergencyPhone: emergencyPhone || null, assignedVehicleId: assignedVehicleId || null, dailyRate: dailyRate || null });

    res.status(201).json({ ...driver.toJSON(), user: { id: user.id, name, email, phone } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', rbac('admin'), async (req, res) => {
  try {
    const driver = await Driver.findByPk(req.params.id, { include: [{ model: User, as: 'user' }] });
    if (!driver) return res.status(404).json({ message: 'Driver not found' });

    const { name, email, phone, licenseNumber, licenseExpiry, licenseClass, nric, emergencyContact, emergencyPhone, assignedVehicleId, isActive, dailyRate } = req.body;
    await driver.user.update({ name, email, phone, isActive });
    await driver.update({ licenseNumber: licenseNumber || null, licenseExpiry: licenseExpiry || null, licenseClass: licenseClass || null, nric: nric || null, emergencyContact: emergencyContact || null, emergencyPhone: emergencyPhone || null, assignedVehicleId: assignedVehicleId || null, dailyRate: dailyRate || null });
    res.json(driver);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
