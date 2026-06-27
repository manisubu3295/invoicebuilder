const { Invoice, Client } = require('../models');
const { Op } = require('sequelize');

async function generateInvoiceNumber(clientId) {
  const client = await Client.findByPk(clientId);
  if (!client) throw new Error('Client not found');

  const year = new Date().getFullYear();
  const prefix = `AKB/${client.clientCode}/`;
  const yearSuffix = `/${year}`;

  const last = await Invoice.findOne({
    where: {
      invoiceNo: { [Op.like]: `${prefix}%${yearSuffix}` },
    },
    order: [['createdAt', 'DESC']],
  });

  let seq = 1;
  if (last) {
    const parts = last.invoiceNo.split('/');
    const lastSeq = parseInt(parts[2], 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }

  return `${prefix}${seq}${yearSuffix}`;
}

async function generateQuotationNumber(clientId) {
  const { Quotation, Client } = require('../models');
  const client = await Client.findByPk(clientId);
  if (!client) throw new Error('Client not found');

  const year = new Date().getFullYear();
  const prefix = `AKB/${client.clientCode}/Q`;
  const yearSuffix = `/${year}`;

  const last = await Quotation.findOne({
    where: {
      quotationNo: { [Op.like]: `${prefix}%${yearSuffix}` },
    },
    order: [['createdAt', 'DESC']],
  });

  let seq = 1;
  if (last) {
    const parts = last.quotationNo.split('/');
    const lastSeq = parseInt(parts[2].replace('Q', ''), 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }

  return `${prefix}${String(seq).padStart(3, '0')}${yearSuffix}`;
}

module.exports = { generateInvoiceNumber, generateQuotationNumber };
