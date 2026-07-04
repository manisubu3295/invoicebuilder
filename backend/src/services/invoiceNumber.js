const { Invoice, Quotation, CompanySettings, Client } = require('../models');
const { Op } = require('sequelize');
const { isTestModeEnabled } = require('./testMode');

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

async function generateInvoiceNumber(clientId, isTest = false) {
  const { prefix: basePrefix, startNumber: baseStart } = await resolveInvoicePrefix(clientId);
  const prefix = isTest ? `TEST-${basePrefix}` : basePrefix;
  const startNumber = isTest ? 1 : baseStart;
  const all = await Invoice.findAll({
    where: { invoiceNo: { [Op.like]: `${prefix}-%` }, isTest },
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

async function generateQuotationNumber(clientId, isTest = false) {
  const { prefix: basePrefix, startNumber: baseStart } = await resolveQuotationPrefix(clientId);
  const prefix = isTest ? `TEST-${basePrefix}` : basePrefix;
  const startNumber = isTest ? 1 : baseStart;
  const all = await Quotation.findAll({
    where: { quotationNo: { [Op.like]: `${prefix}-%` }, isTest },
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

// Concurrent requests can compute the same "next" number before either row
// exists. The unique DB constraint rejects the second insert — retry with a
// freshly-computed number (which will now see the first row) instead of
// surfacing a spurious error to the user.
async function createWithRetry(model, generateNumber, numberField, clientId, data, isTest) {
  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const number = await generateNumber(clientId, isTest);
    try {
      return await model.create({ ...data, clientId, isTest, [numberField]: number });
    } catch (err) {
      const isDuplicateNumber = err.name === 'SequelizeUniqueConstraintError' &&
        err.errors?.some((e) => e.path === numberField);
      if (!isDuplicateNumber || attempt === maxAttempts) throw err;
    }
  }
}

function createInvoiceWithNumber(clientId, data) {
  return createWithRetry(Invoice, generateInvoiceNumber, 'invoiceNo', clientId, data, isTestModeEnabled());
}

function createQuotationWithNumber(clientId, data) {
  return createWithRetry(Quotation, generateQuotationNumber, 'quotationNo', clientId, data, isTestModeEnabled());
}

module.exports = {
  generateInvoiceNumber,
  generateQuotationNumber,
  createInvoiceWithNumber,
  createQuotationWithNumber,
};
