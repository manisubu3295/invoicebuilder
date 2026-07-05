const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { User, Driver, DeliveryLog, Expense } = require('../models');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');

router.use(auth, rbac('admin'));

router.get('/', async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'name', 'username', 'role', 'phone', 'isActive', 'createdAt'],
      order: [['name', 'ASC']],
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, username, phone, password, role } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'Name is required' });
    if (!username || !username.trim()) return res.status(400).json({ message: 'Username is required' });
    if (!password) return res.status(400).json({ message: 'Password is required' });
    if (role === 'driver') return res.status(400).json({ message: 'Driver accounts must be created via the Drivers page.' });

    const clean = username.trim().toLowerCase();
    const existing = await User.findOne({ where: { username: clean } });
    if (existing) return res.status(409).json({ message: `Username "${clean}" is already taken` });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name: name.trim(), username: clean, phone, passwordHash, role: role || 'staff' });
    res.status(201).json({ id: user.id, name: user.name, username: user.username, role: user.role, isActive: user.isActive });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === 'driver') return res.status(400).json({ message: 'Driver accounts must be edited via the Drivers page.' });
    if (req.body.role === 'driver') return res.status(400).json({ message: 'Cannot assign driver role here. Create a driver via the Drivers page.' });

    const { name, phone, role, isActive, password } = req.body;
    const updates = { name, phone, role, isActive };
    if (password) updates.passwordHash = await bcrypt.hash(password, 10);

    await user.update(updates);
    res.json({ id: user.id, name: user.name, username: user.username, role: user.role, isActive: user.isActive });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Hard delete — permanently removes the account. Blocks self-delete, driver
// logins (delete the driver record instead), and users referenced elsewhere.
router.delete('/:id/permanent', async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ message: 'You cannot delete your own account.' });
    }
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const driverProfile = await Driver.findOne({ where: { userId: user.id } });
    if (driverProfile) {
      return res.status(409).json({ message: 'This is a driver login — delete the driver record from the Drivers page instead.' });
    }

    const [deliveryLogCount, expenseCount] = await Promise.all([
      DeliveryLog.count({ where: { deliveredById: user.id } }),
      Expense.count({ where: { approvedById: user.id } }),
    ]);
    const blockers = [];
    if (deliveryLogCount) blockers.push(`${deliveryLogCount} delivery log(s)`);
    if (expenseCount) blockers.push(`${expenseCount} approved expense(s)`);
    if (blockers.length) {
      return res.status(409).json({ message: `Cannot permanently delete: this user is referenced by ${blockers.join(', ')}.` });
    }

    await user.destroy();
    res.json({ message: 'User permanently deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
