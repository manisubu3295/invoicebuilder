const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const UPLOADS_DIR = path.join(__dirname, '../../uploads/pdfs');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
}

function formatCurrency(amount, symbol) {
  return `${symbol}${parseFloat(amount || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function getLogoHtml(settings) {
  const logoPath = path.join(__dirname, '../../assets/logo.png');
  if (fs.existsSync(logoPath)) {
    const b64 = fs.readFileSync(logoPath).toString('base64');
    return `<img src="data:image/png;base64,${b64}" alt="Logo" style="max-width:110px;max-height:65px;"/>`;
  }
  const text = (settings.logoText || settings.companyName || 'CO').substring(0, 3).toUpperCase();
  return `<div style="width:64px;height:48px;background:#111827;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:15px;color:#fff;">${text}</div>`;
}

function getStampHtml() {
  const stampPath = path.join(__dirname, '../../assets/stamp.png');
  if (!fs.existsSync(stampPath)) return '';
  const b64 = fs.readFileSync(stampPath).toString('base64');
  return `<img src="data:image/png;base64,${b64}" alt="Stamp" style="width:68px;margin-bottom:4px;"/>`;
}

function calcPeriodText(item) {
  if (!item.fromDate || !item.toDate) return '—';
  const days = Math.round((new Date(item.toDate) - new Date(item.fromDate)) / 86400000) + 1;
  const range = `${formatDate(item.fromDate)} – ${formatDate(item.toDate)}`;
  if (item.rateType === 'per_day') return `${range}<br/><strong>${days} day${days !== 1 ? 's' : ''}</strong>`;
  const weeks = Math.ceil(days / 7);
  return `${range}<br/><strong>${weeks} week${weeks !== 1 ? 's' : ''}</strong> (${days} days)`;
}

function buildItemPeriodCell(item) {
  if (item.itemType === 'delivery') {
    return `<td style="border:1px solid #e5e7eb;padding:10px;text-align:center;font-size:11px;color:#4b5563;">${formatDate(item.deliveryDate)}</td>`;
  }
  return `<td style="border:1px solid #e5e7eb;padding:10px;text-align:center;font-size:11px;color:#4b5563;">${calcPeriodText(item)}</td>`;
}

function buildItemRateCell(item, symbol) {
  if (item.itemType === 'delivery') {
    const qty = parseFloat(item.quantity || 0);
    const price = parseFloat(item.unitPrice || 0);
    const qtyStr = qty.toFixed(3).replace(/\.?0+$/, '');
    return `<td style="border:1px solid #e5e7eb;padding:10px;text-align:right;font-size:11px;">
      ${qty ? `${qtyStr} &times; ${formatCurrency(price, symbol)}` : '—'}
    </td>`;
  }
  const rateUnit = item.rateType === 'per_day' ? '/day' : '/week';
  return `<td style="border:1px solid #e5e7eb;padding:10px;text-align:right;">
    ${item.rate ? `${formatCurrency(item.rate, symbol)}<span style="font-size:10px;color:#9ca3af;">${rateUnit}</span>` : '—'}
  </td>`;
}

function buildQuotationRows(items, symbol, cur) {
  const rows = items.sort((a, b) => a.sno - b.sno).map(item => `
      <tr>
        <td style="border:1px solid #e5e7eb;padding:10px;text-align:center;color:#9ca3af;background:#fafafa;">${item.sno}</td>
        <td style="border:1px solid #e5e7eb;padding:10px;"><strong>${item.jobDescription || ''}</strong></td>
        ${buildItemPeriodCell(item)}
        ${buildItemRateCell(item, symbol)}
        <td style="border:1px solid #e5e7eb;padding:10px;text-align:right;font-weight:bold;">${formatCurrency(item.totalAmount, symbol)}</td>
      </tr>`).join('');

  return rows + `
    <tr style="background:#111827;color:#fff;">
      <td colspan="4" style="border:1px solid #111827;padding:11px 10px;text-align:right;font-weight:bold;letter-spacing:1px;">TOTAL AMOUNT (${cur})</td>
      <td style="border:1px solid #111827;padding:11px 10px;text-align:right;font-weight:bold;font-size:13px;">${formatCurrency(items.reduce((s,i)=>s+parseFloat(i.totalAmount||0),0), symbol)}</td>
    </tr>`;
}

function buildInvoiceRows(items, symbol, cur) {
  const rows = items.sort((a, b) => a.sno - b.sno).map(item => `
      <tr>
        <td style="border:1px solid #e5e7eb;padding:10px;text-align:center;color:#9ca3af;background:#fafafa;">${item.sno}</td>
        <td style="border:1px solid #e5e7eb;padding:10px;"><strong>${item.jobDescription || ''}</strong></td>
        ${buildItemPeriodCell(item)}
        ${buildItemRateCell(item, symbol)}
        <td style="border:1px solid #e5e7eb;padding:10px;text-align:right;font-weight:bold;">${formatCurrency(item.totalAmount, symbol)}</td>
      </tr>`).join('');

  const total = items.reduce((s,i)=>s+parseFloat(i.totalAmount||0),0);
  return rows + `
    <tr>
      <td colspan="4" style="border:1px solid #e5e7eb;padding:9px 10px;text-align:right;color:#6b7280;font-size:11px;">Subtotal</td>
      <td style="border:1px solid #e5e7eb;padding:9px 10px;text-align:right;color:#6b7280;font-size:11px;">${formatCurrency(total, symbol)}</td>
    </tr>
    <tr style="background:#111827;color:#fff;">
      <td colspan="4" style="border:1px solid #111827;padding:11px 10px;text-align:right;font-weight:bold;letter-spacing:1px;">AMOUNT DUE (${cur})</td>
      <td style="border:1px solid #111827;padding:11px 10px;text-align:right;font-weight:bold;font-size:13px;">${formatCurrency(total, symbol)}</td>
    </tr>`;
}

const baseStyle = `
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #1f2937; padding: 48px; line-height: 1.5; }
  a { color: #1d4ed8; text-decoration: none; }
  table { width:100%; border-collapse:collapse; }
  thead th { border:1px solid #111827; padding:10px; background:#111827; color:#fff; font-size:11px; letter-spacing:0.5px; font-weight:600; }
`;

function buildQuotationHtml(quotation, client, items, settings = {}) {
  const sym = settings.currencySymbol || 'S$';
  const cur = settings.currency || 'SGD';
  const termsDays = settings.paymentTermsDays || 30;
  const addrLines = (settings.address || '').split('\n').filter(Boolean).map(l => `<div>${l}</div>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><style>${baseStyle}</style></head><body>

  <!-- Letterhead -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;">
    <div>
      <div style="font-size:16px;font-weight:bold;color:#111827;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">${settings.companyName || 'My Company'}</div>
      ${settings.registrationNo ? `<div style="font-size:10.5px;color:#6b7280;margin-bottom:2px;">${settings.registrationNo}</div>` : ''}
      <div style="font-size:11px;color:#4b5563;line-height:1.7;margin-top:4px;">${addrLines}</div>
      <div style="font-size:11px;color:#4b5563;margin-top:2px;">
        ${settings.phone ? `Tel: ${settings.phone}` : ''}
        ${settings.phone && settings.email ? ' &nbsp;|&nbsp; ' : ''}
        ${settings.email ? `<a href="mailto:${settings.email}">${settings.email}</a>` : ''}
      </div>
    </div>
    <div>${getLogoHtml(settings)}</div>
  </div>

  <!-- Title bar -->
  <div style="border-top:2.5px solid #111827;border-bottom:1px solid #e5e7eb;padding:12px 0;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center;">
    <div style="font-size:22px;font-weight:bold;color:#111827;letter-spacing:4px;">QUOTATION</div>
    <div style="font-size:11px;text-align:right;line-height:1.9;">
      <div><span style="color:#6b7280;">Quotation No: </span><strong>${quotation.quotationNo}</strong></div>
      <div><span style="color:#6b7280;">Date: </span>${formatDate(quotation.date)}</div>
      ${quotation.validUntil ? `<div><span style="color:#6b7280;">Valid Until: </span><span style="color:#b45309;font-weight:bold;">${formatDate(quotation.validUntil)}</span></div>` : ''}
    </div>
  </div>

  <!-- Addressed To -->
  <div style="margin-bottom:20px;">
    <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:2px;margin-bottom:4px;">To</div>
    <div style="font-weight:bold;font-size:13px;">${client.companyName}</div>
    ${client.contactPerson ? `<div>Attn: ${client.contactPerson}</div>` : ''}
    ${client.address ? `<div style="font-size:11px;color:#6b7280;">${client.address}</div>` : ''}
  </div>

  <!-- Salutation -->
  <div style="margin-bottom:6px;">Dear Sir / Madam,</div>
  <div style="margin-bottom:18px;">We are pleased to submit our quotation for your kind consideration and approval.</div>

  <!-- Items Table -->
  <table style="margin-bottom:24px;">
    <thead><tr>
      <th style="width:6%;text-align:center;">S.NO</th>
      <th style="text-align:left;">DESCRIPTION OF SERVICES</th>
      <th style="width:24%;text-align:center;">PERIOD</th>
      <th style="width:16%;text-align:right;">RATE</th>
      <th style="width:17%;text-align:right;">AMOUNT (${cur})</th>
    </tr></thead>
    <tbody>${buildQuotationRows(items, sym, cur)}</tbody>
  </table>

  ${quotation.notes ? `
  <div style="margin-bottom:20px;padding:10px 14px;background:#fffbeb;border-left:3px solid #f59e0b;font-size:11.5px;">
    <strong>Note:</strong> ${quotation.notes}
  </div>` : ''}

  <!-- Terms & Conditions -->
  <div style="margin-bottom:24px;font-size:11px;">
    <div style="font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#374151;margin-bottom:8px;font-size:10.5px;">Terms &amp; Conditions</div>
    <ol style="padding-left:16px;color:#4b5563;line-height:2;">
      <li>This quotation is valid for <strong>${termsDays} days</strong> from the date of issue.</li>
      <li>All prices are in <strong>${cur}</strong> and are subject to applicable taxes.</li>
      <li>Payment terms: Net <strong>${termsDays} days</strong> from invoice date.</li>
      <li>Please confirm your acceptance by signing and returning a copy of this quotation.</li>
    </ol>
  </div>

  <!-- Closing -->
  <div style="margin-bottom:32px;color:#374151;">
    We look forward to your favourable response. Should you require any clarification, please do not hesitate to contact us.
  </div>

  <!-- Signature -->
  <div style="display:flex;justify-content:space-between;align-items:flex-end;">
    <div style="font-size:11px;color:#6b7280;line-height:1.8;">
      Yours faithfully,<br/>
      For and on behalf of<br/>
      <strong style="color:#111827;">${settings.companyName || ''}</strong>
    </div>
    <div style="text-align:center;min-width:180px;">
      ${getStampHtml()}
      <div style="width:180px;border-bottom:1px solid #6b7280;margin:0 auto 6px;"></div>
      <div style="font-weight:bold;font-size:12px;">${settings.signatoryName || 'Authorised Signatory'}</div>
      <div style="font-size:10.5px;color:#6b7280;">Authorised Signatory</div>
    </div>
  </div>

</body></html>`;
}

function buildInvoiceHtml(invoice, client, items, settings = {}) {
  const sym = settings.currencySymbol || 'S$';
  const cur = settings.currency || 'SGD';
  const termsDays = settings.paymentTermsDays || 30;
  const addrLines = (settings.address || '').split('\n').filter(Boolean).map(l => `<div>${l}</div>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><style>${baseStyle}</style></head><body>

  <!-- Letterhead -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;">
    <div>
      <div style="font-size:16px;font-weight:bold;color:#111827;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">${settings.companyName || 'My Company'}</div>
      ${settings.registrationNo ? `<div style="font-size:10.5px;color:#6b7280;margin-bottom:2px;">${settings.registrationNo}</div>` : ''}
      <div style="font-size:11px;color:#4b5563;line-height:1.7;margin-top:4px;">${addrLines}</div>
      <div style="font-size:11px;color:#4b5563;margin-top:2px;">
        ${settings.phone ? `Tel: ${settings.phone}` : ''}
        ${settings.phone && settings.email ? ' &nbsp;|&nbsp; ' : ''}
        ${settings.email ? `<a href="mailto:${settings.email}">${settings.email}</a>` : ''}
      </div>
    </div>
    <div>${getLogoHtml(settings)}</div>
  </div>

  <!-- Title bar -->
  <div style="border-top:2.5px solid #111827;border-bottom:1px solid #e5e7eb;padding:12px 0;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center;">
    <div style="font-size:22px;font-weight:bold;color:#111827;letter-spacing:4px;">INVOICE</div>
    <div style="font-size:11px;text-align:right;line-height:1.9;">
      <div><span style="color:#6b7280;">Invoice No: </span><strong>${invoice.invoiceNo}</strong></div>
      <div><span style="color:#6b7280;">Date: </span>${formatDate(invoice.date)}</div>
      ${invoice.dueDate ? `<div><span style="color:#6b7280;">Due Date: </span><strong>${formatDate(invoice.dueDate)}</strong></div>` : ''}
    </div>
  </div>

  <!-- Bill To -->
  <div style="margin-bottom:20px;">
    <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:2px;margin-bottom:4px;">Bill To</div>
    <div style="font-weight:bold;font-size:13px;">${client.companyName}</div>
    ${client.contactPerson ? `<div>Attn: ${client.contactPerson}</div>` : ''}
    ${client.address ? `<div style="font-size:11px;color:#6b7280;">${client.address}</div>` : ''}
  </div>

  <!-- Items Table -->
  <table style="margin-bottom:24px;">
    <thead><tr>
      <th style="width:6%;text-align:center;">S.NO</th>
      <th style="text-align:left;">DESCRIPTION OF SERVICES</th>
      <th style="width:24%;text-align:center;">PERIOD</th>
      <th style="width:16%;text-align:right;">RATE</th>
      <th style="width:17%;text-align:right;">AMOUNT (${cur})</th>
    </tr></thead>
    <tbody>${buildInvoiceRows(items, sym, cur)}</tbody>
  </table>

  ${invoice.notes ? `
  <div style="margin-bottom:20px;padding:10px 14px;background:#fffbeb;border-left:3px solid #f59e0b;font-size:11.5px;">
    <strong>Note:</strong> ${invoice.notes}
  </div>` : ''}

  <!-- Signature + Payment Details side by side -->
  <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:32px;gap:32px;">

    ${(settings.bankName || settings.bankAccountNo) ? `
    <div style="font-size:11px;line-height:1.9;">
      <div style="font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#374151;margin-bottom:6px;font-size:10.5px;">Payment Details</div>
      ${settings.bankAccountName ? `<div><span style="color:#6b7280;">Account Name: </span><strong>${settings.bankAccountName}</strong></div>` : ''}
      ${settings.bankName ? `<div><span style="color:#6b7280;">Bank: </span><strong>${settings.bankName}</strong></div>` : ''}
      ${settings.bankAccountNo ? `<div><span style="color:#6b7280;">Account No: </span><strong>${settings.bankAccountNo}</strong></div>` : ''}
      <div style="font-size:10.5px;color:#6b7280;margin-top:6px;font-style:italic;">
        Payment due within ${termsDays} days of invoice date.<br/>
        Please quote invoice number when making payment.
      </div>
    </div>` : `<div></div>`}

    <div style="text-align:center;min-width:180px;">
      ${getStampHtml()}
      <div style="width:180px;border-bottom:1px solid #6b7280;margin:0 auto 6px;"></div>
      <div style="font-weight:bold;font-size:12px;">${settings.signatoryName || 'Authorised Signatory'}</div>
      <div style="font-size:10.5px;color:#6b7280;">Authorised Signatory</div>
    </div>
  </div>

</body></html>`;
}

function buildDeliveryInvoiceHtml(invoice, client, items, settings = {}) {
  const sym = settings.currencySymbol || 'S$';
  const cur = settings.currency || 'SGD';
  const termsDays = settings.paymentTermsDays || 30;
  const addrLines = (settings.address || '').split('\n').filter(Boolean).map(l => `<div>${l}</div>`).join('');

  // Group rows by date for cleaner display
  const sorted = [...items].sort((a, b) => {
    const d = (a.fromDate || '').localeCompare(b.fromDate || '');
    return d !== 0 ? d : (a.deliveredBy || '').localeCompare(b.deliveredBy || '');
  });

  const rows = sorted.map((item, idx) => `
    <tr>
      <td style="border:1px solid #e5e7eb;padding:9px;text-align:center;font-size:11px;">${formatDate(item.fromDate)}</td>
      <td style="border:1px solid #e5e7eb;padding:9px;font-size:11px;color:#4b5563;">${item.deliveredBy || '—'}</td>
      <td style="border:1px solid #e5e7eb;padding:9px;"><strong>${item.jobDescription || ''}</strong></td>
      <td style="border:1px solid #e5e7eb;padding:9px;text-align:right;">${parseFloat(item.quantity || 0).toFixed(3).replace(/\.?0+$/, '')}</td>
      <td style="border:1px solid #e5e7eb;padding:9px;text-align:right;">${formatCurrency(item.rate, sym)}</td>
      <td style="border:1px solid #e5e7eb;padding:9px;text-align:right;font-weight:bold;">${formatCurrency(item.totalAmount, sym)}</td>
    </tr>`).join('');

  const total = items.reduce((s, i) => s + parseFloat(i.totalAmount || 0), 0);
  const totalRows = `
    <tr>
      <td colspan="5" style="border:1px solid #e5e7eb;padding:9px;text-align:right;color:#6b7280;font-size:11px;">Subtotal</td>
      <td style="border:1px solid #e5e7eb;padding:9px;text-align:right;color:#6b7280;font-size:11px;">${formatCurrency(total, sym)}</td>
    </tr>
    <tr style="background:#111827;color:#fff;">
      <td colspan="5" style="border:1px solid #111827;padding:11px;text-align:right;font-weight:bold;letter-spacing:1px;">AMOUNT DUE (${cur})</td>
      <td style="border:1px solid #111827;padding:11px;text-align:right;font-weight:bold;font-size:13px;">${formatCurrency(total, sym)}</td>
    </tr>`;

  const period = invoice.periodStart && invoice.periodEnd
    ? `${formatDate(invoice.periodStart)} – ${formatDate(invoice.periodEnd)}`
    : '';

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><style>${baseStyle}</style></head><body>

  <!-- Letterhead -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;">
    <div>
      <div style="font-size:16px;font-weight:bold;color:#111827;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">${settings.companyName || 'My Company'}</div>
      ${settings.registrationNo ? `<div style="font-size:10.5px;color:#6b7280;margin-bottom:2px;">${settings.registrationNo}</div>` : ''}
      <div style="font-size:11px;color:#4b5563;line-height:1.7;margin-top:4px;">${addrLines}</div>
      <div style="font-size:11px;color:#4b5563;margin-top:2px;">
        ${settings.phone ? `Tel: ${settings.phone}` : ''}
        ${settings.phone && settings.email ? ' &nbsp;|&nbsp; ' : ''}
        ${settings.email ? `<a href="mailto:${settings.email}">${settings.email}</a>` : ''}
      </div>
    </div>
    <div>${getLogoHtml(settings)}</div>
  </div>

  <!-- Title bar -->
  <div style="border-top:2.5px solid #111827;border-bottom:1px solid #e5e7eb;padding:12px 0;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center;">
    <div>
      <div style="font-size:22px;font-weight:bold;color:#111827;letter-spacing:4px;">INVOICE</div>
      ${period ? `<div style="font-size:11px;color:#6b7280;margin-top:3px;">Delivery Period: <strong>${period}</strong></div>` : ''}
    </div>
    <div style="font-size:11px;text-align:right;line-height:1.9;">
      <div><span style="color:#6b7280;">Invoice No: </span><strong>${invoice.invoiceNo}</strong></div>
      <div><span style="color:#6b7280;">Date: </span>${formatDate(invoice.date)}</div>
      ${invoice.dueDate ? `<div><span style="color:#6b7280;">Due Date: </span><strong>${formatDate(invoice.dueDate)}</strong></div>` : ''}
    </div>
  </div>

  <!-- Bill To -->
  <div style="margin-bottom:20px;">
    <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:2px;margin-bottom:4px;">Bill To</div>
    <div style="font-weight:bold;font-size:13px;">${client.companyName}</div>
    ${client.contactPerson ? `<div>Attn: ${client.contactPerson}</div>` : ''}
    ${client.address ? `<div style="font-size:11px;color:#6b7280;">${client.address}</div>` : ''}
  </div>

  <!-- Delivery Items Table -->
  <table style="margin-bottom:24px;">
    <thead><tr>
      <th style="width:13%;text-align:center;">DATE</th>
      <th style="width:16%;text-align:left;">DELIVERED BY</th>
      <th style="text-align:left;">ITEM / DESCRIPTION</th>
      <th style="width:9%;text-align:right;">QTY</th>
      <th style="width:14%;text-align:right;">UNIT PRICE</th>
      <th style="width:14%;text-align:right;">AMOUNT (${cur})</th>
    </tr></thead>
    <tbody>${rows}${totalRows}</tbody>
  </table>

  ${invoice.notes ? `
  <div style="margin-bottom:20px;padding:10px 14px;background:#fffbeb;border-left:3px solid #f59e0b;font-size:11.5px;">
    <strong>Note:</strong> ${invoice.notes}
  </div>` : ''}

  <!-- Payment Details + Signature -->
  <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:32px;gap:32px;">
    ${(settings.bankName || settings.bankAccountNo) ? `
    <div style="font-size:11px;line-height:1.9;">
      <div style="font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#374151;margin-bottom:6px;font-size:10.5px;">Payment Details</div>
      ${settings.bankAccountName ? `<div><span style="color:#6b7280;">Account Name: </span><strong>${settings.bankAccountName}</strong></div>` : ''}
      ${settings.bankName ? `<div><span style="color:#6b7280;">Bank: </span><strong>${settings.bankName}</strong></div>` : ''}
      ${settings.bankAccountNo ? `<div><span style="color:#6b7280;">Account No: </span><strong>${settings.bankAccountNo}</strong></div>` : ''}
      <div style="font-size:10.5px;color:#6b7280;margin-top:6px;font-style:italic;">
        Payment due within ${termsDays} days of invoice date.<br/>
        Please quote invoice number when making payment.
      </div>
    </div>` : `<div></div>`}
    <div style="text-align:center;min-width:180px;">
      ${getStampHtml()}
      <div style="width:180px;border-bottom:1px solid #6b7280;margin:0 auto 6px;"></div>
      <div style="font-weight:bold;font-size:12px;">${settings.signatoryName || 'Authorised Signatory'}</div>
      <div style="font-size:10.5px;color:#6b7280;">Authorised Signatory</div>
    </div>
  </div>

</body></html>`;
}

async function generatePDF(html, filename) {
  ensureDir(UPLOADS_DIR);
  const outputPath = path.join(UPLOADS_DIR, filename);
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.pdf({
    path: outputPath,
    format: 'A4',
    margin: { top: '18mm', right: '18mm', bottom: '18mm', left: '18mm' },
    printBackground: true,
  });
  await browser.close();
  return outputPath;
}

async function generateInvoicePDF(invoice, client, items, settings) {
  const html = invoice.invoiceType === 'delivery'
    ? buildDeliveryInvoiceHtml(invoice, client, items, settings)
    : buildInvoiceHtml(invoice, client, items, settings);
  const filename = `Invoice-${invoice.invoiceNo.replace(/\//g, '-')}-${Date.now()}.pdf`;
  return generatePDF(html, filename);
}

async function generateQuotationPDF(quotation, client, items, settings) {
  const html = buildQuotationHtml(quotation, client, items, settings);
  const filename = `Quotation-${quotation.quotationNo.replace(/\//g, '-')}-${Date.now()}.pdf`;
  return generatePDF(html, filename);
}

module.exports = { generateInvoicePDF, generateQuotationPDF };
