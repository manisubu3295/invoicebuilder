const router = require('express').Router();
const { Invoice, InvoiceItem, Client, Payment, Job, Driver, Vehicle, User, JobAttendance, Expense } = require('../models');
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
      where: { status: 'paid', paidDate: { [Op.gte]: startOfMonth } },
      attributes: [[fn('SUM', col('totalAmount')), 'total']],
      raw: true,
    });

    const [yearRevenue] = await Invoice.findAll({
      where: { status: 'paid', paidDate: { [Op.gte]: startOfYear } },
      attributes: [[fn('SUM', col('totalAmount')), 'total']],
      raw: true,
    });

    const outstandingCount = await Invoice.count({ where: { status: { [Op.in]: ['sent', 'overdue'] } } });
    const [outstandingAmount] = await Invoice.findAll({
      where: { status: { [Op.in]: ['sent', 'overdue'] } },
      attributes: [[fn('SUM', col('totalAmount')), 'total']],
      raw: true,
    });

    const activeJobs = await Job.count({ where: { status: { [Op.in]: ['pending', 'in_transit'] } } });
    const overdueInvoices = await Invoice.count({ where: { status: 'overdue' } });

    const recentInvoices = await Invoice.findAll({
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

    res.json({
      monthRevenue: parseFloat(monthRevenue?.total || 0),
      yearRevenue: parseFloat(yearRevenue?.total || 0),
      outstandingCount,
      outstandingAmount: parseFloat(outstandingAmount?.total || 0),
      activeJobs,
      overdueInvoices,
      recentInvoices,
      todayJobs,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/revenue', async (req, res) => {
  try {
    const { year = new Date().getFullYear() } = req.query;
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);

    const monthly = await Invoice.findAll({
      where: { status: 'paid', paidDate: { [Op.between]: [startDate, endDate] } },
      attributes: [
        [fn('strftime', '%m', col('paidDate')), 'month'],
        [fn('SUM', col('totalAmount')), 'total'],
        [fn('COUNT', col('id')), 'count'],
      ],
      group: [fn('strftime', '%m', col('paidDate'))],
      order: [[fn('strftime', '%m', col('paidDate')), 'ASC']],
      raw: true,
    });

    const months = Array.from({ length: 12 }, (_, i) => {
      const found = monthly.find(m => parseInt(m.month) === i + 1);
      return { month: i + 1, total: parseFloat(found?.total || 0), count: parseInt(found?.count || 0) };
    });

    res.json({ year, months });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/aging', async (req, res) => {
  try {
    const invoices = await Invoice.findAll({
      where: { status: { [Op.in]: ['sent', 'overdue'] } },
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

    const summary = {
      '0-30': aged.filter(i => i.bucket === '0-30'),
      '31-60': aged.filter(i => i.bucket === '31-60'),
      '60+': aged.filter(i => i.bucket === '60+'),
    };
    res.json(summary);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/client-summary', async (req, res) => {
  try {
    const clients = await Client.findAll({
      include: [
        {
          model: Invoice,
          as: 'invoices',
          attributes: ['id', 'totalAmount', 'status'],
        },
      ],
    });

    const summary = clients.map(c => {
      const invoices = c.invoices || [];
      const total = invoices.reduce((s, i) => s + parseFloat(i.totalAmount || 0), 0);
      const paid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + parseFloat(i.totalAmount || 0), 0);
      const outstanding = invoices.filter(i => ['sent', 'overdue'].includes(i.status)).reduce((s, i) => s + parseFloat(i.totalAmount || 0), 0);
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

    res.json(summary.sort((a, b) => b.totalBilled - a.totalBilled));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/driver-summary', async (req, res) => {
  try {
    const drivers = await Driver.findAll({
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'email'] },
        {
          model: Job,
          as: 'jobs',
          attributes: ['id', 'status', 'fromDate', 'toDate'],
          include: [{ model: Invoice, as: 'invoice', attributes: ['id', 'totalAmount', 'status'] }],
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

    res.json(summary.sort((a, b) => b.totalJobs - a.totalJobs));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/vehicle-summary', async (req, res) => {
  try {
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

    res.json(summary.sort((a, b) => b.totalJobs - a.totalJobs));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/expense-summary', async (req, res) => {
  try {
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

    res.json({
      driverSummary: Object.values(driverMap).sort((a, b) => b.total - a.total),
      vehicleFuel: Object.values(vehicleMap).sort((a, b) => (b.petrolCost + b.dieselCost) - (a.petrolCost + a.dieselCost)),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
