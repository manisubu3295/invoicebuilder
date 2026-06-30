const { Invoice, Quotation, CompanySettings } = require('../models');
const { Op } = require('sequelize');

async function getSettings() {
  const s = await CompanySettings.findOne();
  return {
    invoicePrefix: (s?.invoicePrefix || 'INV').trim(),
    invoiceStartNumber: parseInt(s?.invoiceStartNumber ?? 1, 10) || 1,
    quotationPrefix: (s?.quotationPrefix || 'QUO').trim(),
    quotationStartNumber: parseInt(s?.quotationStartNumber ?? 1, 10) || 1,
  };
}

async function generateInvoiceNumber() {
  const { invoicePrefix, invoiceStartNumber } = await getSettings();
  const all = await Invoice.findAll({
    where: { invoiceNo: { [Op.like]: `${invoicePrefix}-%` } },
    attributes: ['invoiceNo'],
  });
  let maxSeq = invoiceStartNumber - 1;
  for (const inv of all) {
    const seg = inv.invoiceNo.slice(invoicePrefix.length + 1);
    const n = parseInt(seg, 10);
    if (!isNaN(n) && n > maxSeq) maxSeq = n;
  }
  const seq = Math.max(maxSeq + 1, invoiceStartNumber);
  return `${invoicePrefix}-${String(seq).padStart(4, '0')}`;
}

async function generateQuotationNumber() {
  const { quotationPrefix, quotationStartNumber } = await getSettings();
  const all = await Quotation.findAll({
    where: { quotationNo: { [Op.like]: `${quotationPrefix}-%` } },
    attributes: ['quotationNo'],
  });
  let maxSeq = quotationStartNumber - 1;
  for (const q of all) {
    const seg = q.quotationNo.slice(quotationPrefix.length + 1);
    const n = parseInt(seg, 10);
    if (!isNaN(n) && n > maxSeq) maxSeq = n;
  }
  const seq = Math.max(maxSeq + 1, quotationStartNumber);
  return `${quotationPrefix}-${String(seq).padStart(4, '0')}`;
}

module.exports = { generateInvoiceNumber, generateQuotationNumber };
