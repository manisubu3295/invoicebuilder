require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { sequelize, Invoice } = require('./models');
const logger = require('./config/logger');

const app = express();
const isProd = process.env.NODE_ENV === 'production';

// Security headers — disable CSP so PDF/CDN assets load correctly
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// Request logging — always writes to the daily rotated file in backend/logs/,
// and additionally echoes to the console outside production (see logger.js)
app.use(morgan('combined', { stream: logger.stream }));

// Gzip compression
app.use(compression());

// CORS — the website itself is same-origin in prod (this server serves both
// the API and the built frontend), so browsers never need CORS headers for
// it — but they still send an Origin header on many requests regardless,
// and that must never be rejected. The Capacitor Android app is genuinely
// cross-origin (calls this API from https://localhost), so CORS does need
// to be mounted in prod for that. Explicitly allow-listed extra origins
// (env-configured dev frontend, Capacitor) plus — critically — any request
// whose Origin actually matches this server's own host.
//
// Compared by host only (not full protocol://host) because production runs
// behind a reverse proxy (nginx) that terminates HTTPS and forwards to Node
// over plain HTTP — req.protocol reads back as 'http' even though the
// browser's real Origin is https://..., so a scheme-inclusive comparison
// fails here. req.get('host') reflects the original Host header the proxy
// forwards, so it's reliable regardless of proxy TLS setup.
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'https://localhost', // Capacitor Android (androidScheme: 'https')
  'capacitor://localhost', // Capacitor iOS / older Android WebView origin scheme
];
app.use((req, res, next) => {
  const selfHost = req.get('host');
  cors({
    origin: (origin, callback) => {
      // No Origin header (same-origin requests, curl, server-to-server) — allow
      if (!origin) return callback(null, true);
      let originHost;
      try { originHost = new URL(origin).host; } catch { originHost = null; }
      if (originHost === selfHost || allowedOrigins.includes(origin)) return callback(null, true);
      const corsErr = new Error('Cross-origin request blocked');
      corsErr.status = 403;
      callback(corsErr);
    },
    credentials: true,
  })(req, res, next);
});

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
app.use('/api/categories',   require('./routes/categories'));

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
  logger.error(err.message, {
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
  });
  // CORS rejections (err.status 403) are safe to surface as-is even in prod —
  // unlike other errors, the message reveals nothing sensitive and hiding it
  // just makes a deliberate rejection look like a server malfunction.
  res.status(err.status || 500).json({
    message: (isProd && err.status !== 403) ? 'Internal server error' : err.message,
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
      username: 'admin',
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
    logger.info('Seeded: admin user (username: admin) + SMM client');
  }

  // Patch any users missing a username (schema upgrade from email-login system)
  const { Op } = require('sequelize');
  const noUsername = await User.findAll({ where: { username: null } });
  for (const u of noUsername) {
    let base = u.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'user';
    let candidate = base;
    let i = 1;
    while (await User.findOne({ where: { username: candidate, id: { [Op.ne]: u.id } } })) {
      candidate = `${base}_${i++}`;
    }
    await u.update({ username: candidate });
    logger.info(`Assigned username "${candidate}" to user ${u.name}`);
  }
}

async function markOverdueInvoices() {
  const { Op } = require('sequelize');
  const today = new Date(); today.setHours(23, 59, 59, 999);
  const count = await Invoice.update(
    { status: 'overdue' },
    { where: { status: 'sent', dueDate: { [Op.lt]: today } } }
  );
  if (count[0] > 0) logger.info(`Marked ${count[0]} invoice(s) as overdue`);
}

async function startServer() {
  // Warn about insecure defaults in production
  if (isProd) {
    const weak = ['change_this', 'password', 'secret', 'your_', 'changeme'];
    const jwt = process.env.JWT_SECRET || '';
    if (jwt.length < 32 || weak.some(w => jwt.toLowerCase().includes(w))) {
      logger.warn('JWT_SECRET appears weak. Set a strong random secret in production.');
    }
    if (!process.env.DB_PASSWORD || process.env.DB_PASSWORD === 'password') {
      logger.warn('DB_PASSWORD is not set or is using the default value.');
    }
  }

  try {
    // alter: { drop: false } adds new columns but never drops existing ones — safe for production
    await sequelize.sync({ alter: { drop: false } });
    logger.info('Database ready (PostgreSQL)');
    await require('./services/testMode').loadTestMode();
    await seedIfEmpty();
    await markOverdueInvoices();
    setInterval(markOverdueInvoices, 60 * 60 * 1000);
    require('./services/backupService').scheduleDailyBackups();

    const server = app.listen(PORT, () =>
      logger.info(`AKB API running on http://localhost:${PORT} [${process.env.NODE_ENV || 'development'}]`)
    );

    // Graceful shutdown
    const shutdown = (signal) => {
      logger.info(`${signal} received. Shutting down gracefully…`);
      server.close(() => {
        sequelize.close();
        logger.info('Server closed.');
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 10000); // force-exit after 10s
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));

  } catch (err) {
    logger.error('Startup failed', { message: err.message, stack: err.stack });
    process.exit(1);
  }
}

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection', { reason: reason?.stack || reason });
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', { message: err.message, stack: err.stack });
  process.exit(1);
});

startServer();

module.exports = app;
