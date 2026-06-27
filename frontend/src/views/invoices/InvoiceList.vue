<script setup>
import { ref, computed, onMounted } from 'vue';
import { invoicesApi } from '../../api/index.js';
import StatusBadge from '../../components/shared/StatusBadge.vue';

const invoices = ref([]);
const loading = ref(true);
const search = ref('');
const statusFilter = ref('');

const filtered = computed(() => invoices.value.filter(inv => {
  const s = search.value.toLowerCase();
  const matchS = !s || inv.invoiceNo.toLowerCase().includes(s) || inv.client?.companyName.toLowerCase().includes(s);
  const matchSt = !statusFilter.value || inv.status === statusFilter.value;
  return matchS && matchSt;
}));

function fmt(d) { return d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; }
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

onMounted(async () => {
  try { invoices.value = (await invoicesApi.list()).data; }
  finally { loading.value = false; }
});
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h1 class="page-title">Invoices</h1>
        <p class="page-subtitle">{{ invoices.length }} invoice{{ invoices.length !== 1 ? 's' : '' }}</p>
      </div>
      <RouterLink to="/invoices/new" class="btn-primary">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
        New Invoice
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
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
      <div class="text-sm text-gray-500 ml-auto self-end pb-1.5">{{ filtered.length }} result{{ filtered.length !== 1 ? 's' : '' }}</div>
    </div>

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
            <th class="w-20"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading"><td colspan="7" class="text-center py-12 text-gray-400">Loading…</td></tr>
          <tr v-else-if="!filtered.length"><td colspan="7" class="text-center py-12 text-gray-400">No invoices found.</td></tr>
          <tr v-for="inv in filtered" :key="inv.id">
            <td><RouterLink :to="`/invoices/${inv.id}`" class="font-medium text-blue-600 hover:underline">{{ inv.invoiceNo }}</RouterLink></td>
            <td class="text-gray-700">{{ inv.client?.companyName }}</td>
            <td class="text-gray-500">{{ fmt(inv.date) }}</td>
            <td class="text-gray-500" :class="inv.status === 'overdue' ? 'text-red-700 font-medium' : ''">{{ fmt(inv.dueDate) }}</td>
            <td class="text-right font-medium tabular-nums">{{ fmtSGD(inv.totalAmount) }}</td>
            <td><StatusBadge :status="inv.status"/></td>
            <td>
              <button @click="downloadPdf(inv.id, inv.invoiceNo)" class="btn-icon text-gray-400 hover:text-blue-600" title="Download PDF">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
