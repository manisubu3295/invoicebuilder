const router = require('express').Router();
const { Vehicle, Job, Expense, Driver } = require('../models');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');

router.use(auth);

router.get('/', async (req, res) => {
  try {
    const vehicles = await Vehicle.findAll({ order: [['plateNumber', 'ASC']] });
    res.json(vehicles);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', rbac('admin'), async (req, res) => {
  try {
    const { plateNumber, type, size, notes, coeExpiry, roadTaxExpiry, insuranceExpiry, inspectionDue, mileage } = req.body;
    if (!plateNumber || !type) return res.status(400).json({ message: 'plateNumber and type required' });

    const existing = await Vehicle.findOne({ where: { plateNumber: plateNumber.toUpperCase() } });
    if (existing) return res.status(409).json({ message: 'Vehicle already exists' });

    const vehicle = await Vehicle.create({ plateNumber: plateNumber.toUpperCase(), type, size, notes, coeExpiry: coeExpiry || null, roadTaxExpiry: roadTaxExpiry || null, insuranceExpiry: insuranceExpiry || null, inspectionDue: inspectionDue || null, mileage: mileage || null });
    res.status(201).json(vehicle);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', rbac('admin'), async (req, res) => {
  try {
    const vehicle = await Vehicle.findByPk(req.params.id);
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });
    const { plateNumber, type, size, status, notes, coeExpiry, roadTaxExpiry, insuranceExpiry, inspectionDue, mileage } = req.body;
    await vehicle.update({ plateNumber, type, size, status, notes, coeExpiry: coeExpiry || null, roadTaxExpiry: roadTaxExpiry || null, insuranceExpiry: insuranceExpiry || null, inspectionDue: inspectionDue || null, mileage: mileage || null });
    res.json(vehicle);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', rbac('admin'), async (req, res) => {
  try {
    const vehicle = await Vehicle.findByPk(req.params.id);
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });
    await vehicle.update({ status: 'retired' });
    res.json({ message: 'Vehicle retired' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Hard delete — permanently removes the vehicle. Admin-only, blocked if any
// job/expense/driver assignment references it.
router.delete('/:id/permanent', rbac('admin'), async (req, res) => {
  try {
    const vehicle = await Vehicle.findByPk(req.params.id);
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });

    const [jobCount, expenseCount, driverCount] = await Promise.all([
      Job.count({ where: { vehicleId: vehicle.id } }),
      Expense.count({ where: { vehicleId: vehicle.id } }),
      Driver.count({ where: { assignedVehicleId: vehicle.id } }),
    ]);
    const blockers = [];
    if (jobCount) blockers.push(`${jobCount} job(s)`);
    if (expenseCount) blockers.push(`${expenseCount} expense(s)`);
    if (driverCount) blockers.push(`${driverCount} driver(s) assigned`);
    if (blockers.length) {
      return res.status(409).json({ message: `Cannot permanently delete: this vehicle has ${blockers.join(', ')}. Remove those first.` });
    }

    await vehicle.destroy();
    res.json({ message: 'Vehicle permanently deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
