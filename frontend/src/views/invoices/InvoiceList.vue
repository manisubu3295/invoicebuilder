<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { invoicesApi, driversApi, vehiclesApi } from '../../api/index.js';
import StatusBadge from '../../components/shared/StatusBadge.vue';

const PAGE_SIZE = 20;

function todayStr() { return new Date().toISOString().slice(0, 10); }
function monthStartStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

const invoices = ref([]);
const drivers = ref([]);
const vehicles = ref([]);
const loading = ref(true);
const search = ref('');
const statusFilter = ref('');
const driverFilter = ref('');
const vehicleFilter = ref('');
const fromDate = ref(monthStartStr());
const toDate = ref(todayStr());
const page = ref(1);
const showMonthly = ref(true);
const actionLoading = ref('');

async function load() {
  loading.value = true;
  try {
    invoices.value = (await invoicesApi.list({
      fromDate: fromDate.value || undefined,
      toDate: toDate.value || undefined,
    })).data;
  } finally { loading.value = false; }
  page.value = 1;
}

watch([fromDate, toDate], load);
watch([search, statusFilter, driverFilter, vehicleFilter], () => { page.value = 1; });

async function markSent(inv) {
  actionLoading.value = inv.id + '-sent';
  try {
    await invoicesApi.markSent(inv.id);
    inv.status = 'sent';
  } catch (e) { alert(e.response?.data?.message || 'Failed'); }
  finally { actionLoading.value = ''; }
}

async function markPaid(inv) {
  actionLoading.value = inv.id + '-paid';
  try {
    await invoicesApi.markPaid(inv.id, {});
    inv.status = 'paid';
  } catch (e) { alert(e.response?.data?.message || 'Failed'); }
  finally { actionLoading.value = ''; }
}

const filtered = computed(() => invoices.value.filter(inv => {
  const s = search.value.toLowerCase();
  const matchS = !s || inv.invoiceNo.toLowerCase().includes(s) || inv.client?.companyName.toLowerCase().includes(s);
  const matchSt = !statusFilter.value || inv.status === statusFilter.value;
  const matchDr = !driverFilter.value || inv.job?.driverId === driverFilter.value;
  const matchVh = !vehicleFilter.value || inv.job?.vehicleId === vehicleFilter.value;
  return matchS && matchSt && matchDr && matchVh;
}));

const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)));
const paginated = computed(() => filtered.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE));

const monthlySummary = computed(() => {
  const map = {};
  for (const inv of invoices.value) {
    const d = inv.date ? new Date(inv.date) : null;
    if (!d || isNaN(d)) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!map[key]) map[key] = { month: key, count: 0, total: 0, paid: 0 };
    map[key].count++;
    map[key].total += parseFloat(inv.totalAmount || 0);
    if (inv.status === 'paid') map[key].paid += parseFloat(inv.totalAmount || 0);
  }
  return Object.values(map).sort((a, b) => b.month.localeCompare(a.month));
});

const summaryTotals = computed(() => ({
  count: monthlySummary.value.reduce((s, r) => s + r.count, 0),
  total: monthlySummary.value.reduce((s, r) => s + r.total, 0),
  paid:  monthlySummary.value.reduce((s, r) => s + r.paid,  0),
}));

function fmtMonth(key) {
  const [y, m] = key.split('-');
  return new Date(+y, +m - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; }
function fmtSGD(v) { return `S$${parseFloat(v || 0).toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

async function downloadPdf(id, invoiceNo) {
  const { data } = await invoicesApi.getPdf(id);
  const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `Invoice-${invoiceNo.replace(/\//g, '-')}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

function clearDateFilter() {
  fromDate.value = '';
  toDate.value = '';
}

onMounted(async () => {
  try {
    [invoices.value, drivers.value, vehicles.value] = await Promise.all([
      invoicesApi.list({ fromDate: fromDate.value, toDate: toDate.value }).then(r => r.data),
      driversApi.list().then(r => r.data).catch(() => []),
      vehiclesApi.list().then(r => r.data).catch(() => []),
    ]);
  } finally { loading.value = false; }
});
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h1 class="page-title">Invoices</h1>
        <p class="page-subtitle">{{ filtered.length }} of {{ invoices.length }} invoice{{ invoices.length !== 1 ? 's' : '' }}</p>
      </div>
      <RouterLink to="/invoices/new" class="btn-primary">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
        New Invoice
      </RouterLink>
    </div>

    <!-- Monthly Summary -->
    <div v-if="!loading && invoices.length" class="card p-0 mb-4">
      <div class="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-slate-700/60">
        <div class="flex items-center gap-2">
          <span class="material-icons text-blue-600" style="font-size:18px">calendar_month</span>
          <span class="card-title">Monthly Summary</span>
        </div>
        <button @click="showMonthly = !showMonthly" class="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
          <span class="material-icons" style="font-size:14px">{{ showMonthly ? 'expand_less' : 'expand_more' }}</span>
          {{ showMonthly ? 'Hide' : 'Show' }}
        </button>
      </div>
      <div v-if="showMonthly" class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-gray-50 dark:bg-slate-700/40">
              <th class="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Month</th>
              <th class="px-5 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Invoices</th>
              <th class="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Billed</th>
              <th class="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Paid</th>
              <th class="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Outstanding</th>
              <th class="px-5 py-2.5 w-28"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in monthlySummary" :key="row.month"
              class="border-t border-gray-100 dark:border-slate-700/40 hover:bg-gray-50/50 dark:hover:bg-slate-700/20">
              <td class="px-5 py-3 font-medium text-gray-800 dark:text-slate-200">{{ fmtMonth(row.month) }}</td>
              <td class="px-5 py-3 text-center text-gray-600 dark:text-slate-400">{{ row.count }}</td>
              <td class="px-5 py-3 text-right font-semibold tabular-nums text-gray-800 dark:text-slate-200">{{ fmtSGD(row.total) }}</td>
              <td class="px-5 py-3 text-right tabular-nums text-green-700 dark:text-green-400 font-medium">{{ fmtSGD(row.paid) }}</td>
              <td class="px-5 py-3 text-right tabular-nums font-medium" :class="(row.total - row.paid) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'">
                {{ fmtSGD(row.total - row.paid) }}
              </td>
              <td class="px-5 py-3">
                <button @click="statusFilter = ''; search = row.month.slice(0,7)" class="text-xs text-blue-600 hover:underline">
                  View
                </button>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="border-t-2 border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/40">
              <td class="px-5 py-3 text-xs font-bold text-gray-600 uppercase tracking-wide">Total</td>
              <td class="px-5 py-3 text-center font-bold text-gray-700 dark:text-slate-300">{{ summaryTotals.count }}</td>
              <td class="px-5 py-3 text-right font-bold tabular-nums text-gray-800 dark:text-slate-200">{{ fmtSGD(summaryTotals.total) }}</td>
              <td class="px-5 py-3 text-right font-bold tabular-nums text-green-700 dark:text-green-400">{{ fmtSGD(summaryTotals.paid) }}</td>
              <td class="px-5 py-3 text-right font-bold tabular-nums" :class="(summaryTotals.total - summaryTotals.paid) > 0 ? 'text-amber-600' : 'text-gray-400'">
                {{ fmtSGD(summaryTotals.total - summaryTotals.paid) }}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <!-- Filters -->
    <div class="filter-bar flex-wrap">
      <!-- Date range -->
      <div class="flex items-end gap-2">
        <div class="input-group">
          <label class="input-label">From</label>
          <input v-model="fromDate" type="date" class="input-field w-36"/>
        </div>
        <div class="input-group">
          <label class="input-label">To</label>
          <input v-model="toDate" type="date" class="input-field w-36"/>
        </div>
        <button v-if="fromDate || toDate" @click="clearDateFilter" title="Clear date filter"
          class="mb-0.5 h-9 px-2 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
          <span class="material-icons" style="font-size:18px">close</span>
        </button>
      </div>

      <!-- Keyword search -->
      <div class="search-input w-48">
        <svg class="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <input v-model="search" placeholder="No. or client…"/>
      </div>

      <select v-model="statusFilter" class="input-field w-32">
        <option value="">All Status</option>
        <option value="draft">Draft</option>
        <option value="sent">Sent</option>
        <option value="paid">Paid</option>
        <option value="overdue">Overdue</option>
        <option value="cancelled">Cancelled</option>
      </select>
      <select v-model="driverFilter" class="input-field w-36">
        <option value="">All Drivers</option>
        <option v-for="d in drivers" :key="d.id" :value="d.id">{{ d.user?.name }}</option>
      </select>
      <select v-model="vehicleFilter" class="input-field w-36">
        <option value="">All Vehicles</option>
        <option v-for="v in vehicles" :key="v.id" :value="v.id">{{ v.plateNumber }}</option>
      </select>
      <div class="text-sm text-gray-500 ml-auto self-end pb-1.5">{{ filtered.length }} result{{ filtered.length !== 1 ? 's' : '' }}</div>
    </div>

    <!-- Table -->
    <div class="card p-0 overflow-hidden">
      <table class="mat-table">
        <thead>
          <tr>
            <th>Invoice No</th>
            <th>Client</th>
            <th>Date</th>
            <th>Due Date</th>
            <th class="text-right">Amount</th>
            <th>Status</th>
            <th class="w-32"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading"><td colspan="7" class="text-center py-12 text-gray-400">Loading…</td></tr>
          <tr v-else-if="!paginated.length"><td colspan="7" class="text-center py-12 text-gray-400">No invoices found.</td></tr>
          <tr v-for="inv in paginated" :key="inv.id">
            <td><RouterLink :to="`/invoices/${inv.id}`" class="font-medium text-blue-600 hover:underline">{{ inv.invoiceNo }}</RouterLink></td>
            <td class="text-gray-700">{{ inv.client?.companyName }}</td>
            <td class="text-gray-500">{{ fmtDate(inv.date) }}</td>
            <td class="text-gray-500" :class="inv.status === 'overdue' ? 'text-red-700 font-medium' : ''">{{ fmtDate(inv.dueDate) }}</td>
            <td class="text-right font-medium tabular-nums">{{ fmtSGD(inv.totalAmount) }}</td>
            <td><StatusBadge :status="inv.status"/></td>
            <td>
              <div class="flex gap-1 items-center">
                <button v-if="inv.status === 'draft'" @click="markSent(inv)" :disabled="actionLoading === inv.id+'-sent'" title="Mark as Sent"
                  class="text-xs px-2 h-7 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-medium transition-colors disabled:opacity-50">
                  {{ actionLoading === inv.id+'-sent' ? '…' : 'Send' }}
                </button>
                <button v-if="['sent','overdue'].includes(inv.status)" @click="markPaid(inv)" :disabled="actionLoading === inv.id+'-paid'" title="Mark as Paid"
                  class="text-xs px-2 h-7 rounded-lg border border-green-200 text-green-700 hover:bg-green-50 font-medium transition-colors disabled:opacity-50">
                  {{ actionLoading === inv.id+'-paid' ? '…' : 'Paid' }}
                </button>
                <button @click="downloadPdf(inv.id, inv.invoiceNo)" class="btn-icon text-gray-400 hover:text-blue-600" title="Download PDF">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="flex items-center justify-between mt-4 text-sm">
      <button @click="page--" :disabled="page === 1"
        class="btn-secondary px-3 py-1.5 disabled:opacity-40">
        ← Prev
      </button>
      <div class="flex items-center gap-1">
        <template v-for="p in totalPages" :key="p">
          <button v-if="totalPages <= 7 || p === 1 || p === totalPages || Math.abs(p - page) <= 1"
            @click="page = p"
            :class="p === page ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'"
            class="w-8 h-8 rounded-md border text-sm font-medium transition-colors">
            {{ p }}
          </button>
          <span v-else-if="(p === 2 && page > 4) || (p === totalPages - 1 && page < totalPages - 3)"
            class="text-gray-400 px-1">…</span>
        </template>
      </div>
      <button @click="page++" :disabled="page === totalPages"
        class="btn-secondary px-3 py-1.5 disabled:opacity-40">
        Next →
      </button>
    </div>
    <div v-else-if="!loading && filtered.length" class="mt-3 text-center text-xs text-gray-400">
      {{ filtered.length }} result{{ filtered.length !== 1 ? 's' : '' }}
    </div>
  </div>
</template>
