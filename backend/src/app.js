require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { sequelize, Invoice } = require('./models');

const app = express();
const isProd = process.env.NODE_ENV === 'production';

// Security headers — disable CSP so PDF/CDN assets load correctly
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// Request logging (combined in prod, dev format otherwise)
app.use(morgan(isProd ? 'combined' : 'dev'));

// Gzip compression
app.use(compression());

// CORS — only needed in dev; in prod the frontend is served from the same origin
if (!isProd) {
  app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  }));
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
}));

app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
}));

// API routes
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/clients',      require('./routes/clients'));
app.use('/api/invoices',     require('./routes/invoices'));
app.use('/api/quotations',   require('./routes/quotations'));
app.use('/api/jobs',         require('./routes/jobs'));
app.use('/api/drivers',      require('./routes/drivers'));
app.use('/api/vehicles',     require('./routes/vehicles'));
app.use('/api/reports',      require('./routes/reports'));
app.use('/api/users',        require('./routes/users'));
app.use('/api/settings',     require('./routes/settings'));
app.use('/api/deliveries',   require('./routes/deliveries'));
app.use('/api/item-catalog', require('./routes/itemCatalog'));
app.use('/api/job-attendance', require('./routes/jobAttendance'));
app.use('/api/expenses',     require('./routes/expenses'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// Serve built frontend in production (same-origin, no CORS needed)
if (isProd) {
  const distPath = path.join(__dirname, '../../frontend/dist');
  // Hashed assets (/assets/*) — cache immutably since hash changes on every build
  app.use('/assets', express.static(path.join(distPath, 'assets'), {
    maxAge: '1y', immutable: true,
  }));
  // Everything else (index.html, favicon, etc.) — never cache so browsers always get the latest HTML
  app.use(express.static(distPath, {
    maxAge: 0,
    setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate'),
  }));
  // SPA fallback — all non-API routes serve index.html
  app.get('/{*path}', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: isProd ? 'Internal server error' : err.message,
  });
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
      email: process.env.ADMIN_EMAIL || 'akbtransportlogistics@gmail.com',
      passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@AKB2026', 10),
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
    await sequelize.sync({ force: false, alter: true });
    console.log('Database ready (PostgreSQL)');
    await seedIfEmpty();
    await markOverdueInvoices();
    setInterval(markOverdueInvoices, 60 * 60 * 1000);

    const server = app.listen(PORT, () =>
      console.log(`AKB API running on http://localhost:${PORT} [${process.env.NODE_ENV || 'development'}]`)
    );

    // Graceful shutdown
    const shutdown = (signal) => {
      console.log(`${signal} received. Shutting down gracefully…`);
      server.close(() => {
        sequelize.close();
        console.log('Server closed.');
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 10000); // force-exit after 10s
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));

  } catch (err) {
    console.error('Startup failed:', err.message);
    process.exit(1);
  }
}

startServer();

module.exports = app;
