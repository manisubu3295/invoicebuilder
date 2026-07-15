<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { clientsApi, deliveriesApi, itemCatalogApi } from '../../api/index.js';
import { useAuthStore } from '../../stores/auth.js';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();
const isEdit = computed(() => !!route.params.id);

const clients = ref([]);
const catalog = ref([]);
const deliverers = ref([]);
const saving = ref(false);
const loading = ref(false);
const error = ref('');

const form = ref({
  clientId: '',
  categoryId: '',
  deliveryDate: new Date().toISOString().slice(0, 10),
  deliveredById: '',
  notes: '',
  items: [blankItem()],
  runSheets: [blankRunSheet()],
});

// ── Category (per-client, mandatory) ────────────────────────────────
const clientCategories = computed(() => clients.value.find(c => c.id === form.value.clientId)?.categories || []);
function onClientChange() {
  const cats = clientCategories.value;
  form.value.categoryId = cats.length === 1 ? cats[0].id : '';
}
const showRunSheet = computed(() => !!clients.value.find(c => c.id === form.value.clientId)?.requiresRunSheet);

// ── Delivered By combobox ──────────────────────────────────────────
const delivererSearch = ref('');
const delivererOpen = ref(false);

const filteredDeliverers = computed(() => {
  const q = delivererSearch.value.toLowerCase();
  return q
    ? deliverers.value.filter(u => u.name.toLowerCase().includes(q))
    : deliverers.value;
});

function selectDeliverer(u) {
  form.value.deliveredById = u.id;
  delivererSearch.value = u.name;
  delivererOpen.value = false;
}

function onDelivererInput() {
  form.value.deliveredById = '';
  delivererOpen.value = true;
}

function onDelivererBlur() {
  setTimeout(() => {
    // If nothing matched, restore last valid name
    if (!form.value.deliveredById) {
      const match = deliverers.value.find(u => u.name.toLowerCase() === delivererSearch.value.toLowerCase());
      if (match) selectDeliverer(match);
    }
    delivererOpen.value = false;
  }, 160);
}

// ── Items ──────────────────────────────────────────────────────────
function blankItem() {
  return { _search: '', _catalogId: '', itemName: '', quantity: 1, unitPrice: '', notes: '' };
}

function blankRunSheet() {
  return { runSheetNo: '', items: [blankItem()] };
}

function addRunSheet() {
  form.value.runSheets.push(blankRunSheet());
}

function removeRunSheet(rsIdx) {
  if (form.value.runSheets.length > 1) form.value.runSheets.splice(rsIdx, 1);
}

function addRunSheetItem(rsIdx) {
  form.value.runSheets[rsIdx].items.push(blankItem());
}

function removeRunSheetItem(rsIdx, itemIdx) {
  const rs = form.value.runSheets[rsIdx];
  if (rs.items.length > 1) rs.items.splice(itemIdx, 1);
}

const runSheetGrandTotal = computed(() =>
  form.value.runSheets.reduce((total, rs) =>
    total + rs.items.reduce((s, i) => s + parseFloat(i.quantity || 0) * parseFloat(i.unitPrice || 0), 0),
  0).toFixed(2)
);

const openCatalogKey = ref(null); // { flat: idx } or { rsIdx, itemIdx } or null
const dropdownPos = ref({ top: 0, left: 0, minWidth: 260 });
const openItem = computed(() => {
  if (!openCatalogKey.value) return null;
  if (openCatalogKey.value.flat !== undefined) return form.value.items[openCatalogKey.value.flat];
  return form.value.runSheets[openCatalogKey.value.rsIdx]?.items[openCatalogKey.value.itemIdx] ?? null;
});

function filteredCatalog(item) {
  const q = (item._search || '').toLowerCase();
  if (!q) return catalog.value.slice(0, 8);
  return catalog.value.filter(c => c.name.toLowerCase().includes(q));
}

function openCatalog(item, key, event) {
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
  item.itemName = cat.name;
  item.unitPrice = parseFloat(cat.unitPrice);
  openCatalogKey.value = null;
}

function clearCatalog(item) {
  item._catalogId = '';
  item.unitPrice = '';
}

// Drivers may only log catalog items — typing filters the dropdown (so they
// can still search) but never commits free text as the item name; only
// picking a suggestion via selectCatalog() does that. Admin/staff keep the
// original type-anything behaviour.
const isDriver = computed(() => auth.user?.role === 'driver');

function onItemInput(item, val) {
  item._search = val;
  item._catalogId = '';
  if (!isDriver.value) item.itemName = val;
}

function onItemBlur(item) {
  setTimeout(() => {
    openCatalogKey.value = null;
    // Revert the visible text to the last confirmed value only if the
    // driver actually typed something different and didn't pick a
    // suggestion — never touches itemName itself, so an existing (possibly
    // legacy, possibly non-catalog) item is never wiped by a bare
    // focus+blur with no edits
    if (isDriver.value && item && item._search !== item.itemName) item._search = item.itemName || '';
  }, 160);
}

function addItem() { form.value.items.push(blankItem()); }
function removeItem(idx) { if (form.value.items.length > 1) form.value.items.splice(idx, 1); }

function rowTotal(item) {
  return (parseFloat(item.quantity || 0) * parseFloat(item.unitPrice || 0)).toFixed(2);
}

const grandTotal = computed(() =>
  form.value.items.reduce((s, i) => s + parseFloat(i.quantity || 0) * parseFloat(i.unitPrice || 0), 0).toFixed(2)
);

// ── Lifecycle ──────────────────────────────────────────────────────
onMounted(async () => {
  const [clientsRes, catalogRes] = await Promise.all([
    clientsApi.list(),
    itemCatalogApi.list(),
  ]);
  clients.value = clientsRes.data;
  catalog.value = catalogRes.data;

  if (auth.user?.role !== 'driver') {
    try {
      const res = await deliveriesApi.deliverers();
      deliverers.value = res.data;
    } catch {
      deliverers.value = [{ id: auth.user.id, name: auth.user.name, role: auth.user.role }];
    }
  }

  // Default to current user
  form.value.deliveredById = auth.user?.id || '';
  delivererSearch.value = auth.user?.name || '';

  if (isEdit.value) {
    loading.value = true;
    try {
      const { data: log } = await deliveriesApi.get(route.params.id);
      form.value.clientId = log.clientId;
      form.value.categoryId = log.categoryId || '';
      form.value.deliveryDate = log.deliveryDate;
      form.value.deliveredById = log.deliveredById;
      form.value.notes = log.notes || '';

      const deliverer = deliverers.value.find(u => u.id === log.deliveredById);
      delivererSearch.value = deliverer?.name || log.deliveredBy?.name || '';

      const requiresRunSheet = clients.value.find(c => c.id === log.clientId)?.requiresRunSheet;
      if (requiresRunSheet) {
        const grouped = {};
        const order = [];
        log.items.forEach(i => {
          const key = i.runSheetNo || '';
          if (!grouped[key]) { grouped[key] = []; order.push(key); }
          grouped[key].push(i);
        });
        form.value.runSheets = order.map(rsNo => ({
          runSheetNo: rsNo,
          items: grouped[rsNo].map(i => ({
            _search: i.itemName,
            _catalogId: catalog.value.find(c => c.name === i.itemName)?.id || '',
            itemName: i.itemName,
            quantity: parseFloat(i.quantity),
            unitPrice: parseFloat(i.unitPrice),
            notes: i.notes || '',
          }))
        }));
        if (!form.value.runSheets.length) form.value.runSheets = [blankRunSheet()];
      } else {
        form.value.items = log.items.map(i => {
          const cat = catalog.value.find(c => c.name === i.itemName);
          return {
            _search: i.itemName,
            _catalogId: cat?.id || '',
            itemName: i.itemName,
            quantity: parseFloat(i.quantity),
            unitPrice: parseFloat(i.unitPrice),
            notes: i.notes || '',
          };
        });
      }
    } catch { error.value = 'Failed to load delivery entry.'; }
    finally { loading.value = false; }
  }
});

async function save() {
  error.value = '';
  if (!form.value.clientId) { error.value = 'Please select a client.'; return; }
  if (!form.value.categoryId) { error.value = 'Please select a category.'; return; }
  if (!form.value.deliveryDate) { error.value = 'Please select a delivery date.'; return; }
  if (!form.value.deliveredById) { error.value = 'Please select who delivered.'; return; }
  let validItems;
  if (showRunSheet.value) {
    // This client requires run sheets — every group with items needs a number
    const missingRs = form.value.runSheets.some(rs =>
      rs.items.some(i => i.itemName.trim()) && !rs.runSheetNo.trim());
    if (missingRs) { error.value = 'Please enter a Run Sheet No. for every run sheet.'; return; }
    validItems = form.value.runSheets.flatMap(rs =>
      rs.items
        .filter(i => i.itemName.trim())
        .map(i => ({ ...i, runSheetNo: rs.runSheetNo.trim() }))
    );
  } else {
    validItems = form.value.items
      .filter(i => i.itemName.trim())
      .map(i => ({ ...i, runSheetNo: '' }));
  }
  if (!validItems.length) { error.value = 'Please enter at least one item.'; return; }
  saving.value = true;
  try {
    const payload = {
      clientId: form.value.clientId,
      categoryId: form.value.categoryId,
      deliveryDate: form.value.deliveryDate,
      deliveredById: form.value.deliveredById,
      notes: form.value.notes,
      items: validItems,
    };
    if (isEdit.value) await deliveriesApi.update(route.params.id, payload);
    else await deliveriesApi.create(payload);
    router.push('/delivery-log');
  } catch (e) { error.value = e.response?.data?.message || 'Save failed.'; }
  finally { saving.value = false; }
}
</script>

<template>
  <div class="page-container max-w-4xl">

    <!-- Page header -->
    <div class="flex items-center gap-3 mb-6">
      <button @click="router.push('/delivery-log')" class="btn-icon text-gray-500">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
        </svg>
      </button>
      <h1 class="page-title">{{ isEdit ? 'Edit Delivery Entry' : 'Log Delivery' }}</h1>
    </div>

    <div v-if="loading" class="text-center py-12 text-gray-400 text-sm">Loading…</div>

    <form v-else @submit.prevent="save" class="space-y-4">
      <div v-if="error" class="alert-error">{{ error }}</div>

      <!-- ── Header fields ── -->
      <div class="card">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">

          <!-- Client -->
          <div class="input-group lg:col-span-2">
            <label class="input-label">Client *</label>
            <select v-model="form.clientId" @change="onClientChange" class="input-field">
              <option value="">Select client…</option>
              <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.companyName }}</option>
            </select>
          </div>

          <!-- Category -->
          <div class="input-group" v-if="form.clientId">
            <label class="input-label">Category *</label>
            <div v-if="clientCategories.length === 1" class="input-field bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-slate-300 select-none">
              {{ clientCategories[0].name }}
            </div>
            <select v-else-if="clientCategories.length > 1" v-model="form.categoryId" class="input-field">
              <option value="">Select category…</option>
              <option v-for="c in clientCategories" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
            <div v-else class="input-field bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs flex items-center">
              No categories assigned to this client —
              <RouterLink to="/clients" class="underline font-medium ml-1">add one</RouterLink>
            </div>
          </div>

          <!-- Date -->
          <div class="input-group">
            <label class="input-label">Delivery Date *</label>
            <input v-model="form.deliveryDate" type="date" class="input-field"/>
          </div>

          <!-- Delivered By -->
          <div class="input-group">
            <label class="input-label">Delivered By *</label>

            <!-- Driver: locked to self -->
            <div v-if="auth.user?.role === 'driver'"
              class="input-field bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-slate-300 select-none">
              {{ auth.user.name }}
            </div>

            <!-- Admin / Staff: searchable combobox -->
            <div v-else class="relative">
              <div class="relative">
                <input
                  v-model="delivererSearch"
                  type="text"
                  placeholder="Search name…"
                  class="input-field pr-8"
                  autocomplete="off"
                  @focus="delivererOpen = true"
                  @blur="onDelivererBlur"
                  @input="onDelivererInput"
                />
                <svg class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
              </div>

              <!-- Dropdown -->
              <div v-if="delivererOpen && filteredDeliverers.length"
                class="absolute z-30 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-xl max-h-52 overflow-y-auto">
                <button
                  v-for="u in filteredDeliverers" :key="u.id"
                  type="button"
                  @mousedown.prevent="selectDeliverer(u)"
                  class="w-full text-left px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center gap-3 transition-colors">
                  <div class="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-600/30 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-400 uppercase shrink-0">
                    {{ u.name.charAt(0) }}
                  </div>
                  <div class="min-w-0">
                    <div class="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{{ u.name }}</div>
                    <div class="text-xs text-gray-400 dark:text-slate-500 capitalize">{{ u.role }}</div>
                  </div>
                  <svg v-if="form.deliveredById === u.id" class="w-4 h-4 text-blue-600 ml-auto shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
                  </svg>
                </button>
                <div v-if="!filteredDeliverers.length" class="px-4 py-3 text-sm text-gray-400">No match</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Entry notes -->
        <div class="input-group mt-4">
          <label class="input-label">
            Entry Notes
            <span class="text-gray-400 dark:text-slate-500 font-normal ml-1">(optional)</span>
          </label>
          <input v-model="form.notes" type="text"
            placeholder="e.g. Delivery to Main Gate, special handling…"
            class="input-field"/>
        </div>
      </div>

      <!-- ── Items table (flat mode — no run sheet required) ── -->
      <div v-if="!showRunSheet" class="card p-0 overflow-hidden">
        <div class="card-header">
          <span class="card-title">Items Delivered</span>
          <button type="button" @click="addItem"
            class="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
            Add Row
          </button>
        </div>
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
              <tr v-for="(item, idx) in form.items" :key="idx"
                class="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50/50 dark:hover:bg-slate-700/30 transition-colors">
                <td class="px-3 py-3.5 text-center text-gray-300 dark:text-slate-600 text-xs border-r border-gray-100 dark:border-slate-700">{{ idx + 1 }}</td>
                <td class="px-3 py-2.5 border-r border-gray-100 dark:border-slate-700 relative">
                  <div class="relative">
                    <input
                      :value="item._search"
                      @input="onItemInput(item, $event.target.value)"
                      @focus="openCatalog(item, { flat: idx }, $event)"
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
                  <button v-if="form.items.length > 1" type="button" @click="removeItem(idx)"
                    class="w-6 h-6 rounded flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-lg font-bold leading-none">×</button>
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="bg-gray-50 dark:bg-slate-700/60 border-t border-gray-200 dark:border-slate-600">
                <td colspan="4" class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-slate-400">Total Amount</td>
                <td class="px-4 py-3 text-right font-bold tabular-nums text-base text-gray-900 dark:text-slate-100">S${{ grandTotal }}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <!-- ── RunSheet groups (clients that require run sheets) ── -->
      <template v-else>
        <div v-for="(rs, rsIdx) in form.runSheets" :key="rsIdx" class="card p-0 overflow-hidden">

          <!-- RunSheet header -->
          <div class="flex items-center gap-3 px-4 py-3 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-800/40">
            <svg class="w-4 h-4 text-indigo-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
            <label class="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400 shrink-0">Run Sheet No.</label>
            <input
              v-model="rs.runSheetNo"
              type="text"
              placeholder="e.g. RS-001"
              class="flex-1 min-w-0 text-sm font-semibold bg-transparent border-0 border-b border-dashed border-indigo-300 dark:border-indigo-600 focus:outline-none focus:border-indigo-500 text-gray-900 dark:text-slate-100 placeholder-indigo-300 dark:placeholder-indigo-700"
            />
            <button v-if="form.runSheets.length > 1" type="button" @click="removeRunSheet(rsIdx)"
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
                        @focus="openCatalog(item, { rsIdx, itemIdx }, $event)"
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
                    <button v-if="rs.items.length > 1" type="button" @click="removeRunSheetItem(rsIdx, itemIdx)"
                      class="w-6 h-6 rounded flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-lg font-bold leading-none">×</button>
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr class="bg-gray-50 dark:bg-slate-700/60 border-t border-gray-200 dark:border-slate-600">
                  <td colspan="4" class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-slate-400">Subtotal</td>
                  <td class="px-4 py-3 text-right font-bold tabular-nums text-base text-gray-900 dark:text-slate-100">
                    S${{ rs.items.reduce((s, i) => s + parseFloat(i.quantity || 0) * parseFloat(i.unitPrice || 0), 0).toFixed(2) }}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <!-- Add item to this runsheet -->
          <div class="px-4 py-2.5 border-t border-gray-100 dark:border-slate-700">
            <button type="button" @click="addRunSheetItem(rsIdx)"
              class="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
              </svg>
              Add Item
            </button>
          </div>
        </div>

        <!-- Add runsheet + grand total -->
        <div class="flex items-center justify-between">
          <button type="button" @click="addRunSheet"
            class="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 px-3 py-2 rounded-lg border border-dashed border-indigo-300 dark:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
            Add Run Sheet
          </button>
          <div class="text-sm font-bold text-gray-800 dark:text-slate-200 tabular-nums">
            Grand Total: <span class="text-base">S${{ runSheetGrandTotal }}</span>
          </div>
        </div>
      </template>

      <!-- No catalog warning -->
      <div v-if="!catalog.length" class="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-lg px-4 py-3">
        No items in catalog yet.
        <RouterLink to="/item-catalog" class="underline font-medium ml-1">Add items to the catalog</RouterLink>
        to enable price auto-fill when typing.
      </div>

      <!-- Actions -->
      <div class="flex gap-3 justify-end pt-1">
        <button type="button" @click="router.push('/delivery-log')" class="btn-secondary">Cancel</button>
        <button type="submit" :disabled="saving" class="btn-primary px-6">
          {{ saving ? 'Saving…' : (isEdit ? 'Update Entry' : 'Save Delivery') }}
        </button>
      </div>
    </form>

    <!-- Catalog dropdown — Teleported to body to escape overflow-hidden/overflow-x-auto clipping -->
    <Teleport to="body">
      <div v-if="openCatalogKey !== null && openItem"
        class="fixed z-[9999] bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-xl max-h-52 overflow-y-auto"
        :style="{ top: dropdownPos.top + 'px', left: dropdownPos.left + 'px', minWidth: dropdownPos.minWidth + 'px' }">
        <div v-if="!filteredCatalog(openItem).length"
          class="px-4 py-3 text-sm text-gray-400 dark:text-slate-500 italic">
          {{ isDriver ? 'No matching item found' : 'No catalog match — type to save as custom' }}
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
  </div>
</template>
