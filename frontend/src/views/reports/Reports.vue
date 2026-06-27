<script setup>
import { ref, onMounted } from 'vue';
import { reportsApi } from '../../api/index.js';

const aging = ref(null);
const clientSummary = ref([]);
const revenueYear = ref(new Date().getFullYear());
const revenueData = ref(null);
const loading = ref(true);

function fmtSGD(v) { return `S$${parseFloat(v || 0).toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

function exportCSV(data, filename) {
  const keys = Object.keys(data[0]);
  const csv = [keys.join(','), ...data.map(r => keys.map(k => `"${r[k]}"`).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
  a.download = filename; a.click();
}

async function loadRevenue() {
  revenueData.value = (await reportsApi.revenue(revenueYear.value)).data;
}

onMounted(async () => {
  try {
    [aging.value, clientSummary.value] = await Promise.all([
      reportsApi.aging().then(r => r.data),
      reportsApi.clientSummary().then(r => r.data),
    ]);
    await loadRevenue();
  } finally { loading.value = false; }
});

const MONTHS = ['J','F','M','A','M','J','J','A','S','O','N','D'];
const agingBuckets = ['0-30', '31-60', '60+'];
const bucketColor = b => b === '60+' ? 'text-red-600 dark:text-red-400' : b === '31-60' ? 'text-amber-600 dark:text-amber-400' : 'text-gray-800 dark:text-slate-200';
</script>

<template>
  <div v-if="loading" class="flex items-center justify-center h-64 text-gray-400 text-sm">Loading reports…</div>
  <div v-else class="page-container space-y-5">

    <div class="page-header">
      <h1 class="page-title">Reports</h1>
    </div>

    <!-- Revenue chart -->
    <div class="card p-0">
      <div class="card-header">
        <span class="card-title">Monthly Revenue</span>
        <div class="flex items-center gap-3">
          <input v-model.number="revenueYear" type="number" @change="loadRevenue" class="input-field w-24 text-center"/>
          <button @click="exportCSV(revenueData?.months?.map((m,i)=>({month:i+1,total:m.total,count:m.count})), `revenue-${revenueYear}.csv`)" class="btn-secondary h-8 px-3 text-xs">Export CSV</button>
        </div>
      </div>
      <div class="p-5">
        <div class="flex items-end gap-2 h-32">
          <div v-for="(m, i) in revenueData?.months" :key="i" class="flex-1 flex flex-col items-center gap-1">
            <div class="w-full rounded-t-sm bg-blue-600 transition-all"
              :style="{ height: m.total > 0 ? `${Math.max(4, (m.total / Math.max(...revenueData.months.map(x=>x.total||1)))*100)}%` : '3px', minHeight:'3px' }"></div>
            <div class="text-[10px] text-gray-400 dark:text-slate-500">{{ MONTHS[i] }}</div>
            <div class="text-[10px] font-medium text-gray-600 dark:text-slate-400">{{ m.total >= 1000 ? `${(m.total/1000).toFixed(1)}k` : m.total.toFixed(0) }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Aging -->
    <div class="card p-0">
      <div class="card-header"><span class="card-title">Invoice Aging</span></div>
      <div class="grid grid-cols-3 gap-px bg-gray-100 dark:bg-slate-700 border-b border-gray-100 dark:border-slate-700">
        <div v-for="bucket in agingBuckets" :key="bucket" class="bg-white dark:bg-slate-800 px-5 py-4 text-center">
          <div class="section-label mb-1">{{ bucket }} days</div>
          <div class="text-xl font-light" :class="bucketColor(bucket)">{{ aging?.[bucket]?.length || 0 }}</div>
          <div class="text-xs text-gray-500 dark:text-slate-400 mt-1">{{ fmtSGD(aging?.[bucket]?.reduce((s,i)=>s+parseFloat(i.totalAmount||0),0)||0) }}</div>
        </div>
      </div>
      <div class="p-5 space-y-4">
        <div v-for="bucket in ['60+','31-60','0-30']" :key="bucket">
          <div v-if="aging?.[bucket]?.length">
            <div class="section-label mb-2">{{ bucket }} days</div>
            <table class="mat-table">
              <tbody>
                <tr v-for="inv in aging[bucket]" :key="inv.id">
                  <td><RouterLink :to="`/invoices/${inv.id}`" class="text-blue-600 hover:underline font-medium">{{ inv.invoiceNo }}</RouterLink></td>
                  <td class="text-gray-500">{{ inv.client?.companyName }}</td>
                  <td class="text-right text-xs text-gray-400">{{ inv.daysOverdue }}d overdue</td>
                  <td class="text-right font-medium">{{ fmtSGD(inv.totalAmount) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Client summary -->
    <div class="card p-0">
      <div class="card-header">
        <span class="card-title">Client Summary</span>
        <button @click="exportCSV(clientSummary,'client-summary.csv')" class="btn-secondary h-8 px-3 text-xs">Export CSV</button>
      </div>
      <table class="mat-table">
        <thead>
          <tr>
            <th>Client</th>
            <th class="text-right">Invoices</th>
            <th class="text-right">Total Billed</th>
            <th class="text-right">Paid</th>
            <th class="text-right">Outstanding</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!clientSummary.length"><td colspan="5" class="text-center py-8 text-gray-400">No data yet.</td></tr>
          <tr v-for="c in clientSummary" :key="c.id">
            <td><span class="font-medium text-gray-900 dark:text-slate-100">{{ c.companyName }}</span> <span class="text-xs text-gray-400 dark:text-slate-500">({{ c.clientCode }})</span></td>
            <td class="text-right text-gray-600 dark:text-slate-400">{{ c.invoiceCount }}</td>
            <td class="text-right font-medium tabular-nums">{{ fmtSGD(c.totalBilled) }}</td>
            <td class="text-right text-green-700 dark:text-emerald-400 tabular-nums">{{ fmtSGD(c.totalPaid) }}</td>
            <td class="text-right tabular-nums" :class="c.outstanding > 0 ? 'text-amber-700 dark:text-amber-400 font-medium' : 'text-gray-400 dark:text-slate-500'">{{ fmtSGD(c.outstanding) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

  </div>
</template>
