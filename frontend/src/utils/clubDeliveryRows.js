// Club delivery rows that share the same date, run sheet, item name, and unit
// price into one line, summing quantities and totals — the client-facing view
// of a delivery invoice (the client doesn't care which driver delivered what).
// The run sheet is part of the line identity so each run sheet can be verified
// on its own, and rows sort date → run sheet → item so all items of a run
// sheet sit together. Rows with different unit prices never merge, so every
// displayed line still satisfies qty × rate = amount. Distinct notes from
// merged rows are joined.
//
// `fields` maps the date / item-name / unit-price keys of the input rows;
// defaults match delivery-preview rows. Returned rows keep the shape of the
// input rows (first row of each group wins for unmapped fields).
export function clubDeliveryRows(rows, fields = {}) {
  const f = { date: 'deliveryDate', name: 'itemName', price: 'unitPrice', ...fields };
  const rs = (row) => String(row.runSheetNo || '').trim();
  const groups = new Map();
  for (const row of rows) {
    const key = [
      row[f.date] || '',
      rs(row).toLowerCase(),
      String(row[f.name] || '').trim().toLowerCase(),
      parseFloat(row[f.price] || 0),
    ].join('|');
    let g = groups.get(key);
    if (!g) {
      g = { ...row, quantity: 0, totalAmount: 0, _notes: [] };
      groups.set(key, g);
    }
    g.quantity += parseFloat(row.quantity || 0);
    g.totalAmount += parseFloat(row.totalAmount || 0);
    if (row.notes && !g._notes.includes(row.notes)) g._notes.push(row.notes);
  }
  return [...groups.values()]
    .map(({ _notes, ...g }) => ({ ...g, notes: _notes.join(' · ') }))
    .sort((a, b) =>
      String(a[f.date] || '').localeCompare(String(b[f.date] || ''))
      || rs(a).localeCompare(rs(b), undefined, { numeric: true })
      || String(a[f.name] || '').localeCompare(String(b[f.name] || '')));
}

// Format a decimal quantity without trailing zeros (6.000 → "6", 2.500 → "2.5")
export function formatQty(q) {
  return parseFloat(q || 0).toFixed(3).replace(/\.?0+$/, '');
}
