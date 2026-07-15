const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const authMiddleware = require('../middleware/auth');
const { canToggleTestMode } = require('../services/testMode');
const logger = require('../config/logger');

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const ip = req.ip;
  try {
    if (!username || !password) return res.status(400).json({ message: 'Username and password required' });

    const user = await User.findOne({ where: { username } });
    if (!user) {
      logger.warn('Login failed: username not found', { username, ip });
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    if (!user.isActive) {
      logger.warn('Login failed: account inactive', { username, userId: user.id, ip });
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      logger.warn('Login failed: incorrect password', { username, userId: user.id, ip });
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    logger.info('Login succeeded', { username, userId: user.id, role: user.role, ip });
    const canTestMode = await canToggleTestMode(user);
    res.json({ token, user: { id: user.id, name: user.name, username: user.username, role: user.role, canToggleTestMode: canTestMode } });
  } catch (err) {
    logger.error('Login error', { username, ip, message: err.message, stack: err.stack });
    res.status(500).json({ message: err.message });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'name', 'username', 'role', 'phone'],
    });
    const canTestMode = await canToggleTestMode(user);
    res.json({ ...user.toJSON(), canToggleTestMode: canTestMode });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
