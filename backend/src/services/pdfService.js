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
  if (settings.logoImage) {
    return `<img src="${settings.logoImage}" alt="Logo" style="max-width:120px;max-height:70px;object-fit:contain;"/>`;
  }
  const logoPath = path.join(__dirname, '../../assets/logo.png');
  if (fs.existsSync(logoPath)) {
    const b64 = fs.readFileSync(logoPath).toString('base64');
    return `<img src="data:image/png;base64,${b64}" alt="Logo" style="max-width:110px;max-height:65px;"/>`;
  }
  const text = (settings.logoText || settings.companyName || 'CO').substring(0, 3).toUpperCase();
  return `<div style="width:64px;height:48px;background:#111827;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:15px;color:#fff;">${text}</div>`;
}

function getStampHtml(settings = {}) {
  if (settings.sealImage) {
    return `<img src="${settings.sealImage}" alt="Seal" style="max-width:80px;max-height:80px;margin-bottom:4px;"/>`;
  }
  const stampPath = path.join(__dirname, '../../assets/stamp.png');
  if (!fs.existsSync(stampPath)) return '';
  const b64 = fs.readFileSync(stampPath).toString('base64');
  return `<img src="data:image/png;base64,${b64}" alt="Stamp" style="width:68px;margin-bottom:4px;"/>`;
}

function getSignatureHtml(settings = {}) {
  if (!settings.signatureImage) return '';
  return `<img src="${settings.signatureImage}" alt="Signature" style="max-width:150px;max-height:60px;margin-bottom:4px;"/>`;
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
    let dates = [];
    try { dates = item.deliveryDates ? JSON.parse(item.deliveryDates) : []; } catch {}
    if (!dates.length && item.deliveryDate) dates = [item.deliveryDate];
    const dateStr = dates.length
      ? dates.map(d => formatDate(d)).join('<br/>')
      : '—';
    return `<td style="border:1px solid #e5e7eb;padding:8px;text-align:center;font-size:11px;color:#4b5563;line-height:1.6;">${dateStr}</td>`;
  }
  return `<td style="border:1px solid #e5e7eb;padding:8px;text-align:center;font-size:11px;color:#4b5563;">${calcPeriodText(item)}</td>`;
}

function buildItemRateCell(item, symbol) {
  if (item.itemType === 'delivery') {
    const qty = parseFloat(item.quantity || 0);
    const price = parseFloat(item.unitPrice || 0);
    const qtyStr = qty.toFixed(3).replace(/\.?0+$/, '');
    return `<td style="border:1px solid #e5e7eb;padding:8px;text-align:right;font-size:11px;">
      ${qty ? `${qtyStr} &times; ${formatCurrency(price, symbol)}` : '—'}
    </td>`;
  }
  const rateUnit = item.rateType === 'per_day' ? '/day' : '/week';
  return `<td style="border:1px solid #e5e7eb;padding:8px;text-align:right;">
    ${item.rate ? `${formatCurrency(item.rate, symbol)}<span style="font-size:10px;color:#9ca3af;">${rateUnit}</span>` : '—'}
  </td>`;
}

function buildQuotationRows(items, symbol, cur) {
  const rows = items.sort((a, b) => a.sno - b.sno).map(item => `
      <tr>
        <td style="border:1px solid #e5e7eb;padding:8px;text-align:center;color:#9ca3af;background:#fafafa;">${item.sno}</td>
        <td style="border:1px solid #e5e7eb;padding:8px;"><strong>${item.jobDescription || ''}</strong></td>
        ${buildItemPeriodCell(item)}
        ${buildItemRateCell(item, symbol)}
        <td style="border:1px solid #e5e7eb;padding:8px;text-align:right;font-weight:bold;">${formatCurrency(item.totalAmount, symbol)}</td>
      </tr>`).join('');

  return rows + `
    <tr style="background:#111827;color:#fff;">
      <td colspan="4" style="border:1px solid #111827;padding:9px 10px;text-align:right;font-weight:bold;letter-spacing:1px;">TOTAL AMOUNT (${cur})</td>
      <td style="border:1px solid #111827;padding:9px 10px;text-align:right;font-weight:bold;font-size:13px;">${formatCurrency(items.reduce((s,i)=>s+parseFloat(i.totalAmount||0),0), symbol)}</td>
    </tr>`;
}

function buildInvoiceRows(items, symbol, cur, payments = []) {
  let sno = 0;
  const rowHtml = items.sort((a, b) => a.sno - b.sno).map(item => {
    if (item.itemType === 'delivery') {
      let dates = [];
      try { dates = item.deliveryDates ? JSON.parse(item.deliveryDates) : []; } catch {}
      if (!dates.length && item.deliveryDate) dates = [item.deliveryDate];

      if (dates.length > 1) {
        const unitPrice = parseFloat(item.unitPrice || 0);
        return dates.map(date => {
          sno++;
          return `
          <tr>
            <td style="border:1px solid #e5e7eb;padding:10px;text-align:center;color:#9ca3af;background:#fafafa;">${sno}</td>
            <td style="border:1px solid #e5e7eb;padding:10px;"><strong>${item.jobDescription || ''}</strong></td>
            <td style="border:1px solid #e5e7eb;padding:10px;text-align:center;font-size:11px;color:#4b5563;">${formatDate(date)}</td>
            <td style="border:1px solid #e5e7eb;padding:10px;text-align:right;font-size:11px;">1 &times; ${formatCurrency(unitPrice, symbol)}</td>
            <td style="border:1px solid #e5e7eb;padding:10px;text-align:right;font-weight:bold;">${formatCurrency(unitPrice, symbol)}</td>
          </tr>`;
        }).join('');
      }
    }
    sno++;
    return `
      <tr>
        <td style="border:1px solid #e5e7eb;padding:10px;text-align:center;color:#9ca3af;background:#fafafa;">${sno}</td>
        <td style="border:1px solid #e5e7eb;padding:10px;"><strong>${item.jobDescription || ''}</strong></td>
        ${buildItemPeriodCell(item)}
        ${buildItemRateCell(item, symbol)}
        <td style="border:1px solid #e5e7eb;padding:10px;text-align:right;font-weight:bold;">${formatCurrency(item.totalAmount, symbol)}</td>
      </tr>`;
  }).join('');

  const total = items.reduce((s,i)=>s+parseFloat(i.totalAmount||0),0);
  const paid = payments.reduce((s,p)=>s+parseFloat(p.amount||0),0);
  const balance = Math.max(0, total - paid);

  let totalRows = `
    <tr>
      <td colspan="4" style="border:1px solid #e5e7eb;padding:9px 10px;text-align:right;color:#6b7280;font-size:11px;">Subtotal</td>
      <td style="border:1px solid #e5e7eb;padding:9px 10px;text-align:right;color:#6b7280;font-size:11px;">${formatCurrency(total, symbol)}</td>
    </tr>`;

  if (paid > 0) {
    totalRows += `
    <tr>
      <td colspan="4" style="border:1px solid #e5e7eb;padding:9px 10px;text-align:right;color:#16a34a;font-size:11px;">Amount Paid</td>
      <td style="border:1px solid #e5e7eb;padding:9px 10px;text-align:right;color:#16a34a;font-size:11px;">(${formatCurrency(paid, symbol)})</td>
    </tr>`;
  }

  totalRows += `
    <tr style="background:#111827;color:#fff;">
      <td colspan="4" style="border:1px solid #111827;padding:11px 10px;text-align:right;font-weight:bold;letter-spacing:1px;">${balance === 0 ? 'PAID IN FULL' : `BALANCE DUE (${cur})`}</td>
      <td style="border:1px solid #111827;padding:11px 10px;text-align:right;font-weight:bold;font-size:13px;">${formatCurrency(balance, symbol)}</td>
    </tr>`;

  return rowHtml + totalRows;
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
      ${getSignatureHtml(settings)}
      ${getStampHtml(settings)}
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
    <tbody>${buildInvoiceRows(items, sym, cur, invoice.payments || [])}</tbody>
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
      ${getSignatureHtml(settings)}
      ${getStampHtml(settings)}
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
  const paid = (invoice.payments || []).reduce((s, p) => s + parseFloat(p.amount || 0), 0);
  const balance = Math.max(0, total - paid);
  const totalRows = `
    <tr>
      <td colspan="5" style="border:1px solid #e5e7eb;padding:9px;text-align:right;color:#6b7280;font-size:11px;">Subtotal</td>
      <td style="border:1px solid #e5e7eb;padding:9px;text-align:right;color:#6b7280;font-size:11px;">${formatCurrency(total, sym)}</td>
    </tr>
    ${paid > 0 ? `<tr>
      <td colspan="5" style="border:1px solid #e5e7eb;padding:9px;text-align:right;color:#16a34a;font-size:11px;">Amount Paid</td>
      <td style="border:1px solid #e5e7eb;padding:9px;text-align:right;color:#16a34a;font-size:11px;">(${formatCurrency(paid, sym)})</td>
    </tr>` : ''}
    <tr style="background:#111827;color:#fff;">
      <td colspan="5" style="border:1px solid #111827;padding:11px;text-align:right;font-weight:bold;letter-spacing:1px;">${balance === 0 ? 'PAID IN FULL' : `BALANCE DUE (${cur})`}</td>
      <td style="border:1px solid #111827;padding:11px;text-align:right;font-weight:bold;font-size:13px;">${formatCurrency(balance, sym)}</td>
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
      ${getSignatureHtml(settings)}
      ${getStampHtml(settings)}
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

async function generatePDFBuffer(html) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const buffer = await page.pdf({
    format: 'A4',
    margin: { top: '18mm', right: '18mm', bottom: '18mm', left: '18mm' },
    printBackground: true,
  });
  await browser.close();
  return buffer;
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

function buildCompanyHeader(settings) {
  const sym = settings.currencySymbol || 'S$';
  const addrLines = (settings.address || '').split('\n').filter(Boolean).map(l => `<div>${l}</div>`).join('');
  return `
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;">
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
  </div>`;
}

async function generateSOAPDF(client, invoices, company) {
  const sym = (company && company.currencySymbol) || 'S$';
  const today = formatDate(new Date().toISOString().slice(0, 10));

  const totalBilled = invoices.reduce((s, i) => s + parseFloat(i.totalAmount || 0), 0);
  const totalPaid = invoices.reduce((s, i) => {
    return s + (i.payments || []).reduce((ps, p) => ps + parseFloat(p.amount || 0), 0);
  }, 0);
  const balance = totalBilled - totalPaid;

  const rows = invoices.map(inv => {
    const paid = (inv.payments || []).reduce((s, p) => s + parseFloat(p.amount || 0), 0);
    const invBalance = parseFloat(inv.totalAmount || 0) - paid;
    const statusColor = inv.status === 'paid' ? '#16a34a' : inv.status === 'overdue' ? '#dc2626' : '#d97706';
    return `<tr>
      <td style="border:1px solid #e5e7eb;padding:9px 10px;font-size:11px;font-weight:600;">${inv.invoiceNo}</td>
      <td style="border:1px solid #e5e7eb;padding:9px 10px;font-size:11px;text-align:center;">${formatDate(inv.date)}</td>
      <td style="border:1px solid #e5e7eb;padding:9px 10px;font-size:11px;text-align:center;">${inv.dueDate ? formatDate(inv.dueDate) : '—'}</td>
      <td style="border:1px solid #e5e7eb;padding:9px 10px;font-size:11px;text-align:right;">${formatCurrency(inv.totalAmount, sym)}</td>
      <td style="border:1px solid #e5e7eb;padding:9px 10px;font-size:11px;text-align:right;color:#16a34a;">${formatCurrency(paid, sym)}</td>
      <td style="border:1px solid #e5e7eb;padding:9px 10px;font-size:11px;text-align:right;font-weight:${invBalance > 0 ? 'bold' : 'normal'};color:${invBalance > 0 ? '#dc2626' : '#374151'};">${formatCurrency(invBalance, sym)}</td>
      <td style="border:1px solid #e5e7eb;padding:9px 10px;font-size:10px;text-align:center;">
        <span style="background:${statusColor}1a;color:${statusColor};padding:2px 8px;border-radius:10px;font-weight:600;text-transform:uppercase;">${inv.status}</span>
      </td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><style>${baseStyle}</style></head><body>
  ${buildCompanyHeader(company || {})}
  <div style="border-top:2.5px solid #111827;border-bottom:1px solid #e5e7eb;padding:12px 0;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;">
    <div style="font-size:20px;font-weight:bold;color:#111827;letter-spacing:3px;">STATEMENT OF ACCOUNT</div>
    <div style="font-size:11px;text-align:right;color:#6b7280;">As at ${today}</div>
  </div>
  <div style="margin-bottom:18px;padding:12px 14px;background:#f9fafb;border-radius:6px;font-size:11px;">
    <div style="font-weight:bold;font-size:13px;color:#111827;margin-bottom:4px;">${client.companyName}</div>
    ${client.contactPerson ? `<div>Attn: ${client.contactPerson}</div>` : ''}
    ${client.address ? `<div style="color:#6b7280;">${client.address}</div>` : ''}
    ${client.email ? `<div style="color:#6b7280;">${client.email}</div>` : ''}
    ${client.phone ? `<div style="color:#6b7280;">${client.phone}</div>` : ''}
  </div>
  <table style="margin-bottom:20px;">
    <thead><tr>
      <th style="text-align:left;">Invoice No</th>
      <th style="text-align:center;width:13%;">Date</th>
      <th style="text-align:center;width:13%;">Due Date</th>
      <th style="text-align:right;width:14%;">Amount</th>
      <th style="text-align:right;width:14%;">Paid</th>
      <th style="text-align:right;width:14%;">Balance</th>
      <th style="text-align:center;width:10%;">Status</th>
    </tr></thead>
    <tbody>
      ${rows || '<tr><td colspan="7" style="text-align:center;padding:20px;color:#9ca3af;">No invoices found.</td></tr>'}
    </tbody>
  </table>
  <div style="display:flex;justify-content:flex-end;margin-bottom:24px;">
    <table style="width:260px;border-collapse:collapse;font-size:11px;">
      <tr><td style="padding:7px 12px;color:#6b7280;">Total Billed</td><td style="padding:7px 12px;text-align:right;font-weight:600;">${formatCurrency(totalBilled, sym)}</td></tr>
      <tr style="background:#f9fafb;"><td style="padding:7px 12px;color:#16a34a;">Total Paid</td><td style="padding:7px 12px;text-align:right;font-weight:600;color:#16a34a;">${formatCurrency(totalPaid, sym)}</td></tr>
      <tr style="background:#111827;color:#fff;"><td style="padding:9px 12px;font-weight:bold;">Outstanding Balance</td><td style="padding:9px 12px;text-align:right;font-weight:bold;font-size:13px;">${formatCurrency(balance, sym)}</td></tr>
    </table>
  </div>
  <div style="font-size:10px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:12px;">
    This statement was generated on ${today}. Please contact us if you have any queries regarding your account.
  </div>
</body></html>`;

  return generatePDFBuffer(html);
}

async function generatePayrollPDF(rows, year, month, company) {
  const sym = (company && company.currencySymbol) || 'S$';
  const today = formatDate(new Date().toISOString().slice(0, 10));
  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const periodLabel = month ? `${MONTH_NAMES[month - 1]} ${year}` : `Year ${year}`;

  const totals = rows.reduce((acc, r) => {
    acc.grossPay += r.grossPay;
    acc.cpfEmployee += r.cpfEmployee;
    acc.cpfEmployer += r.cpfEmployer;
    acc.netPay += r.netPay;
    return acc;
  }, { grossPay: 0, cpfEmployee: 0, cpfEmployer: 0, netPay: 0 });

  const tableRows = rows.map(r => `<tr>
    <td style="border:1px solid #e5e7eb;padding:9px 10px;font-size:11px;font-weight:600;">${r.name}</td>
    <td style="border:1px solid #e5e7eb;padding:9px 10px;font-size:11px;text-align:center;">${r.daysWorked}</td>
    <td style="border:1px solid #e5e7eb;padding:9px 10px;font-size:11px;text-align:right;">${r.dailyRate > 0 ? formatCurrency(r.dailyRate, sym) : '<span style="color:#d97706;">Not set</span>'}</td>
    <td style="border:1px solid #e5e7eb;padding:9px 10px;font-size:11px;text-align:right;font-weight:600;">${formatCurrency(r.grossPay, sym)}</td>
    <td style="border:1px solid #e5e7eb;padding:9px 10px;font-size:11px;text-align:right;color:#dc2626;">${formatCurrency(r.cpfEmployee, sym)}</td>
    <td style="border:1px solid #e5e7eb;padding:9px 10px;font-size:11px;text-align:right;color:#6b7280;">${formatCurrency(r.cpfEmployer, sym)}</td>
    <td style="border:1px solid #e5e7eb;padding:9px 10px;font-size:11px;text-align:right;font-weight:bold;color:#111827;">${formatCurrency(r.netPay, sym)}</td>
  </tr>`).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><style>${baseStyle}</style></head><body>
  ${buildCompanyHeader(company || {})}
  <div style="border-top:2.5px solid #111827;border-bottom:1px solid #e5e7eb;padding:12px 0;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;">
    <div style="font-size:18px;font-weight:bold;color:#111827;letter-spacing:2px;">PAYROLL SUMMARY</div>
    <div style="font-size:12px;font-weight:600;color:#4b5563;">${periodLabel}</div>
  </div>
  <table style="margin-bottom:20px;">
    <thead><tr>
      <th style="text-align:left;">Driver</th>
      <th style="text-align:center;width:10%;">Days</th>
      <th style="text-align:right;width:13%;">Daily Rate</th>
      <th style="text-align:right;width:14%;">Gross Pay</th>
      <th style="text-align:right;width:14%;">CPF (Emp 20%)</th>
      <th style="text-align:right;width:14%;">CPF (Employer 17%)</th>
      <th style="text-align:right;width:13%;">Net Pay</th>
    </tr></thead>
    <tbody>
      ${tableRows || '<tr><td colspan="7" style="text-align:center;padding:20px;color:#9ca3af;">No payroll data.</td></tr>'}
      <tr style="background:#111827;color:#fff;font-weight:bold;">
        <td style="border:1px solid #111827;padding:10px;" colspan="3">TOTALS</td>
        <td style="border:1px solid #111827;padding:10px;text-align:right;">${formatCurrency(totals.grossPay, sym)}</td>
        <td style="border:1px solid #111827;padding:10px;text-align:right;">${formatCurrency(totals.cpfEmployee, sym)}</td>
        <td style="border:1px solid #111827;padding:10px;text-align:right;">${formatCurrency(totals.cpfEmployer, sym)}</td>
        <td style="border:1px solid #111827;padding:10px;text-align:right;">${formatCurrency(totals.netPay, sym)}</td>
      </tr>
    </tbody>
  </table>
  <div style="font-size:10px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:12px;display:flex;justify-content:space-between;">
    <span>CPF rates: Employee 20% | Employer 17% (standard rates — verify against CPF Board for age-based adjustments)</span>
    <span style="font-weight:bold;color:#dc2626;">CONFIDENTIAL — For internal use only</span>
  </div>
  <div style="font-size:10px;color:#9ca3af;margin-top:6px;">Generated on ${today}</div>
</body></html>`;

  return generatePDFBuffer(html);
}

async function generateFleetCompliancePDF(vehicles, company) {
  const today = new Date().toISOString().slice(0, 10);
  const todayStr = formatDate(today);

  function cellStyle(dateStr) {
    if (!dateStr) return 'background:#f3f4f6;color:#9ca3af;';
    const diff = Math.ceil((new Date(dateStr) - new Date()) / 86400000);
    if (diff < 0) return 'background:#fee2e2;color:#dc2626;font-weight:bold;';
    if (diff <= 30) return 'background:#fef3c7;color:#d97706;font-weight:bold;';
    return 'background:#dcfce7;color:#16a34a;';
  }

  function overallStatus(v) {
    const dates = [v.coeExpiry, v.roadTaxExpiry, v.insuranceExpiry, v.inspectionDue].filter(Boolean);
    if (!dates.length) return { label: 'Unknown', color: '#9ca3af' };
    const minDiff = Math.min(...dates.map(d => Math.ceil((new Date(d) - new Date()) / 86400000)));
    if (minDiff < 0) return { label: 'Expired', color: '#dc2626' };
    if (minDiff <= 30) return { label: 'Due Soon', color: '#d97706' };
    return { label: 'OK', color: '#16a34a' };
  }

  const rows = vehicles.map(v => {
    const os = overallStatus(v);
    return `<tr>
      <td style="border:1px solid #e5e7eb;padding:9px 10px;font-size:11px;font-weight:bold;">${v.plateNumber}</td>
      <td style="border:1px solid #e5e7eb;padding:9px 10px;font-size:11px;color:#4b5563;">${v.type || '—'} ${v.size ? '(' + v.size + ')' : ''}</td>
      <td style="border:1px solid #e5e7eb;padding:9px 10px;font-size:11px;text-align:center;${cellStyle(v.coeExpiry)}">${v.coeExpiry ? formatDate(v.coeExpiry) : '—'}</td>
      <td style="border:1px solid #e5e7eb;padding:9px 10px;font-size:11px;text-align:center;${cellStyle(v.roadTaxExpiry)}">${v.roadTaxExpiry ? formatDate(v.roadTaxExpiry) : '—'}</td>
      <td style="border:1px solid #e5e7eb;padding:9px 10px;font-size:11px;text-align:center;${cellStyle(v.insuranceExpiry)}">${v.insuranceExpiry ? formatDate(v.insuranceExpiry) : '—'}</td>
      <td style="border:1px solid #e5e7eb;padding:9px 10px;font-size:11px;text-align:center;${cellStyle(v.inspectionDue)}">${v.inspectionDue ? formatDate(v.inspectionDue) : '—'}</td>
      <td style="border:1px solid #e5e7eb;padding:9px 10px;font-size:10px;text-align:center;">
        <span style="background:${os.color}1a;color:${os.color};padding:2px 8px;border-radius:10px;font-weight:700;">${os.label}</span>
      </td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><style>${baseStyle}</style></head><body>
  ${buildCompanyHeader(company || {})}
  <div style="border-top:2.5px solid #111827;border-bottom:1px solid #e5e7eb;padding:12px 0;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;">
    <div style="font-size:18px;font-weight:bold;color:#111827;letter-spacing:2px;">FLEET COMPLIANCE REPORT</div>
    <div style="font-size:11px;color:#6b7280;">As at ${todayStr}</div>
  </div>
  <table style="margin-bottom:20px;">
    <thead><tr>
      <th style="text-align:left;">Plate</th>
      <th style="text-align:left;">Type</th>
      <th style="text-align:center;width:12%;">COE Expiry</th>
      <th style="text-align:center;width:12%;">Road Tax</th>
      <th style="text-align:center;width:12%;">Insurance</th>
      <th style="text-align:center;width:12%;">Inspection</th>
      <th style="text-align:center;width:10%;">Status</th>
    </tr></thead>
    <tbody>
      ${rows || '<tr><td colspan="7" style="text-align:center;padding:20px;color:#9ca3af;">No vehicles found.</td></tr>'}
    </tbody>
  </table>
  <div style="display:flex;gap:20px;font-size:10px;margin-bottom:12px;">
    <span style="background:#fee2e21a;color:#dc2626;padding:2px 10px;border-radius:10px;font-weight:600;border:1px solid #fca5a5;">Red = Expired</span>
    <span style="background:#fef3c71a;color:#d97706;padding:2px 10px;border-radius:10px;font-weight:600;border:1px solid #fcd34d;">Amber = &lt;30 days</span>
    <span style="background:#dcfce71a;color:#16a34a;padding:2px 10px;border-radius:10px;font-weight:600;border:1px solid #86efac;">Green = OK</span>
    <span style="background:#f3f4f6;color:#9ca3af;padding:2px 10px;border-radius:10px;font-weight:600;border:1px solid #e5e7eb;">Gray = Not set</span>
  </div>
  <div style="font-size:10px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:12px;">
    Generated on ${todayStr}. Please ensure all documents are renewed before their expiry dates.
  </div>
</body></html>`;

  return generatePDFBuffer(html);
}

module.exports = { generateInvoicePDF, generateQuotationPDF, generateSOAPDF, generatePayrollPDF, generateFleetCompliancePDF };
