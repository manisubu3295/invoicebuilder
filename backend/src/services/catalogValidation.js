const { ItemCatalog } = require('../models');

// Shared rule: an item name must match an active Item Catalog entry
// (case-insensitive, trimmed) to be saved. Used by delivery logs (driver
// entries), and by invoice/quotation delivery-type line items. Returns null
// when every checked item is valid, or a message naming the first offender.
//
// `nameField` — which property on each item object holds its display name
// ('itemName' for delivery items, 'jobDescription' for invoice/quotation items).
// `deliveryOnly` — when true, only items with itemType === 'delivery' are
// checked; service-type items (custom description + negotiated rate) are
// exempt. Delivery log items have no itemType field, so they're always
// checked in full (deliveryOnly has no effect there).
async function findInvalidCatalogItem(items, { nameField = 'itemName', deliveryOnly = false } = {}) {
  const toCheck = deliveryOnly ? items.filter(i => i.itemType === 'delivery') : items;
  if (!toCheck.length) return null;

  const active = await ItemCatalog.findAll({ where: { isActive: true }, attributes: ['name'] });
  const allowed = new Set(active.map(c => c.name.trim().toLowerCase()));

  for (const item of toCheck) {
    const name = (item[nameField] || '').trim();
    if (!allowed.has(name.toLowerCase())) {
      return `"${name}" is not in the item catalog — please select an item from the list`;
    }
  }
  return null;
}

module.exports = { findInvalidCatalogItem };
