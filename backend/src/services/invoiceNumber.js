const { Invoice, Quotation, CompanySettings, Client } = require('../models');
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

async function resolveInvoicePrefix(clientId) {
  if (clientId) {
    const client = await Client.findByPk(clientId, {
      attributes: ['invoicePrefix', 'invoiceStartNumber'],
    });
    if (client?.invoicePrefix?.trim()) {
      return {
        prefix: client.invoicePrefix.trim(),
        startNumber: parseInt(client.invoiceStartNumber ?? 1, 10) || 1,
      };
    }
  }
  const s = await getSettings();
  return { prefix: s.invoicePrefix, startNumber: s.invoiceStartNumber };
}

async function resolveQuotationPrefix(clientId) {
  if (clientId) {
    const client = await Client.findByPk(clientId, {
      attributes: ['quotationPrefix', 'quotationStartNumber'],
    });
    if (client?.quotationPrefix?.trim()) {
      return {
        prefix: client.quotationPrefix.trim(),
        startNumber: parseInt(client.quotationStartNumber ?? 1, 10) || 1,
      };
    }
  }
  const s = await getSettings();
  return { prefix: s.quotationPrefix, startNumber: s.quotationStartNumber };
}

async function generateInvoiceNumber(clientId) {
  const { prefix, startNumber } = await resolveInvoicePrefix(clientId);
  const all = await Invoice.findAll({
    where: { invoiceNo: { [Op.like]: `${prefix}-%` } },
    attributes: ['invoiceNo'],
  });
  let maxSeq = startNumber - 1;
  for (const inv of all) {
    const seg = inv.invoiceNo.slice(prefix.length + 1);
    const n = parseInt(seg, 10);
    if (!isNaN(n) && n > maxSeq) maxSeq = n;
  }
  const seq = Math.max(maxSeq + 1, startNumber);
  return `${prefix}-${String(seq).padStart(4, '0')}`;
}

async function generateQuotationNumber(clientId) {
  const { prefix, startNumber } = await resolveQuotationPrefix(clientId);
  const all = await Quotation.findAll({
    where: { quotationNo: { [Op.like]: `${prefix}-%` } },
    attributes: ['quotationNo'],
  });
  let maxSeq = startNumber - 1;
  for (const q of all) {
    const seg = q.quotationNo.slice(prefix.length + 1);
    const n = parseInt(seg, 10);
    if (!isNaN(n) && n > maxSeq) maxSeq = n;
  }
  const seq = Math.max(maxSeq + 1, startNumber);
  return `${prefix}-${String(seq).padStart(4, '0')}`;
}

module.exports = { generateInvoiceNumber, generateQuotationNumber };
