<script setup>
import { ref, onMounted } from 'vue';
import { reportsApi } from '../../api/index.js';

const tab = ref('revenue');
const aging = ref(null);
const clientSummary = ref([]);
const revenueYear = ref(new Date().getFullYear());
const revenueData = ref(null);
const driverSummary = ref([]);
const vehicleSummary = ref([]);
const expenseSummary = ref(null);
const loading = ref(true);

function fmtSGD(v) { return `S$${parseFloat(v || 0).toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

function exportCSV(data, filename) {
  if (!data?.length) return;
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
    [aging.value, clientSummary.value, driverSummary.value, vehicleSummary.value, expenseSummary.value] = await Promise.all([
      reportsApi.aging().then(r => r.data),
      reportsApi.clientSummary().then(r => r.data),
      reportsApi.driverSummary().then(r => r.data),
      reportsApi.vehicleSummary().then(r => r.data),
      reportsApi.expenseSummary().then(r => r.data),
    ]);
    await loadRevenue();
  } finally { loading.value = false; }
});

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_SHORT = ['J','F','M','A','M','J','J','A','S','O','N','D'];
const agingBuckets = ['0-30', '31-60', '60+'];
const bucketColor = b => b === '60+' ? 'text-red-600 dark:text-red-400' : b === '31-60' ? 'text-amber-600 dark:text-amber-400' : 'text-gray-800 dark:text-slate-200';

const TABS = [
  { key: 'revenue', label: 'Revenue', icon: 'bar_chart' },
  { key: 'aging', label: 'Invoice Aging', icon: 'schedule' },
  { key: 'clients', label: 'Client Summary', icon: 'business' },
  { key: 'drivers', label: 'Driver Report', icon: 'badge' },
  { key: 'vehicles', label: 'Vehicle Report', icon: 'directions_car' },
  { key: 'expenses', label: 'Expense Report', icon: 'payments' },
];

function catLabel(c) {
  const map = { fuel_petrol: 'Petrol', fuel_diesel: 'Diesel', toll: 'Toll', parking: 'Parking', maintenance: 'Maintenance', other: 'Other' };
  return map[c] || c;
}
</script>

<template>
  <div v-if="loading" class="flex items-center justify-center h-64 text-gray-400 text-sm">Loading reports…</div>
  <div v-else class="page-container space-y-5">

    <div class="page-header">
      <h1 class="page-title">Reports</h1>
    </div>

    <!-- Tab bar -->
    <div class="flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-slate-700 pb-px">
      <button
        v-for="t in TABS" :key="t.key"
        @click="tab = t.key"
        class="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors"
        :class="tab === t.key
          ? 'border-blue-600 text-blue-600'
          : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200'"
      >
        <span class="material-icons" style="font-size:15px">{{ t.icon }}</span>
        {{ t.label }}
      </button>
    </div>

    <!-- ── Revenue ── -->
    <div v-if="tab === 'revenue'" class="card p-0">
      <div class="card-header">
        <span class="card-title">Monthly Revenue</span>
        <div class="flex items-center gap-3">
          <input v-model.number="revenueYear" type="number" @change="loadRevenue" class="input-field w-24 text-center"/>
          <button @click="exportCSV(revenueData?.months?.map((m,i)=>({month:MONTHS[i],total:m.total,count:m.count})), `revenue-${revenueYear}.csv`)" class="btn-secondary h-8 px-3 text-xs">Export CSV</button>
        </div>
      </div>
      <div class="p-5">
        <div class="flex items-end gap-1.5 h-40">
          <div v-for="(m, i) in revenueData?.months" :key="i" class="flex-1 flex flex-col items-center gap-1 group">
            <div class="relative w-full">
              <div class="w-full rounded-t bg-blue-600 hover:bg-blue-500 transition-all cursor-default"
                :style="{ height: m.total > 0 ? `${Math.max(4, (m.total / Math.max(...revenueData.months.map(x=>x.total||1)))*120)}px` : '3px' }">
              </div>
              <div v-if="m.total > 0" class="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-medium text-gray-600 dark:text-slate-400 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                {{ fmtSGD(m.total) }}
              </div>
            </div>
            <div class="text-[10px] text-gray-400 dark:text-slate-500">{{ MONTHS_SHORT[i] }}</div>
            <div class="text-[10px] font-medium text-gray-600 dark:text-slate-400">{{ m.total >= 1000 ? `${(m.total/1000).toFixed(1)}k` : m.total.toFixed(0) }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Aging ── -->
    <div v-if="tab === 'aging'" class="card p-0">
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

    <!-- ── Client Summary ── -->
    <div v-if="tab === 'clients'" class="card p-0">
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

    <!-- ── Driver Report ── -->
    <div v-if="tab === 'drivers'" class="space-y-4">
      <div class="card p-0">
        <div class="card-header">
          <span class="card-title">Driver Performance</span>
          <button @click="exportCSV(driverSummary, 'driver-report.csv')" class="btn-secondary h-8 px-3 text-xs">Export CSV</button>
        </div>
        <table class="mat-table">
          <thead>
            <tr>
              <th>Driver</th>
              <th class="text-right">Total Jobs</th>
              <th class="text-right">Completed</th>
              <th class="text-right">Days Worked</th>
              <th class="text-right">Linked Revenue</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!driverSummary.length"><td colspan="5" class="text-center py-8 text-gray-400">No driver data yet.</td></tr>
            <tr v-for="d in driverSummary" :key="d.driverId">
              <td>
                <div class="font-medium text-gray-900 dark:text-slate-100">{{ d.name }}</div>
                <div class="text-xs text-gray-400">{{ d.email }}</div>
              </td>
              <td class="text-right text-gray-600">{{ d.totalJobs }}</td>
              <td class="text-right text-green-700 font-medium">{{ d.completedJobs }}</td>
              <td class="text-right text-gray-600">{{ d.daysWorked }}</td>
              <td class="text-right font-semibold tabular-nums">{{ fmtSGD(d.linkedRevenue) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── Vehicle Report ── -->
    <div v-if="tab === 'vehicles'" class="space-y-4">
      <div class="card p-0">
        <div class="card-header">
          <span class="card-title">Vehicle Utilisation</span>
          <button @click="exportCSV(vehicleSummary, 'vehicle-report.csv')" class="btn-secondary h-8 px-3 text-xs">Export CSV</button>
        </div>
        <table class="mat-table">
          <thead>
            <tr>
              <th>Vehicle</th>
              <th>Type / Size</th>
              <th>Status</th>
              <th class="text-right">Total Jobs</th>
              <th class="text-right">Completed</th>
              <th class="text-right">Total Days</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!vehicleSummary.length"><td colspan="6" class="text-center py-8 text-gray-400">No vehicle data yet.</td></tr>
            <tr v-for="v in vehicleSummary" :key="v.vehicleId">
              <td class="font-medium text-gray-900 dark:text-slate-100">{{ v.plateNumber }}</td>
              <td class="text-gray-500 text-sm">{{ v.type }} {{ v.size }}</td>
              <td>
                <span class="text-xs px-2 py-0.5 rounded-full font-medium"
                  :class="v.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'">
                  {{ v.status }}
                </span>
              </td>
              <td class="text-right text-gray-600">{{ v.totalJobs }}</td>
              <td class="text-right text-green-700 font-medium">{{ v.completedJobs }}</td>
              <td class="text-right text-gray-600">{{ v.totalDays }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── Expense Report ── -->
    <div v-if="tab === 'expenses'" class="space-y-5">

      <!-- Driver expense summary -->
      <div class="card p-0">
        <div class="card-header">
          <span class="card-title">Driver Expenses</span>
          <button @click="exportCSV(expenseSummary?.driverSummary, 'expense-by-driver.csv')" class="btn-secondary h-8 px-3 text-xs">Export CSV</button>
        </div>
        <table class="mat-table">
          <thead>
            <tr>
              <th>Driver</th>
              <th class="text-right">Total</th>
              <th class="text-right">Approved</th>
              <th class="text-right">Pending</th>
              <th class="text-right">Rejected</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!expenseSummary?.driverSummary?.length"><td colspan="5" class="text-center py-8 text-gray-400">No expense data yet.</td></tr>
            <tr v-for="d in expenseSummary?.driverSummary" :key="d.driverId">
              <td class="font-medium text-gray-900 dark:text-slate-100">{{ d.name }}</td>
              <td class="text-right font-semibold tabular-nums">{{ fmtSGD(d.total) }}</td>
              <td class="text-right text-green-700 tabular-nums">{{ fmtSGD(d.approved) }}</td>
              <td class="text-right text-amber-600 tabular-nums">{{ fmtSGD(d.pending) }}</td>
              <td class="text-right text-red-500 tabular-nums">{{ fmtSGD(d.rejected) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Vehicle fuel summary -->
      <div class="card p-0">
        <div class="card-header">
          <span class="card-title">Vehicle Fuel Usage</span>
          <button @click="exportCSV(expenseSummary?.vehicleFuel, 'fuel-by-vehicle.csv')" class="btn-secondary h-8 px-3 text-xs">Export CSV</button>
        </div>
        <div v-if="!expenseSummary?.vehicleFuel?.length" class="py-8 text-center text-gray-400 text-sm">
          No fuel expenses logged yet.
        </div>
        <table v-else class="mat-table">
          <thead>
            <tr>
              <th>Vehicle</th>
              <th>Type</th>
              <th class="text-right">Petrol Cost</th>
              <th class="text-right">Petrol Liters</th>
              <th class="text-right">Diesel Cost</th>
              <th class="text-right">Diesel Liters</th>
              <th class="text-right">Total Fuel Cost</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="v in expenseSummary.vehicleFuel" :key="v.vehicleId">
              <td class="font-medium">{{ v.plateNumber }}</td>
              <td class="text-gray-500 text-sm">{{ v.type }}</td>
              <td class="text-right tabular-nums text-blue-700">{{ fmtSGD(v.petrolCost) }}</td>
              <td class="text-right tabular-nums text-gray-500 text-sm">{{ v.petrolLiters > 0 ? `${v.petrolLiters.toFixed(1)}L` : '—' }}</td>
              <td class="text-right tabular-nums text-indigo-700">{{ fmtSGD(v.dieselCost) }}</td>
              <td class="text-right tabular-nums text-gray-500 text-sm">{{ v.dieselLiters > 0 ? `${v.dieselLiters.toFixed(1)}L` : '—' }}</td>
              <td class="text-right font-semibold tabular-nums">{{ fmtSGD(v.petrolCost + v.dieselCost) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

  </div>
</template>
