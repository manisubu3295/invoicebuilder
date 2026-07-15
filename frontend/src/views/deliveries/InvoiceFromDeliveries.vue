<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { clientsApi, deliveriesApi } from '../../api/index.js';
import { useSettingsStore } from '../../stores/settings.js';
import { clubDeliveryRows, formatQty } from '../../utils/clubDeliveryRows.js';

const router = useRouter();
const route = useRoute();
const settingsStore = useSettingsStore();

const clients = ref([]);
const preview = ref(null);
const loading = ref(false);
const creating = ref(false);
const error = ref('');

const filters = ref({
  clientId: route.query.clientId || '',
  categoryId: '',
  startDate: route.query.startDate || '',
  endDate: route.query.endDate || '',
});

const invoiceDate = ref(new Date().toISOString().slice(0, 10));
const notes = ref('');
// Bulk run-sheet / item-matrix PDF layouts (mutually exclusive) — default
// from the client's setting, can be overridden per invoice
const bulkRunSheet = ref(false);
const itemMatrix = ref(false);
function pickBulkRunSheet() { if (bulkRunSheet.value) itemMatrix.value = false; }
function pickItemMatrix() { if (itemMatrix.value) bulkRunSheet.value = false; }

const sym = computed(() => settingsStore.settings?.currencySymbol || 'S$');
const selectedClient = computed(() => clients.value.find(c => c.id === filters.value.clientId));
const selectedClientName = computed(() => selectedClient.value?.companyName || '');
const clientCategories = computed(() => selectedClient.value?.categories || []);

function onClientChange() {
  const cats = clientCategories.value;
  filters.value.categoryId = cats.length === 1 ? cats[0].id : '';
  bulkRunSheet.value = !!selectedClient.value?.bulkRunSheet;
  itemMatrix.value = !!selectedClient.value?.itemMatrix;
  preview.value = null;
}

onMounted(async () => {
  const [{ data }] = await Promise.all([clientsApi.list(), settingsStore.fetchSettings()]);
  clients.value = data;
  if (filters.value.clientId) onClientChange();
  if (filters.value.clientId && filters.value.categoryId && filters.value.startDate && filters.value.endDate) {
    await loadPreview();
  }
});

async function loadPreview() {
  error.value = '';
  if (!filters.value.clientId || !filters.value.startDate || !filters.value.endDate) {
    error.value = 'Please select a client and date range.'; return;
  }
  if (!filters.value.categoryId) {
    error.value = 'Please select a category.'; return;
  }
  loading.value = true;
  try {
    const { data } = await deliveriesApi.preview(filters.value);
    if (!data.rows.length) {
      error.value = 'No pending delivery entries found for this client and date range.';
      preview.value = null;
    } else { preview.value = data; }
  } catch (e) { error.value = e.response?.data?.message || 'Failed to load preview.'; }
  finally { loading.value = false; }
}

function recalcRow(row) {
  row.totalAmount = parseFloat((parseFloat(row.quantity || 0) * parseFloat(row.unitPrice || 0)).toFixed(2));
}
function removeRow(idx) { preview.value.rows.splice(idx, 1); }

const grandTotal = computed(() => preview.value?.rows.reduce((s, r) => s + parseFloat(r.totalAmount || 0), 0) || 0);

// Client view: same-day same-item rows clubbed into one line, exactly as the
// invoice will print. Editing happens in the Detailed view; this is read-only.
const viewMode = ref('detailed'); // 'detailed' | 'client'
const clubbedRows = computed(() => preview.value ? clubDeliveryRows(preview.value.rows) : []);
const clubbedHasRunSheet = computed(() => clubbedRows.value.some(r => r.runSheetNo));

function formatDate(d) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const dueDate = computed(() => {
  if (!invoiceDate.value) return '';
  const days = settingsStore.settings?.paymentTermsDays || 30;
  const d = new Date(invoiceDate.value); d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
});

async function createInvoice() {
  if (!preview.value?.rows.length) return;
  error.value = '';
  creating.value = true;
  try {
    const { data } = await deliveriesApi.createInvoice({
      clientId: filters.value.clientId, categoryId: filters.value.categoryId, date: invoiceDate.value, dueDate: dueDate.value,
      periodStart: filters.value.startDate, periodEnd: filters.value.endDate,
      notes: notes.value, rows: preview.value.rows,
      bulkRunSheet: bulkRunSheet.value,
      itemMatrix: itemMatrix.value,
    });
    router.push(`/invoices/${data.id}`);
  } catch (e) { error.value = e.response?.data?.message || 'Failed to create invoice.'; }
  finally { creating.value = false; }
}
</script>

<template>
  <div class="page-container max-w-5xl">
    <div class="flex items-center gap-3 mb-6">
      <button @click="router.push('/delivery-log')" class="btn-icon text-gray-500">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
      </button>
      <div>
        <h1 class="page-title mb-0">Generate Invoice from Deliveries</h1>
        <p class="page-subtitle mt-0.5">Pull pending delivery entries for a client into a new invoice.</p>
      </div>
    </div>

    <!-- Step 1 -->
    <div class="card mb-5">
      <div class="flex items-center gap-2 mb-5">
        <span class="step-circle-active">1</span>
        <h2 class="font-medium text-gray-800">Select Client &amp; Date Range</h2>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-4 gap-5">
        <div class="input-group">
          <label class="input-label">Client *</label>
          <select v-model="filters.clientId" @change="onClientChange" class="input-field">
            <option value="">Select client…</option>
            <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.companyName }}</option>
          </select>
        </div>
        <div class="input-group" v-if="filters.clientId">
          <label class="input-label">Category *</label>
          <div v-if="clientCategories.length === 1" class="input-field bg-gray-50 text-gray-600 select-none">
            {{ clientCategories[0].name }}
          </div>
          <select v-else-if="clientCategories.length > 1" v-model="filters.categoryId" class="input-field">
            <option value="">Select category…</option>
            <option v-for="c in clientCategories" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
          <div v-else class="input-field bg-amber-50 text-amber-700 text-xs flex items-center">
            No categories —
            <RouterLink to="/clients" class="underline font-medium ml-1">add one</RouterLink>
          </div>
        </div>
        <div class="input-group"><label class="input-label">From *</label><input v-model="filters.startDate" type="date" class="input-field"/></div>
        <div class="input-group"><label class="input-label">To *</label><input v-model="filters.endDate" type="date" class="input-field"/></div>
        <div class="flex items-end">
          <button @click="loadPreview" :disabled="loading" class="btn-primary w-full">{{ loading ? 'Loading…' : 'Load Preview' }}</button>
        </div>
      </div>
    </div>

    <div v-if="error" class="alert-error mb-5">{{ error }}</div>

    <template v-if="preview">
      <!-- Step 2 -->
      <div class="card p-0 mb-5">
        <div class="card-header">
          <div class="flex items-center gap-2">
            <span class="step-circle-active">2</span>
            <span class="card-title">Review &amp; Edit — <span class="font-normal text-gray-500">{{ selectedClientName }}</span></span>
          </div>
          <div class="flex items-center gap-2">
            <div class="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
              <button @click="viewMode = 'detailed'" class="px-3 py-1.5 transition-colors"
                :class="viewMode === 'detailed' ? 'bg-gray-800 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'">Detailed</button>
              <button @click="viewMode = 'client'" class="px-3 py-1.5 transition-colors"
                :class="viewMode === 'client' ? 'bg-gray-800 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'">Client view</button>
            </div>
            <span class="text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-full px-3 py-1">
              {{ viewMode === 'detailed' ? `${preview.rows.length} rows` : `${clubbedRows.length} invoice lines` }}
            </span>
          </div>
        </div>
        <div v-if="viewMode === 'client'" class="overflow-x-auto">
          <div class="px-4 py-2 text-xs text-gray-400 bg-blue-50/50 border-b border-gray-100">
            Same-day deliveries of the same item and run sheet are clubbed into one line on the invoice, regardless of driver — all items of a run sheet appear together. Switch to Detailed to edit rows.
          </div>
          <table class="mat-table">
            <thead>
              <tr>
                <th class="w-28">Date</th>
                <th>Item</th>
                <th v-if="clubbedHasRunSheet" class="w-32">Run Sheet</th>
                <th class="text-right w-24">Qty</th>
                <th class="text-right w-28">Unit Price</th>
                <th class="text-right w-28">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, idx) in clubbedRows" :key="idx">
                <td class="text-xs text-gray-500">{{ formatDate(row.deliveryDate) }}</td>
                <td>
                  <span class="text-sm text-gray-800">{{ row.itemName }}</span>
                  <div v-if="row.notes" class="text-xs text-gray-400 italic">{{ row.notes }}</div>
                </td>
                <td v-if="clubbedHasRunSheet" class="text-xs text-gray-600">{{ row.runSheetNo || '—' }}</td>
                <td class="text-right text-sm tabular-nums">{{ formatQty(row.quantity) }}</td>
                <td class="text-right text-sm tabular-nums">{{ sym }}{{ parseFloat(row.unitPrice || 0).toFixed(2) }}</td>
                <td class="text-right font-semibold text-gray-700 tabular-nums">{{ sym }}{{ parseFloat(row.totalAmount || 0).toFixed(2) }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="bg-gray-800 text-white">
                <td :colspan="clubbedHasRunSheet ? 5 : 4" class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide">Total Amount Due</td>
                <td class="px-4 py-3 text-right font-bold tabular-nums">{{ sym }}{{ grandTotal.toFixed(2) }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div v-else class="overflow-x-auto">
          <table class="mat-table">
            <thead>
              <tr>
                <th class="w-28">Date</th>
                <th class="w-28">Delivered By</th>
                <th>Item</th>
                <th class="text-right w-24">Qty</th>
                <th class="text-right w-28">Unit Price</th>
                <th class="text-right w-28">Total</th>
                <th class="w-8"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, idx) in preview.rows" :key="idx">
                <td class="text-xs text-gray-500">{{ formatDate(row.deliveryDate) }}</td>
                <td class="text-xs text-gray-600">{{ row.deliveredBy }}</td>
                <td>
                  <input v-model="row.itemName" type="text"
                    class="w-full border-b border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent py-1 text-sm"/>
                </td>
                <td>
                  <input v-model.number="row.quantity" type="number" min="0" step="0.001" @input="recalcRow(row)"
                    class="w-full text-right border-b border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent py-1 text-sm"/>
                </td>
                <td>
                  <input v-model.number="row.unitPrice" type="number" min="0" step="0.01" @input="recalcRow(row)"
                    class="w-full text-right border-b border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent py-1 text-sm"/>
                </td>
                <td class="text-right font-semibold text-gray-700 tabular-nums">{{ sym }}{{ parseFloat(row.totalAmount || 0).toFixed(2) }}</td>
                <td class="text-center">
                  <button @click="removeRow(idx)" class="text-gray-300 hover:text-red-500 text-lg leading-none font-bold">×</button>
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="bg-gray-800 text-white">
                <td colspan="5" class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide">Total Amount Due</td>
                <td class="px-4 py-3 text-right font-bold tabular-nums">{{ sym }}{{ grandTotal.toFixed(2) }}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <!-- Step 3 -->
      <div class="card mb-5">
        <div class="flex items-center gap-2 mb-5">
          <span class="step-circle-active">3</span>
          <h2 class="font-medium text-gray-800">Invoice Details</h2>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div class="input-group"><label class="input-label">Invoice Date</label><input v-model="invoiceDate" type="date" class="input-field"/></div>
          <div class="input-group">
            <label class="input-label">Due Date <span class="normal-case font-normal text-gray-400 text-xs">(auto)</span></label>
            <input :value="dueDate" type="date" readonly class="input-field bg-gray-50 text-gray-400"/>
          </div>
          <div class="input-group"><label class="input-label">Notes</label><input v-model="notes" type="text" placeholder="Optional" class="input-field"/></div>
        </div>
        <template v-if="selectedClient?.requiresRunSheet">
          <label class="flex items-center gap-2.5 cursor-pointer mt-4">
            <input v-model="bulkRunSheet" @change="pickBulkRunSheet" type="checkbox" class="w-4 h-4 rounded accent-blue-600"/>
            <span class="text-sm text-gray-700">Bulk run-sheet invoice format
              <span class="text-xs text-gray-400 font-normal ml-1">— No / Date / Run Sheet / Item / Count / Total, subtotal per run sheet</span>
            </span>
          </label>
          <label class="flex items-center gap-2.5 cursor-pointer mt-2">
            <input v-model="itemMatrix" @change="pickItemMatrix" type="checkbox" class="w-4 h-4 rounded accent-blue-600"/>
            <span class="text-sm text-gray-700">Item matrix invoice format
              <span class="text-xs text-gray-400 font-normal ml-1">— No / Date / Run Sheet, one column per item, Total, with a period total row</span>
            </span>
          </label>
        </template>
      </div>

      <div class="flex gap-3 justify-end">
        <button @click="router.push('/delivery-log')" class="btn-secondary">Cancel</button>
        <button @click="createInvoice" :disabled="creating || !preview.rows.length" class="btn-primary">
          {{ creating ? 'Creating Invoice…' : `Create Invoice — ${sym}${grandTotal.toFixed(2)}` }}
        </button>
      </div>
    </template>
  </div>
</template>
