<script setup>
import { ref, onMounted } from 'vue';
import { reportsApi } from '../api/index.js';
import { Bar } from 'vue-chartjs';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import StatusBadge from '../components/shared/StatusBadge.vue';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const stats = ref(null);
const revenueData = ref(null);
const loading = ref(true);

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtSGD(v) {
  return new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD', maximumFractionDigits: 0 }).format(v || 0);
}
function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

onMounted(async () => {
  try {
    const [dashRes, revRes] = await Promise.all([
      reportsApi.dashboard(),
      reportsApi.revenue(new Date().getFullYear()),
    ]);
    stats.value = dashRes.data;
    revenueData.value = {
      labels: MONTHS,
      datasets: [{
        label: 'Revenue (SGD)',
        data: revRes.data.months.map(m => m.total),
        backgroundColor: '#2563EB',
        borderRadius: 2,
      }],
    };
  } finally {
    loading.value = false;
  }
});

const chartOptions = {
  responsive: true,
  plugins: { legend: { display: false } },
  scales: {
    y: { grid: { color: 'rgba(0,0,0,.06)' }, ticks: { color: '#666', font: { size: 11 } } },
    x: { grid: { display: false }, ticks: { color: '#666', font: { size: 11 } } },
  },
};
</script>

<template>
  <div v-if="loading" class="flex items-center justify-center h-64 text-gray-400 text-sm">Loading dashboard…</div>
  <div v-else class="space-y-5 page-container">

    <!-- KPI cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="card">
        <div class="section-label mb-2">Revenue (MTD)</div>
        <div class="text-2xl font-light text-gray-900 dark:text-slate-100">{{ fmtSGD(stats?.monthRevenue) }}</div>
      </div>
      <div class="card">
        <div class="section-label mb-2">Revenue (YTD)</div>
        <div class="text-2xl font-light text-gray-900 dark:text-slate-100">{{ fmtSGD(stats?.yearRevenue) }}</div>
      </div>
      <div class="card">
        <div class="section-label mb-2">Outstanding</div>
        <div class="text-2xl font-light text-orange-600 dark:text-orange-400">{{ fmtSGD(stats?.outstandingAmount) }}</div>
        <div class="text-xs text-gray-400 dark:text-slate-500 mt-1">{{ stats?.outstandingCount || 0 }} invoices</div>
      </div>
      <div class="card">
        <div class="section-label mb-2">Active Deliveries</div>
        <div class="text-2xl font-light text-blue-600 dark:text-blue-400">{{ stats?.activeJobs ?? 0 }}</div>
        <div v-if="stats?.overdueInvoices" class="text-xs text-red-600 dark:text-red-400 mt-1">
          {{ stats.overdueInvoices }} overdue invoice{{ stats.overdueInvoices > 1 ? 's' : '' }}
        </div>
      </div>
    </div>

    <!-- Charts + recent -->
    <div class="grid lg:grid-cols-2 gap-5">
      <div class="card">
        <div class="card-title mb-4">Monthly Revenue {{ new Date().getFullYear() }}</div>
        <Bar v-if="revenueData" :data="revenueData" :options="chartOptions" style="max-height:220px"/>
        <div v-else class="h-40 flex items-center justify-center text-sm text-gray-400">No data yet</div>
      </div>

      <div class="card p-0">
        <div class="card-header">
          <span class="card-title">Recent Invoices</span>
          <RouterLink to="/invoices" class="btn-text text-xs px-2 h-7">View all</RouterLink>
        </div>
        <table class="mat-table">
          <tbody>
            <tr v-if="!stats?.recentInvoices?.length">
              <td class="text-center py-8 text-gray-400" colspan="3">No invoices yet</td>
            </tr>
            <tr v-for="inv in stats?.recentInvoices?.slice(0,8)" :key="inv.id">
              <td class="px-4 py-3">
                <RouterLink :to="`/invoices/${inv.id}`" class="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">{{ inv.invoiceNo }}</RouterLink>
                <div class="text-xs text-gray-400 dark:text-slate-500">{{ inv.client?.companyName }}</div>
              </td>
              <td class="px-4 py-3"><StatusBadge :status="inv.status"/></td>
              <td class="px-4 py-3 text-right font-medium text-gray-800 dark:text-slate-200">S${{ parseFloat(inv.totalAmount).toFixed(2) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Today's jobs -->
    <div v-if="stats?.todayJobs?.length" class="card p-0">
      <div class="card-header">
        <span class="card-title">Active Deliveries Today</span>
      </div>
      <table class="mat-table">
        <tbody>
          <tr v-for="job in stats.todayJobs" :key="job.id">
            <td class="px-4 py-3">
              <div class="text-sm font-medium text-gray-900 dark:text-slate-100">{{ job.description }}</div>
              <div class="text-xs text-gray-400 dark:text-slate-500">{{ job.client?.companyName }}</div>
            </td>
            <td class="px-4 py-3 text-xs text-gray-500 dark:text-slate-400">{{ fmtDate(job.fromDate) }} — {{ fmtDate(job.toDate) }}</td>
            <td class="px-4 py-3"><StatusBadge :status="job.status"/></td>
          </tr>
        </tbody>
      </table>
    </div>

  </div>
</template>
