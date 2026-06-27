<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { quotationsApi } from '../../api/index.js';
import StatusBadge from '../../components/shared/StatusBadge.vue';

const PAGE_SIZE = 20;

function todayStr() { return new Date().toISOString().slice(0, 10); }
function monthStartStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

const quotations = ref([]);
const loading = ref(true);
const search = ref('');
const statusFilter = ref('');
const fromDate = ref(monthStartStr());
const toDate = ref(todayStr());
const page = ref(1);

async function load() {
  loading.value = true;
  try {
    quotations.value = (await quotationsApi.list({
      fromDate: fromDate.value || undefined,
      toDate: toDate.value || undefined,
    })).data;
  } finally { loading.value = false; }
  page.value = 1;
}

watch([fromDate, toDate], load);
watch([search, statusFilter], () => { page.value = 1; });

const filtered = computed(() => quotations.value.filter(q => {
  const s = search.value.toLowerCase();
  const matchS = !s || q.quotationNo.toLowerCase().includes(s) || q.client?.companyName.toLowerCase().includes(s);
  const matchSt = !statusFilter.value || q.status === statusFilter.value;
  return matchS && matchSt;
}));

const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)));
const paginated = computed(() => filtered.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE));

function fmt(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtSGD(v) { return `S$${parseFloat(v || 0).toFixed(2)}`; }

function clearDateFilter() {
  fromDate.value = '';
  toDate.value = '';
}

onMounted(async () => {
  try {
    quotations.value = (await quotationsApi.list({ fromDate: fromDate.value, toDate: toDate.value })).data;
  } finally { loading.value = false; }
});
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h1 class="page-title">Quotations</h1>
        <p class="page-subtitle">{{ filtered.length }} of {{ quotations.length }} quotation{{ quotations.length !== 1 ? 's' : '' }}</p>
      </div>
      <RouterLink to="/quotations/new" class="btn-primary">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
        New Quotation
      </RouterLink>
    </div>

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
      <div class="search-input w-56">
        <svg class="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <input v-model="search" placeholder="Search by no. or client…"/>
      </div>

      <div class="input-group">
        <label class="input-label">Status</label>
        <select v-model="statusFilter" class="input-field w-36">
          <option value="">All</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
          <option value="converted">Converted</option>
        </select>
      </div>
      <div class="text-sm text-gray-500 ml-auto self-end pb-1.5">{{ filtered.length }} result{{ filtered.length !== 1 ? 's' : '' }}</div>
    </div>

    <div class="card p-0 overflow-hidden">
      <table class="mat-table">
        <thead>
          <tr>
            <th>Quotation No</th>
            <th>Client</th>
            <th>Date</th>
            <th>Valid Until</th>
            <th class="text-right">Amount</th>
            <th>Status</th>
            <th class="w-16"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading"><td colspan="7" class="text-center py-12 text-gray-400">Loading…</td></tr>
          <tr v-else-if="!paginated.length"><td colspan="7" class="text-center py-12 text-gray-400">No quotations found.</td></tr>
          <tr v-for="q in paginated" :key="q.id">
            <td><RouterLink :to="`/quotations/${q.id}`" class="font-medium text-blue-600 hover:underline">{{ q.quotationNo }}</RouterLink></td>
            <td class="text-gray-700">{{ q.client?.companyName }}</td>
            <td class="text-gray-500">{{ fmt(q.date) }}</td>
            <td class="text-gray-500">{{ fmt(q.validUntil) }}</td>
            <td class="text-right font-medium tabular-nums">{{ fmtSGD(q.totalAmount) }}</td>
            <td><StatusBadge :status="q.status"/></td>
            <td>
              <RouterLink :to="`/quotations/${q.id}/edit`" class="btn-icon text-gray-400 hover:text-blue-600">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              </RouterLink>
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
