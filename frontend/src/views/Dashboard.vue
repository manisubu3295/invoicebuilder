<script setup>
import { ref, computed, onMounted } from 'vue';
import { reportsApi, jobsApi } from '../api/index.js';
import { useAuthStore } from '../stores/auth.js';
import { Bar } from 'vue-chartjs';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import StatusBadge from '../components/shared/StatusBadge.vue';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const auth = useAuthStore();
const stats = ref(null);
const revenueMonths = ref(null);
const loading = ref(true);

// Drivers can't call the admin/staff-only reports endpoints — this stays
// null for them and the template branches to a lightweight jobs summary.
const driverJobs = ref([]);

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const now = new Date();

function fmtSGD(v) {
  return new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD', maximumFractionDigits: 0 }).format(v || 0);
}
function fmtSGDFull(v) {
  return new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD', maximumFractionDigits: 2 }).format(v || 0);
}
function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

onMounted(async () => {
  try {
    if (auth.isDriver) {
      driverJobs.value = (await jobsApi.list()).data;
    } else {
      const [dashRes, revRes] = await Promise.all([
        reportsApi.dashboard(),
        reportsApi.revenue(now.getFullYear()),
      ]);
      stats.value = dashRes.data;
      revenueMonths.value = revRes.data.months;
    }
  } finally {
    loading.value = false;
  }
});

const driverActiveJobs = computed(() => driverJobs.value.filter(j => ['pending', 'in_transit'].includes(j.status)));
const driverTodayJobs = computed(() => {
  const todayStr = now.toISOString().slice(0, 10);
  return driverActiveJobs.value.filter(j => j.fromDate <= todayStr && j.toDate >= todayStr);
});

const yearTotal = computed(() => (revenueMonths.value || []).reduce((s, m) => s + m.total, 0));
const monthsWithData = computed(() => (revenueMonths.value || []).filter(m => m.total > 0).length);
const yearAvg = computed(() => monthsWithData.value ? yearTotal.value / monthsWithData.value : 0);

const revenueData = computed(() => {
  if (!revenueMonths.value) return null;
  const currentMonthIdx = now.getMonth();
  return {
    labels: MONTHS,
    datasets: [{
      label: 'Revenue (SGD)',
      data: revenueMonths.value.map(m => m.total),
      backgroundColor: revenueMonths.value.map((m, i) => i === currentMonthIdx ? '#2563EB' : 'rgba(37, 99, 235, 0.35)'),
      hoverBackgroundColor: revenueMonths.value.map(() => '#1D4ED8'),
      borderRadius: 4,
      maxBarThickness: 34,
    }],
  };
});

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#0f172a',
      padding: 10,
      cornerRadius: 8,
      titleFont: { size: 12, weight: '600' },
      bodyFont: { size: 12 },
      callbacks: {
        label: (ctx) => ` ${fmtSGDFull(ctx.parsed.y)}`,
      },
    },
  },
  scales: {
    y: {
      grid: { color: 'rgba(100,116,139,.12)' },
      ticks: { color: '#94a3b8', font: { size: 11 }, callback: (v) => fmtSGD(v) },
    },
    x: {
      grid: { display: false },
      ticks: { color: '#94a3b8', font: { size: 11 } },
    },
  },
};

const summaryLine = computed(() => {
  if (!stats.value) return '';
  const parts = [];
  if (stats.value.activeJobs) parts.push(`${stats.value.activeJobs} active deliver${stats.value.activeJobs === 1 ? 'y' : 'ies'}`);
  if (stats.value.openQuotationsCount) parts.push(`${stats.value.openQuotationsCount} open quotation${stats.value.openQuotationsCount === 1 ? '' : 's'}`);
  if (stats.value.outstandingCount) parts.push(`${stats.value.outstandingCount} unpaid invoice${stats.value.outstandingCount === 1 ? '' : 's'} worth ${fmtSGD(stats.value.outstandingAmount)}`);
  if (!parts.length) return 'All caught up — no open quotations or unpaid invoices right now.';
  return 'You have ' + parts.join(', ') + '.';
});

const needsAttention = computed(() => {
  if (!stats.value) return [];
  const items = [];
  if (stats.value.overdueInvoices) {
    items.push({ key: 'overdue', icon: 'error', tone: 'red', text: `${stats.value.overdueInvoices} overdue invoice${stats.value.overdueInvoices > 1 ? 's' : ''}`, to: '/invoices?status=overdue' });
  }
  if (stats.value.pendingExpenses) {
    items.push({ key: 'expenses', icon: 'pending_actions', tone: 'indigo', text: `${stats.value.pendingExpenses} expense${stats.value.pendingExpenses > 1 ? 's' : ''} awaiting approval`, to: '/expenses' });
  }
  for (const a of (stats.value.expiryAlerts || []).slice(0, 5)) {
    items.push({
      key: `${a.type}-${a.plate || a.name}-${a.label}`,
      icon: 'warning',
      tone: a.expired ? 'red' : 'amber',
      text: `${a.type === 'vehicle' ? a.plate : a.name} · ${a.label} ${a.expired ? 'expired' : `in ${a.days}d`}`,
      to: '/vehicles',
    });
  }
  return items;
});

const toneClasses = {
  red:    'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-700/40',
  amber:  'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-700/40',
  indigo: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-700/40',
};

const tiles = computed(() => {
  if (!stats.value) return [];
  return [
    {
      key: 'mtd', label: 'Revenue (MTD)', icon: 'payments', accent: 'emerald',
      value: fmtSGD(stats.value.monthRevenue), to: '/invoices?status=paid',
      note: 'Paid this month',
    },
    {
      key: 'ytd', label: 'Revenue (YTD)', icon: 'trending_up', accent: 'blue',
      value: fmtSGD(stats.value.yearRevenue), to: '/reports',
      note: `${now.getFullYear()} total`,
    },
    {
      key: 'outstanding', label: 'Outstanding', icon: 'hourglass_top', accent: 'amber',
      value: fmtSGD(stats.value.outstandingAmount), to: '/invoices',
      note: `${stats.value.outstandingCount} invoice${stats.value.outstandingCount === 1 ? '' : 's'}`,
      warn: stats.value.overdueInvoices ? `${stats.value.overdueInvoices} overdue` : '',
    },
    {
      key: 'quotations', label: 'Open Quotations', icon: 'description', accent: 'violet',
      value: fmtSGD(stats.value.openQuotationsAmount), to: '/quotations',
      note: `${stats.value.openQuotationsCount} awaiting response`,
    },
    {
      key: 'deliveries', label: 'Active Deliveries', icon: 'local_shipping', accent: 'sky',
      value: String(stats.value.activeJobs ?? 0), to: '/jobs',
      note: 'In progress or pending',
    },
  ];
});

const accentClasses = {
  emerald: { border: 'border-l-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-600 dark:text-emerald-400' },
  blue:    { border: 'border-l-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400' },
  amber:   { border: 'border-l-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-600 dark:text-amber-400' },
  violet:  { border: 'border-l-violet-500', bg: 'bg-violet-50 dark:bg-violet-900/30', text: 'text-violet-600 dark:text-violet-400' },
  sky:     { border: 'border-l-sky-500', bg: 'bg-sky-50 dark:bg-sky-900/30', text: 'text-sky-600 dark:text-sky-400' },
};
</script>

<template>
  <div v-if="loading" class="page-container space-y-5">
    <div class="grid grid-cols-2 lg:grid-cols-5 gap-4">
      <div v-for="i in 5" :key="i" class="card h-24 animate-pulse motion-reduce:animate-none">
        <div class="h-3 w-16 bg-gray-200 dark:bg-slate-700 rounded mb-3"></div>
        <div class="h-6 w-24 bg-gray-200 dark:bg-slate-700 rounded"></div>
      </div>
    </div>
    <div class="grid lg:grid-cols-2 gap-5">
      <div class="card h-72 animate-pulse motion-reduce:animate-none"></div>
      <div class="card h-72 animate-pulse motion-reduce:animate-none"></div>
    </div>
  </div>

  <!-- Driver dashboard — no access to admin/staff report data, so this
       branch never calls reportsApi and shows a lightweight jobs summary
       plus quick links to the pages drivers actually use. -->
  <div v-else-if="auth.isDriver" class="space-y-5 page-container">
    <div>
      <h1 class="page-title mb-0.5">Welcome, {{ auth.user?.name }}</h1>
      <p class="text-sm text-gray-500 dark:text-slate-400">
        {{ driverActiveJobs.length ? `You have ${driverActiveJobs.length} active job${driverActiveJobs.length === 1 ? '' : 's'}.` : 'No active jobs right now.' }}
      </p>
    </div>

    <div v-if="driverTodayJobs.length" class="card p-0">
      <div class="card-header"><span class="card-title">Today's Jobs</span></div>
      <div class="table-wrap">
        <table class="mat-table">
          <tbody>
            <tr v-for="job in driverTodayJobs" :key="job.id">
              <td class="px-4 py-3">
                <RouterLink :to="`/jobs/${job.id}`" class="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">{{ job.description }}</RouterLink>
                <div class="text-xs text-gray-400 dark:text-slate-500">{{ job.client?.companyName }}</div>
              </td>
              <td class="px-4 py-3"><StatusBadge :status="job.status"/></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <RouterLink to="/jobs" class="card hover:shadow-md dark:hover:shadow-none dark:hover:border-slate-600 transition-all">
        <div class="flex items-center gap-3">
          <span class="w-9 h-9 rounded-lg bg-sky-50 dark:bg-sky-900/30 flex items-center justify-center shrink-0">
            <span class="material-icons text-sky-600 dark:text-sky-400" style="font-size:18px">local_shipping</span>
          </span>
          <div>
            <div class="text-sm font-semibold text-gray-900 dark:text-slate-100">My Jobs</div>
            <div class="text-xs text-gray-400 dark:text-slate-500">{{ driverActiveJobs.length }} active</div>
          </div>
        </div>
      </RouterLink>
      <RouterLink to="/delivery-log" class="card hover:shadow-md dark:hover:shadow-none dark:hover:border-slate-600 transition-all">
        <div class="flex items-center gap-3">
          <span class="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
            <span class="material-icons text-blue-600 dark:text-blue-400" style="font-size:18px">inventory_2</span>
          </span>
          <div>
            <div class="text-sm font-semibold text-gray-900 dark:text-slate-100">Delivery Log</div>
            <div class="text-xs text-gray-400 dark:text-slate-500">Log a delivery trip</div>
          </div>
        </div>
      </RouterLink>
      <RouterLink to="/expenses" class="card hover:shadow-md dark:hover:shadow-none dark:hover:border-slate-600 transition-all">
        <div class="flex items-center gap-3">
          <span class="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
            <span class="material-icons text-amber-600 dark:text-amber-400" style="font-size:18px">payments</span>
          </span>
          <div>
            <div class="text-sm font-semibold text-gray-900 dark:text-slate-100">Expenses</div>
            <div class="text-xs text-gray-400 dark:text-slate-500">Submit a claim</div>
          </div>
        </div>
      </RouterLink>
    </div>
  </div>

  <div v-else class="space-y-5 page-container">

    <!-- Today at a glance -->
    <div class="flex items-start justify-between flex-wrap gap-2">
      <div>
        <h1 class="page-title mb-0.5">Dashboard</h1>
        <p class="text-sm text-gray-500 dark:text-slate-400">{{ summaryLine }}</p>
      </div>
    </div>

    <!-- KPI tiles -->
    <div class="grid grid-cols-2 lg:grid-cols-5 gap-4">
      <RouterLink
        v-for="(tile, i) in tiles" :key="tile.key" :to="tile.to"
        class="card !p-0 overflow-hidden border-l-4 hover:shadow-md dark:hover:shadow-none dark:hover:border-slate-600 transition-all motion-safe:animate-tile-in motion-reduce:animate-none"
        :class="accentClasses[tile.accent].border"
        :style="`animation-delay:${i * 60}ms`"
      >
        <div class="p-4">
          <div class="flex items-center justify-between mb-2.5">
            <span class="section-label">{{ tile.label }}</span>
            <span class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" :class="accentClasses[tile.accent].bg">
              <span class="material-icons" :class="accentClasses[tile.accent].text" style="font-size:16px">{{ tile.icon }}</span>
            </span>
          </div>
          <div class="text-2xl font-light text-gray-900 dark:text-slate-100 tabular-nums leading-tight">{{ tile.value }}</div>
          <div class="flex items-center gap-1.5 mt-1">
            <span class="text-xs text-gray-400 dark:text-slate-500">{{ tile.note }}</span>
            <span v-if="tile.warn" class="text-xs font-semibold text-red-600 dark:text-red-400">· {{ tile.warn }}</span>
          </div>
        </div>
      </RouterLink>
    </div>

    <!-- Needs attention strip -->
    <div v-if="needsAttention.length" class="flex items-center gap-2 flex-wrap">
      <span class="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500 shrink-0">Needs attention</span>
      <RouterLink
        v-for="item in needsAttention" :key="item.key" :to="item.to"
        class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors hover:opacity-80"
        :class="toneClasses[item.tone]"
      >
        <span class="material-icons" style="font-size:13px">{{ item.icon }}</span>
        {{ item.text }}
      </RouterLink>
    </div>

    <!-- Charts + recent -->
    <div class="grid lg:grid-cols-2 gap-5">
      <div class="card">
        <div class="flex items-start justify-between mb-1">
          <div class="card-title">Monthly Revenue {{ now.getFullYear() }}</div>
        </div>
        <p class="text-xs text-gray-400 dark:text-slate-500 mb-4">
          Total <strong class="text-gray-600 dark:text-slate-300">{{ fmtSGD(yearTotal) }}</strong>
          <span v-if="monthsWithData"> · Avg <strong class="text-gray-600 dark:text-slate-300">{{ fmtSGD(yearAvg) }}</strong>/mo</span>
        </p>
        <div style="height:220px">
          <Bar v-if="revenueData" :data="revenueData" :options="chartOptions"/>
          <div v-else class="h-full flex items-center justify-center text-sm text-gray-400">No data yet</div>
        </div>
      </div>

      <div class="card p-0">
        <div class="card-header">
          <span class="card-title">Recent Invoices</span>
          <RouterLink to="/invoices" class="btn-text text-xs px-2 h-7">View all</RouterLink>
        </div>
        <div class="table-wrap">
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
                <td class="px-4 py-3 text-right font-medium text-gray-800 dark:text-slate-200 tabular-nums">S${{ parseFloat(inv.totalAmount).toFixed(2) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Today's jobs -->
    <div v-if="stats?.todayJobs?.length" class="card p-0">
      <div class="card-header">
        <span class="card-title">Active Deliveries Today</span>
      </div>
      <div class="table-wrap">
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

  </div>
</template>

<style scoped>
@keyframes tile-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-tile-in {
  animation: tile-in 0.35s ease-out both;
}
</style>
