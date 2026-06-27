<script setup>
import { ref, computed, onMounted } from 'vue';
import { quotationsApi } from '../../api/index.js';
import StatusBadge from '../../components/shared/StatusBadge.vue';

const quotations = ref([]);
const loading = ref(true);
const search = ref('');
const statusFilter = ref('');

const filtered = computed(() => quotations.value.filter(q => {
  const s = search.value.toLowerCase();
  const matchS = !s || q.quotationNo.toLowerCase().includes(s) || q.client?.companyName.toLowerCase().includes(s);
  const matchSt = !statusFilter.value || q.status === statusFilter.value;
  return matchS && matchSt;
}));

function fmt(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtSGD(v) { return `S$${parseFloat(v || 0).toFixed(2)}`; }

onMounted(async () => {
  try { quotations.value = (await quotationsApi.list()).data; }
  finally { loading.value = false; }
});
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h1 class="page-title">Quotations</h1>
        <p class="page-subtitle">{{ quotations.length }} quotation{{ quotations.length !== 1 ? 's' : '' }}</p>
      </div>
      <RouterLink to="/quotations/new" class="btn-primary">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
        New Quotation
      </RouterLink>
    </div>

    <div class="filter-bar">
      <div class="search-input w-64">
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
          <tr v-else-if="!filtered.length"><td colspan="7" class="text-center py-12 text-gray-400">No quotations found.</td></tr>
          <tr v-for="q in filtered" :key="q.id">
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
  </div>
</template>
