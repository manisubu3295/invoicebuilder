<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { invoicesApi, clientsApi, itemCatalogApi, quotationsApi } from '../../api/index.js';
import { useSettingsStore } from '../../stores/settings.js';
import LineItemEditor from '../../components/shared/LineItemEditor.vue';
import RunSheetItemsEditor from '../../components/shared/RunSheetItemsEditor.vue';

const route = useRoute();
const router = useRouter();
const settingsStore = useSettingsStore();
const isEdit = computed(() => !!route.params.id);
const currency = computed(() => settingsStore.settings?.currency || 'SGD');
const sym = computed(() => settingsStore.settings?.currencySymbol || 'S$');

const form = ref({
  clientId: '', categoryId: '', date: new Date().toISOString().split('T')[0], dueDate: '', notes: '', quotationId: null, bulkRunSheet: false, itemMatrix: false,
  items: [{ sno: 1, itemType: 'service', jobDescription: '', fromDate: '', toDate: '', rate: '', rateType: 'per_week', deliveryDate: '', deliveryDates: [], quantity: 1, unitPrice: '', totalAmount: 0, runSheetNo: '' }],
});
const clients = ref([]);
const catalog = ref([]);
const quotations = ref([]);
const loadedQuotationNo = ref('');
const loading = ref(false);
const error = ref('');
const nextNumber = ref('');
const showRunSheet = computed(() => !!clients.value.find(c => c.id === form.value.clientId)?.requiresRunSheet);

// ── Run-sheet grouped entry (same pattern as the delivery form) ─────
// For run-sheet clients, items are entered grouped per run sheet: type the
// run sheet number + date once, add its items under it. Groups flatten into
// regular delivery-type invoice items on submit, so nothing downstream
// changes. Falls back to the standard editor whenever the invoice has
// service items or multi-date delivery items (existing invoices/quotations
// keep working untouched).
const runSheetMode = ref(false);
const runSheets = ref([]);

function blankRsItem() {
  return { _search: '', _catalogId: '', jobDescription: '', quantity: 1, unitPrice: '', notes: '' };
}
function blankRunSheetGroup() {
  return { runSheetNo: '', date: form.value.date || new Date().toISOString().split('T')[0], items: [blankRsItem()] };
}

function groupItemsToRunSheets(items) {
  const groups = [];
  for (const i of items) {
    const date = (Array.isArray(i.deliveryDates) && i.deliveryDates[0]) || i.deliveryDate || '';
    const rsNo = (i.runSheetNo || '').trim();
    let g = groups.find(x => x.runSheetNo === rsNo && x.date === date);
    if (!g) { g = { runSheetNo: rsNo, date, items: [] }; groups.push(g); }
    g.items.push({
      _search: i.jobDescription,
      _catalogId: catalog.value.find(c => c.name === i.jobDescription)?.id || '',
      jobDescription: i.jobDescription,
      quantity: parseFloat(i.quantity || 1),
      unitPrice: parseFloat(i.unitPrice || 0),
      notes: i.notes || '',
    });
  }
  return groups.length ? groups : [blankRunSheetGroup()];
}

function flattenRunSheets() {
  let sno = 0;
  return runSheets.value.flatMap(g =>
    g.items
      .filter(i => i.jobDescription?.trim())
      .map(i => {
        const qty = parseFloat(i.quantity || 0);
        const price = parseFloat(i.unitPrice || 0);
        return {
          sno: ++sno, itemType: 'delivery', jobDescription: i.jobDescription.trim(),
          fromDate: '', toDate: '', rate: '', rateType: 'per_unit',
          deliveryDate: g.date, deliveryDates: [g.date],
          quantity: qty, unitPrice: price,
          totalAmount: parseFloat((qty * price).toFixed(2)),
          runSheetNo: g.runSheetNo.trim(), notes: i.notes || '',
        };
      })
  );
}

// Decide which editor applies for the current client + items
function evalRunSheetMode() {
  const meaningful = (form.value.items || []).filter(i => i.jobDescription?.trim());
  const eligible = showRunSheet.value
    && meaningful.every(i => i.itemType === 'delivery')
    && !meaningful.some(i => (i.deliveryDates?.length || 0) > 1);
  if (eligible && !runSheetMode.value) runSheets.value = groupItemsToRunSheets(meaningful);
  if (!eligible && runSheetMode.value) form.value.items = flattenRunSheets();
  if (!eligible && !form.value.items.length) form.value.items = [{ sno: 1, itemType: 'service', jobDescription: '', fromDate: '', toDate: '', rate: '', rateType: 'per_week', deliveryDate: '', deliveryDates: [], quantity: 1, unitPrice: '', totalAmount: 0, runSheetNo: '' }];
  runSheetMode.value = eligible;
}

const total = computed(() => runSheetMode.value
  ? runSheets.value.reduce((s, g) => s + g.items.reduce((x, i) => x + parseFloat(i.quantity || 0) * parseFloat(i.unitPrice || 0), 0), 0)
  : form.value.items.reduce((s, i) => s + parseFloat(i.totalAmount || 0), 0));
const clientCategories = computed(() => clients.value.find(c => c.id === form.value.clientId)?.categories || []);
function applyDefaultCategory() {
  const cats = clientCategories.value;
  form.value.categoryId = cats.length === 1 ? cats[0].id : '';
}

async function loadQuotation(quotationId) {
  if (!quotationId) return;
  const { data: q } = await quotationsApi.get(quotationId);
  form.value.quotationId = q.id;
  form.value.clientId = q.clientId;
  form.value.notes = q.notes || '';
  form.value.items = (q.items || []).map((i, idx) => {
    const deliveryDates = i.deliveryDate ? [i.deliveryDate] : [];
    return {
      sno: i.sno || idx + 1, itemType: i.itemType || 'service', jobDescription: i.jobDescription,
      fromDate: i.fromDate || '', toDate: i.toDate || '', rate: i.rate || '', rateType: i.rateType || 'per_week',
      deliveryDate: i.deliveryDate || '', deliveryDates, quantity: i.quantity || 1, unitPrice: i.unitPrice || '',
      totalAmount: i.totalAmount || 0,
    };
  });
  loadedQuotationNo.value = q.quotationNo;
  evalRunSheetMode();
}

function clearQuotation() {
  form.value.quotationId = null;
  loadedQuotationNo.value = '';
}

async function refreshNextNumber() {
  if (isEdit.value) return;
  try { nextNumber.value = (await invoicesApi.getNextNumber(form.value.clientId || undefined, form.value.categoryId || undefined)).data.nextNumber; }
  catch { nextNumber.value = ''; }
}
watch(() => form.value.clientId, () => {
  if (!isEdit.value) {
    applyDefaultCategory();
    const c = clients.value.find(c => c.id === form.value.clientId);
    form.value.bulkRunSheet = !!c?.bulkRunSheet;
    form.value.itemMatrix = !!c?.itemMatrix;
  }
  evalRunSheetMode();
});
watch(() => form.value.categoryId, refreshNextNumber);

onMounted(async () => {
  await settingsStore.fetchSettings();
  [clients.value, catalog.value] = await Promise.all([
    clientsApi.list().then(r => r.data),
    itemCatalogApi.list().then(r => r.data).catch(() => []),
  ]);
  if (isEdit.value) {
    const { data } = await invoicesApi.get(route.params.id);
    form.value = {
      clientId: data.clientId, categoryId: data.categoryId || '', date: data.date, dueDate: data.dueDate || '', notes: data.notes || '', quotationId: data.quotationId || null,
      bulkRunSheet: !!data.bulkRunSheet, itemMatrix: !!data.itemMatrix,
      items: (data.items || []).map(i => {
        let deliveryDates = [];
        try { deliveryDates = i.deliveryDates ? JSON.parse(i.deliveryDates) : []; } catch {}
        if (!deliveryDates.length && i.deliveryDate) deliveryDates = [i.deliveryDate];
        return { ...i, itemType: i.itemType || 'service', deliveryDate: i.deliveryDate || '', deliveryDates, quantity: i.quantity || 1, unitPrice: i.unitPrice || '' };
      }),
    };
    evalRunSheetMode();
  } else {
    await refreshNextNumber();
    quotationsApi.list().then(r => {
      quotations.value = r.data.filter(q => !['converted', 'rejected'].includes(q.status));
    });
    if (route.query.quotationId) await loadQuotation(route.query.quotationId);
  }
});

// The two invoice PDF formats are mutually exclusive — picking one clears the other
function pickBulkRunSheet() { if (form.value.bulkRunSheet) form.value.itemMatrix = false; }
function pickItemMatrix() { if (form.value.itemMatrix) form.value.bulkRunSheet = false; }

async function submit() {
  error.value = '';
  if (!isEdit.value && !form.value.categoryId) {
    error.value = 'Please select a category.';
    return;
  }
  if (runSheetMode.value) {
    const filled = runSheets.value.filter(g => g.items.some(i => i.jobDescription?.trim()));
    if (!filled.length) { error.value = 'Please enter at least one item.'; return; }
    for (const g of filled) {
      if (!g.runSheetNo?.trim()) { error.value = 'Please enter a Run Sheet No. for every run sheet.'; return; }
      if (!g.date) { error.value = 'Please select a date for every run sheet.'; return; }
    }
    form.value.items = flattenRunSheets();
  }
  for (const item of form.value.items) {
    if (item.itemType === 'delivery') {
      if (!item.deliveryDates?.length) {
        error.value = 'Please add at least one delivery date for each delivery item.';
        return;
      }
    } else {
      if (!item.fromDate || !item.toDate) {
        error.value = 'Please fill in From Date and To Date for all service items.';
        return;
      }
    }
  }
  loading.value = true;
  try {
    let inv;
    if (isEdit.value) inv = (await invoicesApi.update(route.params.id, form.value)).data;
    else inv = (await invoicesApi.create(form.value)).data;
    router.push(`/invoices/${inv.id}`);
  } catch (e) { error.value = e.response?.data?.message || 'Error saving invoice'; }
  finally { loading.value = false; }
}
</script>

<template>
  <div class="page-container max-w-5xl">
    <div class="flex items-center gap-3 mb-6">
      <RouterLink to="/invoices" class="btn-icon text-gray-500"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg></RouterLink>
      <h1 class="page-title">{{ isEdit ? 'Edit Invoice' : 'New Invoice' }}</h1>
      <span v-if="!isEdit && nextNumber" class="text-sm text-gray-400 dark:text-slate-500">Next No: <strong class="text-gray-600 dark:text-slate-300">{{ nextNumber }}</strong></span>
    </div>

    <div class="card mb-4">
      <div v-if="error" class="alert-error mb-5">{{ error }}</div>

      <div v-if="!isEdit" class="input-group mb-5">
        <label class="input-label">Load from Quotation (optional)</label>
        <div v-if="form.quotationId" class="flex items-center gap-2 text-sm">
          <span class="font-medium">{{ loadedQuotationNo }}</span>
          <button type="button" @click="clearQuotation" class="text-xs text-gray-400 hover:text-red-600">✕ clear</button>
        </div>
        <select v-else @change="loadQuotation($event.target.value)" class="input-field">
          <option value="">None — create from scratch</option>
          <option v-for="q in quotations" :key="q.id" :value="q.id">{{ q.quotationNo }} — {{ q.client?.companyName }}</option>
        </select>
        <p class="text-xs text-gray-400 dark:text-slate-500 mt-1">Pre-fills the client and line items below; you can still edit everything before saving. The quotation will be marked as converted once this invoice is created.</p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
        <div class="input-group">
          <label class="input-label">Client *</label>
          <select v-model="form.clientId" class="input-field">
            <option value="">Select client…</option>
            <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.companyName }}{{ c.clientCode ? ` (${c.clientCode})` : '' }}</option>
          </select>
        </div>
        <div class="input-group" v-if="!isEdit && form.clientId">
          <label class="input-label">Category *</label>
          <div v-if="clientCategories.length === 1" class="input-field bg-gray-50 text-gray-600 select-none">
            {{ clientCategories[0].name }}
          </div>
          <select v-else-if="clientCategories.length > 1" v-model="form.categoryId" class="input-field">
            <option value="">Select category…</option>
            <option v-for="c in clientCategories" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
          <div v-else class="input-field bg-amber-50 text-amber-700 text-xs flex items-center">
            No categories assigned to this client —
            <RouterLink to="/clients" class="underline font-medium ml-1">add one</RouterLink>
          </div>
        </div>
        <div v-if="isEdit && form.categoryId" class="input-group">
          <label class="input-label">Category</label>
          <div class="input-field bg-gray-50 text-gray-600 select-none">
            {{ clients.find(c => c.id === form.clientId)?.categories?.find(c => c.id === form.categoryId)?.name || '—' }}
          </div>
        </div>
        <div class="input-group"><label class="input-label">Invoice Date *</label><input v-model="form.date" type="date" class="input-field"/></div>
        <div class="input-group"><label class="input-label">Due Date</label><input v-model="form.dueDate" type="date" class="input-field"/></div>
        <div class="input-group sm:col-span-2"><label class="input-label">Notes</label><textarea v-model="form.notes" class="input-field" rows="2" placeholder="Optional notes for the client"></textarea></div>
      </div>

      <div class="section-label mb-3">Line Items</div>
      <template v-if="runSheetMode">
        <p class="text-xs text-gray-400 dark:text-slate-500 mb-3">
          This client uses run sheets — enter each run sheet number and date once, then add all its items below it.
        </p>
        <RunSheetItemsEditor :groups="runSheets" :catalog="catalog" />
        <label class="flex items-center gap-2.5 cursor-pointer mt-4">
          <input v-model="form.bulkRunSheet" @change="pickBulkRunSheet" type="checkbox" class="w-4 h-4 rounded accent-blue-600"/>
          <span class="text-sm text-gray-700">Bulk run-sheet invoice format
            <span class="text-xs text-gray-400 font-normal ml-1">— No / Date / Run Sheet / Item / Count / Total, subtotal per run sheet</span>
          </span>
        </label>
        <label class="flex items-center gap-2.5 cursor-pointer mt-2">
          <input v-model="form.itemMatrix" @change="pickItemMatrix" type="checkbox" class="w-4 h-4 rounded accent-blue-600"/>
          <span class="text-sm text-gray-700">Item matrix invoice format
            <span class="text-xs text-gray-400 font-normal ml-1">— No / Date / Run Sheet, one column per item, Total, with a period total row</span>
          </span>
        </label>
      </template>
      <LineItemEditor v-else v-model="form.items" :catalog="catalog" :show-run-sheet="showRunSheet" />

      <div class="flex justify-end mt-5 pt-5 border-t border-gray-100">
        <div class="text-right">
          <div class="section-label mb-1">AMOUNT DUE ({{ currency }})</div>
          <div class="text-2xl font-light text-gray-900 tabular-nums">{{ sym }}{{ total.toFixed(2) }}</div>
        </div>
      </div>
    </div>

    <div class="flex gap-3">
      <button @click="submit" :disabled="loading || !form.clientId || (!isEdit && !form.categoryId)" class="btn-primary">{{ loading ? 'Saving…' : (isEdit ? 'Update Invoice' : 'Create Invoice') }}</button>
      <RouterLink to="/invoices" class="btn-secondary">Cancel</RouterLink>
    </div>
  </div>
</template>
