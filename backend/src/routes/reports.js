const router = require('express').Router();
const { Invoice, InvoiceItem, Client, Payment, Job, Driver, Vehicle, User, JobAttendance, Expense, CompanySettings, Quotation } = require('../models');
const { sequelize } = require('../models');
const {
  generateSOAPDF, generatePayrollPDF, generateFleetCompliancePDF,
  generateRevenuePDF, generateAgingPDF, generateClientSummaryPDF, generateDriverReportPDF, generateVehicleReportPDF,
  generateExpenseReportPDF, generateAttendancePDF, generatePnlPDF, generateJobSummaryPDF, generateArActionPDF,
} = require('../services/pdfService');
const { Op, fn, col, literal } = require('sequelize');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');

router.use(auth, rbac('admin', 'staff'));

router.get('/dashboard', async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [monthRevenue] = await Invoice.findAll({
      where: { status: 'paid', paidDate: { [Op.gte]: startOfMonth }, isTest: false },
      attributes: [[fn('SUM', col('totalAmount')), 'total']],
      raw: true,
    });

    const [yearRevenue] = await Invoice.findAll({
      where: { status: 'paid', paidDate: { [Op.gte]: startOfYear }, isTest: false },
      attributes: [[fn('SUM', col('totalAmount')), 'total']],
      raw: true,
    });

    // Outstanding = every unpaid, non-cancelled invoice. Drafts count too:
    // invoices are often printed or WhatsApped without ever being "marked
    // sent", but the money is still owed. Partial payments already recorded
    // against these invoices are deducted.
    const unpaidWhere = { status: { [Op.in]: ['draft', 'sent', 'overdue'] }, isTest: false };
    const outstandingCount = await Invoice.count({ where: unpaidWhere });
    const [outstandingTotal] = await Invoice.findAll({
      where: unpaidWhere,
      attributes: [[fn('SUM', col('totalAmount')), 'total']],
      raw: true,
    });
    const [outstandingPaid] = await Payment.findAll({
      attributes: [[fn('SUM', col('Payment.amount')), 'total']],
      include: [{ model: Invoice, attributes: [], where: unpaidWhere }],
      raw: true,
    });
    const outstandingAmount = Math.max(0,
      parseFloat(outstandingTotal?.total || 0) - parseFloat(outstandingPaid?.total || 0));

    const activeJobs = await Job.count({ where: { status: { [Op.in]: ['pending', 'in_transit'] } } });
    const overdueInvoices = await Invoice.count({ where: { status: 'overdue', isTest: false } });

    const openQuotationStatuses = ['draft', 'sent', 'accepted'];
    const openQuotationsCount = await Quotation.count({ where: { status: { [Op.in]: openQuotationStatuses }, isTest: false } });
    const [openQuotationsAmount] = await Quotation.findAll({
      where: { status: { [Op.in]: openQuotationStatuses }, isTest: false },
      attributes: [[fn('SUM', col('totalAmount')), 'total']],
      raw: true,
    });

    const recentInvoices = await Invoice.findAll({
      where: { isTest: false },
      include: [{ model: Client, as: 'client', attributes: ['companyName'] }],
      order: [['createdAt', 'DESC']],
      limit: 10,
    });

    const todayJobs = await Job.findAll({
      where: {
        status: { [Op.in]: ['pending', 'in_transit'] },
        fromDate: { [Op.lte]: now },
        toDate: { [Op.gte]: now },
      },
      include: [{ model: Client, as: 'client', attributes: ['companyName'] }],
      limit: 10,
    });

    // Expiry alerts: anything expiring within 30 days
    const in30 = new Date(); in30.setDate(in30.getDate() + 30);
    const todayStr = now.toISOString().slice(0, 10);
    const in30Str = in30.toISOString().slice(0, 10);

    const vehiclesRaw = await Vehicle.findAll({ where: { status: 'active' } });
    const expiryAlerts = [];
    for (const v of vehiclesRaw) {
      const checks = [
        { label: 'COE', date: v.coeExpiry },
        { label: 'Road Tax', date: v.roadTaxExpiry },
        { label: 'Insurance', date: v.insuranceExpiry },
        { label: 'Inspection', date: v.inspectionDue },
      ];
      for (const c of checks) {
        if (c.date && c.date <= in30Str) {
          const days = Math.ceil((new Date(c.date) - now) / 86400000);
          expiryAlerts.push({ type: 'vehicle', plate: v.plateNumber, label: c.label, date: c.date, days, expired: days < 0 });
        }
      }
    }
    const driversRaw = await Driver.findAll({ include: [{ model: User, as: 'user', attributes: ['name'] }] });
    for (const d of driversRaw) {
      if (d.licenseExpiry && d.licenseExpiry <= in30Str) {
        const days = Math.ceil((new Date(d.licenseExpiry) - now) / 86400000);
        expiryAlerts.push({ type: 'driver', name: d.user?.name, label: 'License', date: d.licenseExpiry, days, expired: days < 0 });
      }
    }

    const pendingExpenses = await Expense.count({ where: { status: 'pending' } });

    res.json({
      monthRevenue: parseFloat(monthRevenue?.total || 0),
      yearRevenue: parseFloat(yearRevenue?.total || 0),
      outstandingCount,
      outstandingAmount,
      activeJobs,
      overdueInvoices,
      openQuotationsCount,
      openQuotationsAmount: parseFloat(openQuotationsAmount?.total || 0),
      recentInvoices,
      todayJobs,
      expiryAlerts: expiryAlerts.sort((a, b) => a.days - b.days),
      pendingExpenses,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

async function getRevenueData(year) {
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);

  const monthly = await Invoice.findAll({
    where: { status: 'paid', paidDate: { [Op.between]: [startDate, endDate] }, isTest: false },
    attributes: [
      [fn('date_part', 'month', col('paidDate')), 'month'],
      [fn('SUM', col('totalAmount')), 'total'],
      [fn('COUNT', col('id')), 'count'],
    ],
    group: [fn('date_part', 'month', col('paidDate'))],
    order: [[fn('date_part', 'month', col('paidDate')), 'ASC']],
    raw: true,
  });

  return Array.from({ length: 12 }, (_, i) => {
    const found = monthly.find(m => parseInt(m.month) === i + 1);
    return { month: i + 1, total: parseFloat(found?.total || 0), count: parseInt(found?.count || 0) };
  });
}

router.get('/revenue', async (req, res) => {
  try {
    const { year = new Date().getFullYear() } = req.query;
    const months = await getRevenueData(year);
    res.json({ year, months });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/revenue/pdf', async (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear();
    const months = await getRevenueData(year);
    const settings = (await CompanySettings.findOne()) || {};
    const buffer = await generateRevenuePDF(months, year, settings.toJSON ? settings.toJSON() : settings);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="revenue-${year}.pdf"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

async function getAgingData() {
  const invoices = await Invoice.findAll({
    where: { status: { [Op.in]: ['sent', 'overdue'] }, isTest: false },
    include: [{ model: Client, as: 'client', attributes: ['companyName', 'email'] }],
    order: [['date', 'ASC']],
  });

  const now = new Date();
  const aged = invoices.map(inv => {
    const days = Math.floor((now - new Date(inv.date)) / (1000 * 60 * 60 * 24));
    let bucket;
    if (days <= 30) bucket = '0-30';
    else if (days <= 60) bucket = '31-60';
    else bucket = '60+';
    return { ...inv.toJSON(), daysOverdue: days, bucket };
  });

  return {
    '0-30': aged.filter(i => i.bucket === '0-30'),
    '31-60': aged.filter(i => i.bucket === '31-60'),
    '60+': aged.filter(i => i.bucket === '60+'),
  };
}

router.get('/aging', async (req, res) => {
  try {
    res.json(await getAgingData());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/aging/pdf', async (req, res) => {
  try {
    const aging = await getAgingData();
    const settings = (await CompanySettings.findOne()) || {};
    const buffer = await generateAgingPDF(aging, settings.toJSON ? settings.toJSON() : settings);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="invoice-aging.pdf"');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

async function getClientSummaryData() {
  const clients = await Client.findAll({
    include: [
      {
        model: Invoice,
        as: 'invoices',
        attributes: ['id', 'totalAmount', 'status'],
        where: { isTest: false },
        required: false,
      },
    ],
  });

  const summary = clients.map(c => {
    const invoices = c.invoices || [];
    const total = invoices.reduce((s, i) => s + parseFloat(i.totalAmount || 0), 0);
    const paid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + parseFloat(i.totalAmount || 0), 0);
    const outstanding = invoices.filter(i => ['draft', 'sent', 'overdue'].includes(i.status)).reduce((s, i) => s + parseFloat(i.totalAmount || 0), 0);
    return {
      id: c.id,
      companyName: c.companyName,
      clientCode: c.clientCode,
      invoiceCount: invoices.length,
      totalBilled: total,
      totalPaid: paid,
      outstanding,
    };
  });

  return summary.sort((a, b) => b.totalBilled - a.totalBilled);
}

router.get('/client-summary', async (req, res) => {
  try {
    res.json(await getClientSummaryData());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/client-summary/pdf', async (req, res) => {
  try {
    const clients = await getClientSummaryData();
    const settings = (await CompanySettings.findOne()) || {};
    const buffer = await generateClientSummaryPDF(clients, settings.toJSON ? settings.toJSON() : settings);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="client-summary.pdf"');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

async function getDriverSummaryData() {
  const drivers = await Driver.findAll({
    include: [
      { model: User, as: 'user', attributes: ['id', 'name', 'email'] },
      {
        model: Job,
        as: 'jobs',
        attributes: ['id', 'status', 'fromDate', 'toDate'],
        include: [{ model: Invoice, as: 'invoice', attributes: ['id', 'totalAmount', 'status'], where: { isTest: false }, required: false }],
      },
      { model: JobAttendance, as: 'attendance', attributes: ['id', 'date', 'status'] },
    ],
  });

  const summary = drivers.map(d => {
    const jobs = d.jobs || [];
    const attendance = d.attendance || [];
    const completedJobs = jobs.filter(j => j.status === 'delivered').length;
    const daysWorked = attendance.filter(a => a.status === 'completed').length;
    const linkedRevenue = jobs.reduce((s, j) => {
      if (j.invoice && j.invoice.status === 'paid') return s + parseFloat(j.invoice.totalAmount || 0);
      return s;
    }, 0);
    return {
      driverId: d.id,
      name: d.user?.name || 'Unknown',
      email: d.user?.email,
      totalJobs: jobs.length,
      completedJobs,
      daysWorked,
      linkedRevenue,
    };
  });

  return summary.sort((a, b) => b.totalJobs - a.totalJobs);
}

router.get('/driver-summary', async (req, res) => {
  try {
    res.json(await getDriverSummaryData());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/driver-summary/pdf', async (req, res) => {
  try {
    const drivers = await getDriverSummaryData();
    const settings = (await CompanySettings.findOne()) || {};
    const buffer = await generateDriverReportPDF(drivers, settings.toJSON ? settings.toJSON() : settings);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="driver-report.pdf"');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

async function getVehicleSummaryData() {
  const vehicles = await Vehicle.findAll({
    include: [
      {
        model: Job,
        as: 'jobs',
        attributes: ['id', 'status', 'fromDate', 'toDate'],
      },
    ],
  });

  const summary = vehicles.map(v => {
    const jobs = v.jobs || [];
    const completedJobs = jobs.filter(j => j.status === 'delivered').length;
    const totalDays = jobs.reduce((s, j) => {
      if (!j.fromDate || !j.toDate) return s;
      const diff = Math.ceil((new Date(j.toDate) - new Date(j.fromDate)) / (1000 * 60 * 60 * 24)) + 1;
      return s + Math.max(1, diff);
    }, 0);
    return {
      vehicleId: v.id,
      plateNumber: v.plateNumber,
      type: v.type,
      size: v.size,
      status: v.status,
      totalJobs: jobs.length,
      completedJobs,
      totalDays,
    };
  });

  return summary.sort((a, b) => b.totalJobs - a.totalJobs);
}

router.get('/vehicle-summary', async (req, res) => {
  try {
    res.json(await getVehicleSummaryData());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/vehicle-summary/pdf', async (req, res) => {
  try {
    const vehicles = await getVehicleSummaryData();
    const settings = (await CompanySettings.findOne()) || {};
    const buffer = await generateVehicleReportPDF(vehicles, settings.toJSON ? settings.toJSON() : settings);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="vehicle-report.pdf"');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

async function getExpenseSummaryData() {
  const expenses = await Expense.findAll({
    include: [
      {
        model: Driver,
        as: 'driver',
        include: [{ model: User, as: 'user', attributes: ['id', 'name'] }],
      },
      { model: Vehicle, as: 'vehicle', attributes: ['id', 'plateNumber', 'type'] },
    ],
    order: [['date', 'DESC']],
  });

  // Driver summary
  const driverMap = {};
  for (const e of expenses) {
    const key = e.driverId;
    if (!driverMap[key]) {
      driverMap[key] = {
        driverId: key,
        name: e.driver?.user?.name || 'Unknown',
        total: 0, approved: 0, pending: 0, rejected: 0,
        byCategory: {},
      };
    }
    const amt = parseFloat(e.amount || 0);
    driverMap[key].total += amt;
    driverMap[key][e.status] = (driverMap[key][e.status] || 0) + amt;
    driverMap[key].byCategory[e.category] = (driverMap[key].byCategory[e.category] || 0) + amt;
  }

  // Vehicle fuel summary
  const vehicleMap = {};
  for (const e of expenses) {
    if (!e.vehicleId || !['fuel_petrol', 'fuel_diesel'].includes(e.category)) continue;
    const key = e.vehicleId;
    if (!vehicleMap[key]) {
      vehicleMap[key] = {
        vehicleId: key,
        plateNumber: e.vehicle?.plateNumber || 'Unknown',
        type: e.vehicle?.type || '',
        petrolCost: 0, petrolLiters: 0,
        dieselCost: 0, dieselLiters: 0,
      };
    }
    const amt = parseFloat(e.amount || 0);
    const liters = parseFloat(e.fuelLiters || 0);
    if (e.category === 'fuel_petrol') {
      vehicleMap[key].petrolCost += amt;
      vehicleMap[key].petrolLiters += liters;
    } else {
      vehicleMap[key].dieselCost += amt;
      vehicleMap[key].dieselLiters += liters;
    }
  }

  return {
    driverSummary: Object.values(driverMap).sort((a, b) => b.total - a.total),
    vehicleFuel: Object.values(vehicleMap).sort((a, b) => (b.petrolCost + b.dieselCost) - (a.petrolCost + a.dieselCost)),
  };
}

router.get('/expense-summary', async (req, res) => {
  try {
    res.json(await getExpenseSummaryData());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/expense-summary/pdf', async (req, res) => {
  try {
    const expenseSummary = await getExpenseSummaryData();
    const settings = (await CompanySettings.findOne()) || {};
    const buffer = await generateExpenseReportPDF(expenseSummary, settings.toJSON ? settings.toJSON() : settings);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="expense-report.pdf"');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

async function getAttendanceData(year, month) {
  const whereDate = month
    ? { [Op.between]: [`${year}-${String(month).padStart(2,'0')}-01`, `${year}-${String(month).padStart(2,'0')}-31`] }
    : { [Op.between]: [`${year}-01-01`, `${year}-12-31`] };

  const records = await JobAttendance.findAll({
    where: { date: whereDate, status: 'completed' },
    include: [
      { model: Driver, as: 'driver', include: [{ model: User, as: 'user', attributes: ['name'] }] },
      { model: Job, as: 'job', attributes: ['description'] },
    ],
    order: [['date', 'ASC']],
  });

  // Group by driver → by month
  const driverMap = {};
  for (const r of records) {
    const dId = r.driverId;
    const mo = r.date.slice(0, 7); // YYYY-MM
    if (!driverMap[dId]) {
      driverMap[dId] = { driverId: dId, name: r.driver?.user?.name || 'Unknown', months: {}, totalDays: 0 };
    }
    if (!driverMap[dId].months[mo]) driverMap[dId].months[mo] = 0;
    driverMap[dId].months[mo]++;
    driverMap[dId].totalDays++;
  }

  return Object.values(driverMap).sort((a, b) => b.totalDays - a.totalDays);
}

// GET /api/reports/attendance?year=YYYY&month=MM
router.get('/attendance', async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = req.query.month ? parseInt(req.query.month) : null;
    res.json(await getAttendanceData(year, month));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/attendance/pdf', async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = req.query.month ? parseInt(req.query.month) : null;
    const attendanceData = await getAttendanceData(year, month);
    const settings = (await CompanySettings.findOne()) || {};
    const buffer = await generateAttendancePDF(attendanceData, year, month, settings.toJSON ? settings.toJSON() : settings);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="attendance-${year}${month ? '-' + month : ''}.pdf"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

async function getPnlData(year) {
  const start = `${year}-01-01`, end = `${year}-12-31`;

  const paidInvoices = await Invoice.findAll({
    where: { status: 'paid', paidDate: { [Op.between]: [start, end] }, isTest: false },
    attributes: ['paidDate', 'totalAmount'],
    raw: true,
  });

  const approvedExpenses = await Expense.findAll({
    where: { status: 'approved', date: { [Op.between]: [start, end] } },
    attributes: ['date', 'amount', 'category'],
    raw: true,
  });

  const months = Array.from({ length: 12 }, (_, i) => {
    const mo = String(i + 1).padStart(2, '0');
    const rev = paidInvoices.filter(inv => inv.paidDate?.startsWith(`${year}-${mo}`)).reduce((s, inv) => s + parseFloat(inv.totalAmount || 0), 0);
    const exp = approvedExpenses.filter(e => e.date?.startsWith(`${year}-${mo}`)).reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    return { month: i + 1, revenue: rev, expenses: exp, profit: rev - exp };
  });

  const totalRevenue = months.reduce((s, m) => s + m.revenue, 0);
  const totalExpenses = months.reduce((s, m) => s + m.expenses, 0);

  // Job profitability: per job, invoice revenue vs approved expenses
  const jobs = await Job.findAll({
    include: [
      { model: Invoice, as: 'invoice', attributes: ['totalAmount', 'status'], where: { isTest: false }, required: false },
      { model: Expense, as: 'expenses', where: { status: 'approved' }, required: false, attributes: ['amount'] },
      { model: Client, as: 'client', attributes: ['companyName'] },
      { model: Driver, as: 'driver', include: [{ model: User, as: 'user', attributes: ['name'] }] },
    ],
    where: { fromDate: { [Op.between]: [start, end] } },
  });

  const jobProfitability = jobs.map(j => {
    const revenue = j.invoice?.status === 'paid' ? parseFloat(j.invoice.totalAmount || 0) : 0;
    const expenses = (j.expenses || []).reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    return {
      jobId: j.id,
      description: j.description,
      client: j.client?.companyName,
      driver: j.driver?.user?.name,
      fromDate: j.fromDate,
      toDate: j.toDate,
      revenue,
      expenses,
      profit: revenue - expenses,
      invoiced: !!j.invoice,
    };
  }).sort((a, b) => b.profit - a.profit);

  return { year, months, totalRevenue, totalExpenses, totalProfit: totalRevenue - totalExpenses, jobProfitability };
}

// GET /api/reports/pnl?year=YYYY
router.get('/pnl', async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    res.json(await getPnlData(year));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/pnl/pdf', async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const pnlData = await getPnlData(year);
    const settings = (await CompanySettings.findOne()) || {};
    const buffer = await generatePnlPDF(pnlData, settings.toJSON ? settings.toJSON() : settings);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="pnl-${year}.pdf"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Statement of Account ──
// Balance-forward statement: opening balance (activity before fromDate) + a dated
// ledger of invoice debits / payment credits within [fromDate, toDate] + running balance.
// `status` narrows the invoice set the whole statement is built from ('sent'|'overdue'|'paid'
// or omitted/'all' for everything except draft/cancelled, which are never real receivables).
async function buildSoaData(clientId, { fromDate, toDate, status } = {}) {
  const client = await Client.findByPk(clientId);
  if (!client) return null;

  const statusWhere = status && status !== 'all'
    ? { status }
    : { status: { [Op.notIn]: ['draft', 'cancelled'] } };

  const invoices = await Invoice.findAll({
    where: { clientId, isTest: false, ...statusWhere },
    include: [
      { model: InvoiceItem, as: 'items' },
      { model: Payment, as: 'payments', order: [['paymentDate', 'ASC']] },
    ],
    order: [['date', 'ASC']],
  });

  const effTo = toDate || new Date().toISOString().slice(0, 10);

  let openingBalance = 0;
  const ledger = [];

  for (const inv of invoices) {
    const invDate = inv.date;
    if (fromDate && invDate < fromDate) {
      openingBalance += parseFloat(inv.totalAmount || 0);
    } else if (invDate <= effTo) {
      ledger.push({
        date: invDate, type: 'invoice', ref: inv.invoiceNo,
        status: inv.status, debit: parseFloat(inv.totalAmount || 0), credit: 0,
      });
    }
    for (const p of inv.payments || []) {
      if (fromDate && p.paymentDate < fromDate) {
        openingBalance -= parseFloat(p.amount || 0);
      } else if (p.paymentDate <= effTo) {
        ledger.push({
          date: p.paymentDate, type: 'payment', ref: inv.invoiceNo,
          debit: 0, credit: parseFloat(p.amount || 0),
        });
      }
    }
  }

  ledger.sort((a, b) => a.date.localeCompare(b.date));
  let running = openingBalance;
  for (const row of ledger) { running += row.debit - row.credit; row.balance = running; }
  const closingBalance = running;

  const totalInvoicedInPeriod = ledger.reduce((s, r) => s + r.debit, 0);
  const totalPaidInPeriod = ledger.reduce((s, r) => s + r.credit, 0);

  // Aging buckets, for invoices still carrying a balance as of effTo
  const aging = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 };
  for (const inv of invoices) {
    if (inv.date > effTo) continue;
    const paid = (inv.payments || [])
      .filter(p => p.paymentDate <= effTo)
      .reduce((s, p) => s + parseFloat(p.amount || 0), 0);
    const bal = parseFloat(inv.totalAmount || 0) - paid;
    if (bal <= 0.005) continue;
    const dueDate = inv.dueDate || inv.date;
    const daysOverdue = Math.floor((new Date(effTo) - new Date(dueDate)) / 86400000);
    if (daysOverdue <= 0) aging.current += bal;
    else if (daysOverdue <= 30) aging.d1_30 += bal;
    else if (daysOverdue <= 60) aging.d31_60 += bal;
    else if (daysOverdue <= 90) aging.d61_90 += bal;
    else aging.d90plus += bal;
  }

  return {
    client, invoices, ledger,
    period: { fromDate: fromDate || null, toDate: effTo, status: status || 'all' },
    summary: { openingBalance, totalInvoicedInPeriod, totalPaidInPeriod, closingBalance },
    aging,
  };
}

router.get('/soa/:clientId', async (req, res) => {
  try {
    const data = await buildSoaData(req.params.clientId, req.query);
    if (!data) return res.status(404).json({ message: 'Client not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/soa/:clientId/pdf', async (req, res) => {
  try {
    const data = await buildSoaData(req.params.clientId, req.query);
    if (!data) return res.status(404).json({ message: 'Client not found' });

    const settings = (await CompanySettings.findOne()) || {};
    const buffer = await generateSOAPDF(
      data.client.toJSON(), data,
      settings.toJSON ? settings.toJSON() : settings
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="soa-${req.params.clientId}.pdf"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Payroll ──
router.get('/payroll', async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = req.query.month ? parseInt(req.query.month) : null;

    const start = month
      ? `${year}-${String(month).padStart(2,'0')}-01`
      : `${year}-01-01`;
    const end = month
      ? `${year}-${String(month).padStart(2,'0')}-31`
      : `${year}-12-31`;

    const drivers = await Driver.findAll({
      include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }],
    });

    const attendance = await JobAttendance.findAll({
      where: { date: { [Op.between]: [start, end] }, status: 'completed' },
      attributes: ['driverId'],
      raw: true,
    });

    const daysMap = {};
    for (const a of attendance) {
      daysMap[a.driverId] = (daysMap[a.driverId] || 0) + 1;
    }

    const rows = drivers.map(d => {
      const daysWorked = daysMap[d.id] || 0;
      const dailyRate = parseFloat(d.dailyRate || 0);
      const grossPay = daysWorked * dailyRate;
      const cpfEmployee = grossPay * 0.20;
      const cpfEmployer = grossPay * 0.17;
      const netPay = grossPay - cpfEmployee;
      return {
        driverId: d.id,
        name: d.user?.name || 'Unknown',
        email: d.user?.email || '',
        dailyRate,
        daysWorked,
        grossPay,
        cpfEmployee,
        cpfEmployer,
        netPay,
      };
    });

    res.json({ year, month, rows });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/payroll/pdf', async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = req.query.month ? parseInt(req.query.month) : null;

    const start = month
      ? `${year}-${String(month).padStart(2,'0')}-01`
      : `${year}-01-01`;
    const end = month
      ? `${year}-${String(month).padStart(2,'0')}-31`
      : `${year}-12-31`;

    const drivers = await Driver.findAll({
      include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }],
    });

    const attendance = await JobAttendance.findAll({
      where: { date: { [Op.between]: [start, end] }, status: 'completed' },
      attributes: ['driverId'],
      raw: true,
    });

    const daysMap = {};
    for (const a of attendance) {
      daysMap[a.driverId] = (daysMap[a.driverId] || 0) + 1;
    }

    const rows = drivers.map(d => {
      const daysWorked = daysMap[d.id] || 0;
      const dailyRate = parseFloat(d.dailyRate || 0);
      const grossPay = daysWorked * dailyRate;
      const cpfEmployee = grossPay * 0.20;
      const cpfEmployer = grossPay * 0.17;
      const netPay = grossPay - cpfEmployee;
      return { driverId: d.id, name: d.user?.name || 'Unknown', dailyRate, daysWorked, grossPay, cpfEmployee, cpfEmployer, netPay };
    });

    const settings = (await CompanySettings.findOne()) || {};
    const buffer = await generatePayrollPDF(rows, year, month, settings.toJSON ? settings.toJSON() : settings);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="payroll-${year}-${month || 'full'}.pdf"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Job Summary ──
async function getJobSummaryData(query) {
  const { from, to, status, clientId, driverId } = query;
  const where = {};
  if (from && to) where.fromDate = { [Op.between]: [from, to] };
  else if (from) where.fromDate = { [Op.gte]: from };
  else if (to) where.toDate = { [Op.lte]: to };
  if (status) where.status = status;
  if (clientId) where.clientId = clientId;
  if (driverId) where.driverId = driverId;

  const jobs = await Job.findAll({
    where,
    include: [
      { model: Client, as: 'client', attributes: ['companyName'] },
      { model: Driver, as: 'driver', include: [{ model: User, as: 'user', attributes: ['name'] }] },
      { model: Vehicle, as: 'vehicle', attributes: ['plateNumber', 'type'] },
      { model: Invoice, as: 'invoice', attributes: ['invoiceNo', 'totalAmount', 'status'], where: { isTest: false }, required: false },
    ],
    order: [['fromDate', 'DESC']],
  });

  return jobs.map(j => {
    const days = j.fromDate && j.toDate
      ? Math.ceil((new Date(j.toDate) - new Date(j.fromDate)) / 86400000) + 1
      : null;
    return {
      jobId: j.id,
      description: j.description,
      client: j.client?.companyName || '—',
      driver: j.driver?.user?.name || '—',
      vehicle: j.vehicle ? `${j.vehicle.plateNumber} (${j.vehicle.type})` : '—',
      fromDate: j.fromDate,
      toDate: j.toDate,
      days,
      status: j.status,
      invoiceNo: j.invoice?.invoiceNo || '—',
      invoiceStatus: j.invoice?.status || '—',
      amount: j.invoice ? parseFloat(j.invoice.totalAmount || 0) : 0,
    };
  });
}

router.get('/job-summary', async (req, res) => {
  try {
    res.json(await getJobSummaryData(req.query));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/job-summary/pdf', async (req, res) => {
  try {
    const jobs = await getJobSummaryData(req.query);
    const settings = (await CompanySettings.findOne()) || {};
    const buffer = await generateJobSummaryPDF(jobs, settings.toJSON ? settings.toJSON() : settings);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="job-summary.pdf"');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── A/R Action List ──
async function getArActionData() {
  const invoices = await Invoice.findAll({
    where: { status: { [Op.in]: ['sent', 'overdue'] }, isTest: false },
    include: [
      { model: Client, as: 'client', attributes: ['companyName', 'contactPerson', 'phone', 'email'] },
      { model: Payment, as: 'payments', attributes: ['amount', 'paymentDate'], order: [['paymentDate', 'DESC']] },
    ],
    order: [['dueDate', 'ASC']],
  });

  const now = new Date();
  const result = invoices.map(inv => {
    const due = inv.dueDate ? new Date(inv.dueDate) : new Date(inv.date);
    const daysOverdue = Math.floor((now - due) / 86400000);
    const payments = inv.payments || [];
    const lastPayment = payments.length ? payments.sort((a, b) => b.paymentDate > a.paymentDate ? 1 : -1)[0]?.paymentDate : null;
    return {
      invoiceId: inv.id,
      invoiceNo: inv.invoiceNo,
      clientName: inv.client?.companyName || '—',
      contactPerson: inv.client?.contactPerson || '—',
      phone: inv.client?.phone || '—',
      email: inv.client?.email || '—',
      amount: parseFloat(inv.totalAmount || 0),
      invoiceDate: inv.date,
      dueDate: inv.dueDate,
      status: inv.status,
      daysOverdue,
      lastPaymentDate: lastPayment || null,
    };
  });

  result.sort((a, b) => b.daysOverdue - a.daysOverdue);
  return result;
}

router.get('/ar-action', async (req, res) => {
  try {
    res.json(await getArActionData());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/ar-action/pdf', async (req, res) => {
  try {
    const arData = await getArActionData();
    const settings = (await CompanySettings.findOne()) || {};
    const buffer = await generateArActionPDF(arData, settings.toJSON ? settings.toJSON() : settings);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="ar-actions.pdf"');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Fleet Compliance PDF ──
router.get('/fleet-compliance/pdf', async (req, res) => {
  try {
    const vehicles = await Vehicle.findAll({ order: [['plateNumber', 'ASC']] });
    const settings = (await CompanySettings.findOne()) || {};
    const buffer = await generateFleetCompliancePDF(vehicles.map(v => v.toJSON()), settings.toJSON ? settings.toJSON() : settings);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="fleet-compliance.pdf"');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
