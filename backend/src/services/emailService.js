const transporter = require('../config/email');
const path = require('path');
const fs = require('fs');

async function sendInvoiceEmail({ to, clientName, invoiceNo, pdfPath, settings = {} }) {
  const attachments = [];
  if (pdfPath && fs.existsSync(pdfPath)) {
    attachments.push({
      filename: `Invoice-${invoiceNo.replace(/\//g, '-')}.pdf`,
      path: pdfPath,
    });
  }

  const companyName = settings.companyName || 'AKB Transport & Logistics Pte. Ltd.';
  const bankRows = [
    settings.bankAccountName ? `<tr><td style="padding:4px 8px"><strong>Account Name:</strong></td><td>${settings.bankAccountName}</td></tr>` : '',
    settings.bankName        ? `<tr><td style="padding:4px 8px"><strong>Bank:</strong></td><td>${settings.bankName}</td></tr>` : '',
    settings.bankAccountNo   ? `<tr><td style="padding:4px 8px"><strong>Account No:</strong></td><td>${settings.bankAccountNo}</td></tr>` : '',
  ].filter(Boolean).join('');
  const bankSection = bankRows
    ? `<p>Kindly arrange payment at your earliest convenience to the following bank account:</p><table style="border-collapse:collapse;width:100%">${bankRows}</table><br/>`
    : '';
  const phone = settings.phone || '';
  const contactLine = phone ? `<a href="tel:${phone}">${phone}</a> or ` : '';
  const regNo = settings.registrationNo ? `<br/>UEN: ${settings.registrationNo}` : '';

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || `${companyName} <akbtransportlogistics@gmail.com>`,
    to,
    subject: `Invoice ${invoiceNo} - ${companyName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#1a1a2e">${companyName}</h2>
        <p>Dear ${clientName},</p>
        <p>Please find attached your invoice <strong>${invoiceNo}</strong>.</p>
        ${bankSection}
        <p>If you have any queries, please contact us at ${contactLine}reply to this email.</p>
        <p>Thank you for your business.</p>
        <br/>
        <p><strong>${settings.signatoryName || companyName}</strong><br/>${companyName}${regNo}</p>
      </div>
    `,
    attachments,
  });
}

async function sendQuotationEmail({ to, clientName, quotationNo, pdfPath, settings = {} }) {
  const attachments = [];
  if (pdfPath && fs.existsSync(pdfPath)) {
    attachments.push({
      filename: `Quotation-${quotationNo.replace(/\//g, '-')}.pdf`,
      path: pdfPath,
    });
  }

  const companyName = settings.companyName || 'AKB Transport & Logistics Pte. Ltd.';
  const phone = settings.phone || '';
  const contactLine = phone ? `<a href="tel:${phone}">${phone}</a>` : 'reply to this email';

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || `${companyName} <akbtransportlogistics@gmail.com>`,
    to,
    subject: `Quotation ${quotationNo} - ${companyName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#1a1a2e">${companyName}</h2>
        <p>Dear ${clientName},</p>
        <p>Please find attached our quotation <strong>${quotationNo}</strong> for your review.</p>
        <p>Please confirm your acceptance at your earliest convenience.</p>
        <p>If you have any queries, please contact us at ${contactLine}.</p>
        <br/>
        <p><strong>${settings.signatoryName || companyName}</strong><br/>${companyName}</p>
      </div>
    `,
    attachments,
  });
}

module.exports = { sendInvoiceEmail, sendQuotationEmail };
