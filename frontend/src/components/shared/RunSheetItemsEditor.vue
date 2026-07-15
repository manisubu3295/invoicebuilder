<script setup>
// Run-sheet-grouped item editor for invoices — same entry pattern as the
// delivery form: type the run sheet number once, add its items under it,
// "+ Add Run Sheet" for the next one. Each run sheet also carries its
// delivery date, since an invoice can span a period. The parent owns the
// `groups` array ([{ runSheetNo, date, items: [...] }]) and flattens it into
// invoice items on submit; this component only edits it in place.
import { ref, computed } from 'vue';

const props = defineProps({
  groups: { type: Array, required: true },
  catalog: { type: Array, default: () => [] },
});

function blankItem() {
  return { _search: '', _catalogId: '', jobDescription: '', quantity: 1, unitPrice: '', notes: '' };
}

function addRunSheet() {
  // Default the date from the previous card — run sheets are usually entered day by day
  const last = props.groups[props.groups.length - 1];
  props.groups.push({ runSheetNo: '', date: last?.date || '', items: [blankItem()] });
}

function removeRunSheet(rsIdx) {
  if (props.groups.length > 1) props.groups.splice(rsIdx, 1);
}

function addItem(rsIdx) {
  props.groups[rsIdx].items.push(blankItem());
}

function removeItem(rsIdx, itemIdx) {
  const g = props.groups[rsIdx];
  if (g.items.length > 1) g.items.splice(itemIdx, 1);
}

function rowTotal(item) {
  return (parseFloat(item.quantity || 0) * parseFloat(item.unitPrice || 0)).toFixed(2);
}

function groupTotal(g) {
  return g.items.reduce((s, i) => s + parseFloat(i.quantity || 0) * parseFloat(i.unitPrice || 0), 0).toFixed(2);
}

// ── Catalog autocomplete (Teleported dropdown, same as DeliveryForm) ──
const openCatalogKey = ref(null); // { rsIdx, itemIdx } or null
const dropdownPos = ref({ top: 0, left: 0, minWidth: 260 });
const openItem = computed(() =>
  openCatalogKey.value
    ? props.groups[openCatalogKey.value.rsIdx]?.items[openCatalogKey.value.itemIdx] ?? null
    : null
);

function filteredCatalog(item) {
  const q = (item._search || '').toLowerCase();
  if (!q) return props.catalog.slice(0, 8);
  return props.catalog.filter(c => c.name.toLowerCase().includes(q));
}

function openCatalog(key, event) {
  const rect = event.target.getBoundingClientRect();
  dropdownPos.value = {
    top: rect.bottom + window.scrollY + 4,
    left: rect.left + window.scrollX,
    minWidth: Math.max(260, rect.width),
  };
  openCatalogKey.value = key;
}

function selectCatalog(item, cat) {
  item._catalogId = cat.id;
  item._search = cat.name;
  item.jobDescription = cat.name;
  item.unitPrice = parseFloat(cat.unitPrice);
  openCatalogKey.value = null;
}

function clearCatalog(item) {
  item._catalogId = '';
  item.unitPrice = '';
}

// Catalog-only: typing filters suggestions but never commits as the item
// name — only picking a suggestion (selectCatalog) does that. Mirrors the
// same restriction on DeliveryForm.vue; every item entered here is a
// delivery-type item, so the whole editor is in scope (no service-item split).
// jobDescription is only ever written by selectCatalog(); typing only moves
// _search, so an existing (possibly legacy, possibly non-catalog) committed
// value is never touched just by focusing and blurring a row.
function onItemInput(item, val) {
  item._search = val;
  item._catalogId = '';
}

function onItemBlur(item) {
  setTimeout(() => {
    openCatalogKey.value = null;
    // Revert the visible text to the last confirmed value only if the user
    // actually typed something different and didn't pick a suggestion —
    // never touches jobDescription itself
    if (item && item._search !== item.jobDescription) item._search = item.jobDescription || '';
  }, 160);
}
</script>

<template>
  <div class="space-y-4">
    <div v-for="(rs, rsIdx) in groups" :key="rsIdx" class="rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">

      <!-- RunSheet header: number + date -->
      <div class="flex items-center gap-3 px-4 py-3 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-800/40 flex-wrap">
        <svg class="w-4 h-4 text-indigo-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
        </svg>
        <label class="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400 shrink-0">Run Sheet No.</label>
        <input
          v-model="rs.runSheetNo"
          type="text"
          placeholder="e.g. RS-001"
          class="flex-1 min-w-[100px] text-sm font-semibold bg-transparent border-0 border-b border-dashed border-indigo-300 dark:border-indigo-600 focus:outline-none focus:border-indigo-500 text-gray-900 dark:text-slate-100 placeholder-indigo-300 dark:placeholder-indigo-700"
        />
        <label class="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400 shrink-0 ml-2">Date</label>
        <input
          v-model="rs.date"
          type="date"
          class="text-sm bg-transparent border-0 border-b border-dashed border-indigo-300 dark:border-indigo-600 focus:outline-none focus:border-indigo-500 text-gray-900 dark:text-slate-100"
        />
        <button v-if="groups.length > 1" type="button" @click="removeRunSheet(rsIdx)"
          class="ml-2 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded transition-colors shrink-0">
          Remove
        </button>
      </div>

      <!-- Items for this runsheet -->
      <div class="overflow-x-auto">
        <table class="w-full text-sm border-collapse min-w-[580px]">
          <thead>
            <tr class="bg-gray-50 dark:bg-slate-700/60 border-b border-gray-200 dark:border-slate-600 text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">
              <th class="px-3 py-2.5 text-center w-10">#</th>
              <th class="px-4 py-2.5 text-left">Item / Description</th>
              <th class="px-3 py-2.5 text-right w-24">Qty</th>
              <th class="px-3 py-2.5 text-right w-32">Unit Price</th>
              <th class="px-4 py-2.5 text-right w-32">Amount</th>
              <th class="w-10"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, itemIdx) in rs.items" :key="itemIdx"
              class="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50/50 dark:hover:bg-slate-700/30 transition-colors">
              <td class="px-3 py-3.5 text-center text-gray-300 dark:text-slate-600 text-xs border-r border-gray-100 dark:border-slate-700">{{ itemIdx + 1 }}</td>
              <td class="px-3 py-2.5 border-r border-gray-100 dark:border-slate-700 relative">
                <div class="relative">
                  <input
                    :value="item._search"
                    @input="onItemInput(item, $event.target.value)"
                    @focus="openCatalog({ rsIdx, itemIdx }, $event)"
                    @blur="onItemBlur(item)"
                    type="text" placeholder="Item name…" autocomplete="off"
                    :class="['w-full text-sm rounded-lg border px-3 py-2 pr-7 focus:outline-none focus:ring-2 transition-colors',
                      item._catalogId
                        ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 focus:ring-blue-100 dark:focus:ring-blue-900'
                        : 'border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700/40 text-gray-900 dark:text-slate-100 focus:border-blue-400 focus:ring-blue-50 dark:focus:ring-blue-900/30']"
                  />
                  <button v-if="item._catalogId" type="button" @mousedown.prevent="clearCatalog(item)"
                    class="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-blue-400 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-800/40 text-base font-bold leading-none transition-colors">×</button>
                  <svg v-else class="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300 dark:text-slate-600 pointer-events-none"
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                </div>
                <input v-model="item.notes" type="text" placeholder="+ note"
                  class="mt-1.5 w-full text-xs text-gray-400 dark:text-slate-500 bg-transparent border-0 focus:outline-none placeholder-gray-200 dark:placeholder-slate-700 italic"/>
              </td>
              <td class="px-3 py-3.5 border-r border-gray-100 dark:border-slate-700">
                <input v-model.number="item.quantity" type="number" min="0" step="0.001"
                  class="w-full text-right bg-transparent focus:outline-none text-sm text-gray-900 dark:text-slate-100 tabular-nums" placeholder="0"/>
              </td>
              <td class="px-3 py-3.5 border-r border-gray-100 dark:border-slate-700">
                <div class="flex items-center justify-end gap-1">
                  <span class="text-gray-300 dark:text-slate-600 text-xs">S$</span>
                  <input v-model.number="item.unitPrice" type="number" min="0" step="0.01"
                    :class="['text-right bg-transparent focus:outline-none text-sm w-20 tabular-nums',
                      item._catalogId ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-gray-900 dark:text-slate-100']"
                    placeholder="0.00"/>
                </div>
              </td>
              <td class="px-4 py-3.5 border-r border-gray-100 dark:border-slate-700 text-right">
                <span class="font-semibold text-gray-800 dark:text-slate-200 tabular-nums">S${{ rowTotal(item) }}</span>
              </td>
              <td class="px-2 py-3.5 text-center">
                <button v-if="rs.items.length > 1" type="button" @click="removeItem(rsIdx, itemIdx)"
                  class="w-6 h-6 rounded flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-lg font-bold leading-none">×</button>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="bg-gray-50 dark:bg-slate-700/60 border-t border-gray-200 dark:border-slate-600">
              <td colspan="4" class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-slate-400">Subtotal</td>
              <td class="px-4 py-3 text-right font-bold tabular-nums text-base text-gray-900 dark:text-slate-100">S${{ groupTotal(rs) }}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Add item to this runsheet -->
      <div class="px-4 py-2.5 border-t border-gray-100 dark:border-slate-700">
        <button type="button" @click="addItem(rsIdx)"
          class="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          Add Item
        </button>
      </div>
    </div>

    <!-- Add runsheet -->
    <button type="button" @click="addRunSheet"
      class="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 px-3 py-2 rounded-lg border border-dashed border-indigo-300 dark:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
      </svg>
      Add Run Sheet
    </button>
  </div>

  <!-- Catalog dropdown — Teleported to body to escape overflow clipping -->
  <Teleport to="body">
    <div v-if="openCatalogKey !== null && openItem"
      class="fixed z-[9999] bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-xl max-h-52 overflow-y-auto"
      :style="{ top: dropdownPos.top + 'px', left: dropdownPos.left + 'px', minWidth: dropdownPos.minWidth + 'px' }">
      <div v-if="!filteredCatalog(openItem).length"
        class="px-4 py-3 text-sm text-gray-400 dark:text-slate-500 italic">
        No matching item found
      </div>
      <button
        v-for="cat in filteredCatalog(openItem)" :key="cat.id"
        type="button"
        @mousedown.prevent="selectCatalog(openItem, cat)"
        class="w-full text-left px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center justify-between gap-4 border-b border-gray-50 dark:border-slate-700/60 last:border-0 transition-colors">
        <div>
          <div class="text-sm font-medium text-gray-900 dark:text-slate-100">{{ cat.name }}</div>
          <div v-if="cat.unit" class="text-xs text-gray-400 dark:text-slate-500 mt-0.5">per {{ cat.unit }}</div>
        </div>
        <div class="text-sm font-semibold text-blue-600 dark:text-blue-400 shrink-0 tabular-nums">
          S${{ parseFloat(cat.unitPrice).toFixed(2) }}
        </div>
      </button>
    </div>
  </Teleport>
</template>
