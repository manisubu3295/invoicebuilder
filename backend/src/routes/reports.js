const router = require('express').Router();
const { Invoice, InvoiceItem, Client, Payment, Job } = require('../models');
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

module.exports = router;
