require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { sequelize, Invoice } = require('./models');

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/quotations', require('./routes/quotations'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/drivers', require('./routes/drivers'));
app.use('/api/vehicles', require('./routes/vehicles'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/users', require('./routes/users'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/deliveries', require('./routes/deliveries'));
app.use('/api/item-catalog', require('./routes/itemCatalog'));
app.use('/api/job-attendance', require('./routes/jobAttendance'));
app.use('/api/expenses', require('./routes/expenses'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;

const bcrypt = require('bcryptjs');
const { User, Client } = require('./models');

async function seedIfEmpty() {
  const count = await User.count();
  if (count === 0) {
    const { v4: uuidv4 } = require('uuid');
    await User.create({
      id: uuidv4(),
      name: 'AK.BALAN',
      email: 'akbtransportlogistics@gmail.com',
      passwordHash: await bcrypt.hash('Admin@AKB2026', 10),
      role: 'admin',
      phone: '+6584590123',
      isActive: true,
    });
    await Client.create({
      id: uuidv4(),
      companyName: 'Sri Murugan Manufacturing Pte. Ltd.',
      clientCode: 'SMM',
      contactPerson: 'Sri Murugan',
      email: null,
      phone: null,
      address: 'Singapore',
      isActive: true,
    });
    console.log('Seeded: admin user + SMM client');
  }
}

async function markOverdueInvoices() {
  const { Op } = require('sequelize');
  const today = new Date(); today.setHours(23, 59, 59, 999);
  const count = await Invoice.update(
    { status: 'overdue' },
    { where: { status: 'sent', dueDate: { [Op.lt]: today } } }
  );
  if (count[0] > 0) console.log(`Marked ${count[0]} invoice(s) as overdue`);
}

async function startServer() {
  try {
    await sequelize.query('PRAGMA foreign_keys = OFF');
    // Clean up any leftover backup tables from failed previous syncs
    const [tables] = await sequelize.query("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%_backup'");
    for (const { name } of tables) {
      await sequelize.query(`DROP TABLE IF EXISTS \`${name}\``);
    }
    await sequelize.sync({ force: false, alter: true });
    await sequelize.query('PRAGMA foreign_keys = ON');
    console.log('Database ready (SQLite)');
    await seedIfEmpty();
    await markOverdueInvoices();
    setInterval(markOverdueInvoices, 60 * 60 * 1000);
    app.listen(PORT, () => console.log(`AKB API running on http://localhost:${PORT}`));
  } catch (err) {
    console.error('DB connection failed:', err.message);
    process.exit(1);
  }
}

startServer();

module.exports = app;
