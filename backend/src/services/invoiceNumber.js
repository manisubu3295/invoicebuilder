const { Invoice, Quotation, CompanySettings, Client, Category } = require('../models');
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

// When a category is attached to an invoice, the number label combines the
// client's identifier (custom prefix override, or its short clientCode)
// with the category's own prefix, e.g. "SMM-TRN-0001" — but the sequence
// itself is scoped to the client, shared across every category, not reset
// per category. The client's own invoiceStartNumber (or the global default)
// always applies, regardless of whether a category is attached.
async function resolveInvoicePrefix(clientId, categoryId) {
  let clientPart = null;
  let clientStartNumber = null;
  if (clientId) {
    const client = await Client.findByPk(clientId, {
      attributes: ['invoicePrefix', 'invoiceStartNumber', 'clientCode'],
    });
    if (client) {
      clientPart = client.invoicePrefix?.trim() || client.clientCode?.trim() || null;
      clientStartNumber = parseInt(client.invoiceStartNumber ?? 1, 10) || 1;
    }
  }

  const s = await getSettings();
  const startNumber = clientPart ? (clientStartNumber || 1) : s.invoiceStartNumber;

  if (categoryId) {
    const category = await Category.findByPk(categoryId, { attributes: ['invoicePrefix'] });
    const categoryPart = category?.invoicePrefix?.trim();
    if (categoryPart) {
      const base = clientPart || s.invoicePrefix;
      return { prefix: `${base}-${categoryPart}`, startNumber };
    }
  }

  if (clientPart) {
    return { prefix: clientPart, startNumber };
  }
  return { prefix: s.invoicePrefix, startNumber };
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

async function generateInvoiceNumber(clientId, isTest = false, categoryId = null) {
  const { prefix: basePrefix, startNumber: baseStart } = await resolveInvoicePrefix(clientId, categoryId);
  const prefix = isTest ? `TEST-${basePrefix}` : basePrefix;
  const startNumber = isTest ? 1 : baseStart;

  // With a client, the sequence is shared across every category, so scan
  // all of that client's invoices (any prefix/category) rather than just
  // ones matching this exact prefix — and pull the trailing numeric segment
  // off each one, since the middle (category) segment varies between them.
  // Without a client, fall back to the old prefix-scoped scan (global
  // settings prefix, no per-client scoping possible).
  const all = clientId
    ? await Invoice.findAll({ where: { clientId, isTest }, attributes: ['invoiceNo'] })
    : await Invoice.findAll({ where: { invoiceNo: { [Op.like]: `${prefix}-%` }, isTest }, attributes: ['invoiceNo'] });

  let maxSeq = startNumber - 1;
  for (const inv of all) {
    const seg = inv.invoiceNo.split('-').pop();
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
    const number = await generateNumber(clientId, isTest, data.categoryId);
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
