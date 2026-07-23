<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { reportsApi, clientsApi, driversApi, vehiclesApi } from '../../api/index.js';

const tab = ref('revenue');
const aging = ref(null);
const clientSummary = ref([]);
const revenueYear = ref(new Date().getFullYear());
const revenueData = ref(null);
const driverSummary = ref([]);
const vehicleSummary = ref([]);
const expenseSummary = ref(null);
const attendanceData = ref([]);
const attendanceYear = ref(new Date().getFullYear());
const attendanceMonth = ref('');
const pnlData = ref(null);
const pnlYear = ref(new Date().getFullYear());
const loading = ref(true);

// SOA
const soaClientId = ref('');
const soaFromDate = ref('');
const soaToDate = ref('');
const soaStatus = ref('');
const soaData = ref(null);
const soaLoading = ref(false);

// Payroll
const payrollYear = ref(new Date().getFullYear());
const payrollMonth = ref('');
const payrollData = ref(null);
const payrollLoading = ref(false);

// Job Summary
const jobSummaryFrom = ref('');
const jobSummaryTo = ref('');
const jobSummaryStatus = ref('');
const jobSummaryClientId = ref('');
const jobSummaryDriverId = ref('');
const jobSummaryData = ref([]);

// A/R Action
const arData = ref([]);

// Fleet Compliance
const fleetData = ref([]);

// Lists for dropdowns
const clientsList = ref([]);
const driversList = ref([]);

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

async function loadAttendance() {
  const params = { year: attendanceYear.value };
  if (attendanceMonth.value) params.month = attendanceMonth.value;
  attendanceData.value = (await reportsApi.attendance(params)).data;
}

async function loadPnl() {
  pnlData.value = (await reportsApi.pnl(pnlYear.value)).data;
}

onMounted(async () => {
  try {
    [aging.value, clientSummary.value, driverSummary.value, vehicleSummary.value, expenseSummary.value, clientsList.value, driversList.value] = await Promise.all([
      reportsApi.aging().then(r => r.data),
      reportsApi.clientSummary().then(r => r.data),
      reportsApi.driverSummary().then(r => r.data),
      reportsApi.vehicleSummary().then(r => r.data),
      reportsApi.expenseSummary().then(r => r.data),
      clientsApi.list().then(r => r.data),
      driversApi.list().then(r => r.data),
    ]);
    await Promise.all([loadRevenue(), loadAttendance(), loadPnl()]);
  } finally { loading.value = false; }
});

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_SHORT = ['J','F','M','A','M','J','J','A','S','O','N','D'];
const agingBuckets = ['0-30', '31-60', '60+'];
const bucketColor = b => b === '60+' ? 'text-red-600 dark:text-red-400' : b === '31-60' ? 'text-amber-600 dark:text-amber-400' : 'text-gray-800 dark:text-slate-200';

const REPORT_GROUPS = [
  {
    key: 'financial', label: 'Financial', icon: 'account_balance',
    reports: [
      { key: 'revenue', label: 'Revenue', icon: 'bar_chart' },
      { key: 'aging', label: 'Invoice Aging', icon: 'schedule' },
      { key: 'clients', label: 'Client Summary', icon: 'business' },
      { key: 'pnl', label: 'P&L', icon: 'account_balance' },
      { key: 'soa', label: 'Statement of Account', icon: 'account_balance_wallet' },
      { key: 'ar', label: 'A/R Actions', icon: 'call_made' },
    ],
  },
  {
    key: 'operations', label: 'Operations', icon: 'local_shipping',
    reports: [
      { key: 'drivers', label: 'Driver Report', icon: 'badge' },
      { key: 'vehicles', label: 'Vehicle Report', icon: 'directions_car' },
      { key: 'job-summary', label: 'Job Summary', icon: 'summarize' },
      { key: 'expenses', label: 'Expense Report', icon: 'payments' },
    ],
  },
  {
    key: 'compliance', label: 'Compliance & Payroll', icon: 'verified',
    reports: [
      { key: 'attendance', label: 'Attendance', icon: 'event_available' },
      { key: 'payroll', label: 'Payroll', icon: 'payments' },
      { key: 'fleet', label: 'Fleet Compliance', icon: 'verified' },
    ],
  },
];

const REPORT_META = {
  revenue: 'Monthly paid-invoice revenue for the selected year.',
  aging: 'Outstanding invoices grouped by how overdue they are.',
  clients: 'Billing totals per client — billed, paid, and outstanding.',
  drivers: 'Jobs, completed deliveries, and linked revenue per driver.',
  vehicles: 'Utilisation and job counts per vehicle.',
  expenses: 'Driver expense claims and vehicle fuel usage.',
  attendance: 'Days worked per driver by month.',
  pnl: 'Revenue, expenses, and profit by month and by job.',
  soa: 'Full invoice and payment history for one client.',
  payroll: 'Gross pay, CPF, and net pay per driver for a period.',
  'job-summary': 'Searchable list of jobs with invoicing status.',
  ar: 'Sent and overdue invoices needing follow-up.',
  fleet: 'Vehicle document expiry status across the fleet.',
};

const activeGroup = ref('financial');
const activeGroupReports = computed(() => REPORT_GROUPS.find(g => g.key === activeGroup.value)?.reports || []);
const activeReportLabel = computed(() => activeGroupReports.value.find(r => r.key === tab.value)?.label || '');

function selectGroup(groupKey) {
  activeGroup.value = groupKey;
  tab.value = REPORT_GROUPS.find(g => g.key === groupKey).reports[0].key;
}

const reportActions = computed(() => {
  switch (tab.value) {
    case 'revenue':
      return {
        pdf: () => downloadPdf(reportsApi.revenuePdf(revenueYear.value), `revenue-${revenueYear.value}.pdf`),
        csv: () => exportCSV(revenueData.value?.months?.map((m, i) => ({ month: MONTHS[i], total: m.total, count: m.count })), `revenue-${revenueYear.value}.csv`),
      };
    case 'aging':
      return { pdf: () => downloadPdf(reportsApi.agingPdf(), 'invoice-aging.pdf') };
    case 'clients':
      return {
        pdf: () => downloadPdf(reportsApi.clientSummaryPdf(), 'client-summary.pdf'),
        csv: () => exportCSV(clientSummary.value, 'client-summary.csv'),
      };
    case 'drivers':
      return {
        pdf: () => downloadPdf(reportsApi.driverSummaryPdf(), 'driver-report.pdf'),
        csv: () => exportCSV(driverSummary.value, 'driver-report.csv'),
      };
    case 'vehicles':
      return {
        pdf: () => downloadPdf(reportsApi.vehicleSummaryPdf(), 'vehicle-report.pdf'),
        csv: () => exportCSV(vehicleSummary.value, 'vehicle-report.csv'),
      };
    case 'expenses':
      return { pdf: () => downloadPdf(reportsApi.expenseSummaryPdf(), 'expense-report.pdf') };
    case 'attendance':
      return {
        pdf: () => downloadPdf(reportsApi.attendancePdf({ year: attendanceYear.value, month: attendanceMonth.value || undefined }), `attendance-${attendanceYear.value}.pdf`),
        csv: () => exportCSV(attendanceData.value, 'attendance.csv'),
      };
    case 'pnl':
      return pnlData.value ? { pdf: () => downloadPdf(reportsApi.pnlPdf(pnlYear.value), `pnl-${pnlYear.value}.pdf`) } : {};
    case 'soa':
      return soaData.value ? { pdf: () => downloadPdf(reportsApi.soaPdf(soaClientId.value, soaParams()), `SOA-${soaData.value.client?.companyName || soaClientId.value}.pdf`) } : {};
    case 'payroll':
      return payrollData.value ? {
        pdf: () => downloadPdf(reportsApi.payrollPdf({ year: payrollYear.value, month: payrollMonth.value || undefined }), `payroll-${payrollYear.value}-${payrollMonth.value || 'full'}.pdf`),
        csv: payrollData.value?.rows?.length ? () => exportCSV(payrollData.value.rows, `payroll-${payrollYear.value}.csv`) : null,
      } : {};
    case 'job-summary':
      return {
        pdf: () => downloadPdf(reportsApi.jobSummaryPdf({
          from: jobSummaryFrom.value || undefined, to: jobSummaryTo.value || undefined, status: jobSummaryStatus.value || undefined,
          clientId: jobSummaryClientId.value || undefined, driverId: jobSummaryDriverId.value || undefined,
        }), 'job-summary.pdf'),
        csv: jobSummaryData.value.length ? () => exportCSV(jobSummaryData.value, 'job-summary.csv') : null,
      };
    case 'ar':
      return {
        pdf: () => downloadPdf(reportsApi.arActionPdf(), 'ar-actions.pdf'),
        csv: arData.value.length ? () => exportCSV(arData.value, 'ar-actions.csv') : null,
      };
    case 'fleet':
      return {
        pdf: () => downloadPdf(reportsApi.fleetCompliancePdf(), 'fleet-compliance.pdf'),
        csv: fleetData.value.length ? () => exportCSV(fleetData.value.map(v => ({
          plate: v.plateNumber, type: v.type, size: v.size, coeExpiry: v.coeExpiry || '', roadTaxExpiry: v.roadTaxExpiry || '',
          insuranceExpiry: v.insuranceExpiry || '', inspectionDue: v.inspectionDue || '',
        })), 'fleet-compliance.csv') : null,
      };
    default:
      return {};
  }
});

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function catLabel(c) {
  const map = { fuel_petrol: 'Petrol', fuel_diesel: 'Diesel', toll: 'Toll', parking: 'Parking', maintenance: 'Maintenance', other: 'Other' };
  return map[c] || c;
}

async function downloadPdf(apiCall, filename) {
  const { data } = await apiCall;
  const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function soaParams() {
  return {
    fromDate: soaFromDate.value || undefined,
    toDate: soaToDate.value || undefined,
    status: soaStatus.value || undefined,
  };
}

async function loadSoa() {
  if (!soaClientId.value) return;
  soaLoading.value = true;
  try { soaData.value = (await reportsApi.soa(soaClientId.value, soaParams())).data; }
  catch (e) { console.error(e); }
  finally { soaLoading.value = false; }
}

async function loadPayroll() {
  payrollLoading.value = true;
  try {
    const params = { year: payrollYear.value };
    if (payrollMonth.value) params.month = payrollMonth.value;
    payrollData.value = (await reportsApi.payroll(params)).data;
  } catch (e) { console.error(e); }
  finally { payrollLoading.value = false; }
}

async function loadJobSummary() {
  try {
    const params = {};
    if (jobSummaryFrom.value) params.from = jobSummaryFrom.value;
    if (jobSummaryTo.value) params.to = jobSummaryTo.value;
    if (jobSummaryStatus.value) params.status = jobSummaryStatus.value;
    if (jobSummaryClientId.value) params.clientId = jobSummaryClientId.value;
    if (jobSummaryDriverId.value) params.driverId = jobSummaryDriverId.value;
    jobSummaryData.value = (await reportsApi.jobSummary(params)).data;
  } catch (e) { console.error(e); }
}

async function loadArAction() {
  try { arData.value = (await reportsApi.arAction()).data; }
  catch (e) { console.error(e); }
}

async function loadFleet() {
  try { fleetData.value = (await vehiclesApi.list()).data; }
  catch (e) { console.error(e); }
}

function payrollTotals(rows) {
  return (rows || []).reduce((acc, r) => {
    acc.grossPay += r.grossPay || 0;
    acc.cpfEmployee += r.cpfEmployee || 0;
    acc.cpfEmployer += r.cpfEmployer || 0;
    acc.netPay += r.netPay || 0;
    return acc;
  }, { grossPay: 0, cpfEmployee: 0, cpfEmployer: 0, netPay: 0 });
}

function fleetCellClass(dateStr) {
  if (!dateStr) return 'text-gray-400';
  const diff = Math.ceil((new Date(dateStr) - new Date()) / 86400000);
  if (diff < 0) return 'text-red-700 font-semibold bg-red-50';
  if (diff <= 30) return 'text-amber-700 font-semibold bg-amber-50';
  return 'text-green-700 bg-green-50';
}

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

watch(tab, (newTab) => {
  if (newTab === 'ar') loadArAction();
  if (newTab === 'fleet') loadFleet();
});
</script>

<template>
  <div v-if="loading" class="flex items-center justify-center h-64 text-gray-400 text-sm">Loading reports…</div>
  <div v-else class="page-container space-y-5">

    <div class="page-header">
      <h1 class="page-title">Reports</h1>
    </div>

    <!-- Group selector -->
    <div class="flex flex-wrap gap-2">
      <button
        v-for="g in REPORT_GROUPS" :key="g.key"
        @click="selectGroup(g.key)"
        class="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
        :class="activeGroup === g.key
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-700/60 dark:text-slate-300 dark:hover:bg-slate-700'"
      >
        <span class="material-icons" style="font-size:16px">{{ g.icon }}</span>
        {{ g.label }}
      </button>
    </div>

    <!-- Report pills — wraps to multiple rows, no horizontal scroll -->
    <div class="flex flex-wrap gap-1.5 pb-3 border-b border-gray-200 dark:border-slate-700">
      <button
        v-for="r in activeGroupReports" :key="r.key"
        @click="tab = r.key"
        class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors"
        :class="tab === r.key
          ? 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800'
          : 'border border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700/40'"
      >
        <span class="material-icons" style="font-size:14px">{{ r.icon }}</span>
        {{ r.label }}
      </button>
    </div>

    <!-- Report toolbar — title, description, export actions -->
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div>
        <h2 class="text-base font-semibold text-gray-900 dark:text-slate-100">{{ activeReportLabel }}</h2>
        <p class="text-xs text-gray-400 dark:text-slate-500">{{ REPORT_META[tab] }}</p>
      </div>
      <div class="flex gap-2">
        <button v-if="reportActions.pdf" @click="reportActions.pdf()" class="btn-secondary h-8 px-3 text-xs">
          <span class="material-icons" style="font-size:14px">picture_as_pdf</span> Export PDF
        </button>
        <button v-if="reportActions.csv" @click="reportActions.csv()" class="btn-secondary h-8 px-3 text-xs">
          <span class="material-icons" style="font-size:14px">table_chart</span> Export CSV
        </button>
      </div>
    </div>

    <!-- ── Revenue ── -->
    <div v-if="tab === 'revenue'" class="card p-0">
      <div class="card-header">
        <span class="card-title">Monthly Revenue</span>
        <div class="flex items-center gap-3">
          <input v-model.number="revenueYear" type="number" @change="loadRevenue" class="input-field w-24 text-center"/>
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
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-px bg-gray-100 dark:bg-slate-700 border-b border-gray-100 dark:border-slate-700">
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

    <!-- ── Attendance Report ── -->
    <div v-if="tab === 'attendance'" class="space-y-4">
      <div class="flex flex-wrap gap-3 items-end">
        <div class="input-group w-32">
          <label class="input-label">Year</label>
          <input v-model.number="attendanceYear" type="number" class="input-field" min="2020" max="2099" @change="loadAttendance"/>
        </div>
        <div class="input-group w-36">
          <label class="input-label">Month (optional)</label>
          <select v-model="attendanceMonth" class="input-field" @change="loadAttendance">
            <option value="">All months</option>
            <option v-for="(m,i) in MONTH_NAMES" :key="i" :value="String(i+1).padStart(2,'0')">{{ m }}</option>
          </select>
        </div>
      </div>
      <div class="card p-0">
        <div class="card-header"><span class="card-title">Days Worked by Driver</span></div>
        <div v-if="!attendanceData.length" class="py-8 text-center text-gray-400 text-sm">No completed attendance records for this period.</div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-gray-50 dark:bg-slate-700/40">
                <th class="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Driver</th>
                <th v-for="(m,i) in MONTH_NAMES" :key="i" class="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">{{ m }}</th>
                <th class="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="d in attendanceData" :key="d.driverId" class="border-t border-gray-100 dark:border-slate-700/40 hover:bg-gray-50/50">
                <td class="px-5 py-3 font-medium text-gray-900 dark:text-slate-100">{{ d.name }}</td>
                <td v-for="(m,i) in MONTH_NAMES" :key="i" class="px-3 py-3 text-center tabular-nums"
                  :class="d.months[`${attendanceYear}-${String(i+1).padStart(2,'0')}`] ? 'text-blue-700 font-semibold' : 'text-gray-300'">
                  {{ d.months[`${attendanceYear}-${String(i+1).padStart(2,'0')}`] || '—' }}
                </td>
                <td class="px-5 py-3 text-right font-bold text-gray-800 dark:text-slate-200">{{ d.totalDays }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ── P&L Report ── -->
    <div v-if="tab === 'pnl'" class="space-y-5">
      <div class="flex gap-3 items-end">
        <div class="input-group w-32">
          <label class="input-label">Year</label>
          <input v-model.number="pnlYear" type="number" class="input-field" min="2020" max="2099" @change="loadPnl"/>
        </div>
      </div>

      <!-- Summary cards -->
      <div v-if="pnlData" class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="card text-center">
          <div class="section-label mb-1">Total Revenue</div>
          <div class="text-xl font-semibold text-green-700">{{ fmtSGD(pnlData.totalRevenue) }}</div>
        </div>
        <div class="card text-center">
          <div class="section-label mb-1">Total Expenses</div>
          <div class="text-xl font-semibold text-red-600">{{ fmtSGD(pnlData.totalExpenses) }}</div>
        </div>
        <div class="card text-center">
          <div class="section-label mb-1">Net Profit</div>
          <div class="text-xl font-bold" :class="pnlData.totalProfit >= 0 ? 'text-blue-700' : 'text-red-700'">{{ fmtSGD(pnlData.totalProfit) }}</div>
        </div>
      </div>

      <!-- Monthly P&L -->
      <div v-if="pnlData" class="card p-0">
        <div class="card-header"><span class="card-title">Monthly Breakdown</span></div>
        <table class="mat-table">
          <thead><tr><th>Month</th><th class="text-right">Revenue</th><th class="text-right">Expenses</th><th class="text-right">Profit</th></tr></thead>
          <tbody>
            <tr v-for="m in pnlData.months" :key="m.month" class="border-t border-gray-100 dark:border-slate-700/40">
              <td class="font-medium text-gray-800 dark:text-slate-200">{{ MONTH_NAMES[m.month-1] }} {{ pnlYear }}</td>
              <td class="text-right tabular-nums text-green-700">{{ fmtSGD(m.revenue) }}</td>
              <td class="text-right tabular-nums text-red-600">{{ m.expenses > 0 ? fmtSGD(m.expenses) : '—' }}</td>
              <td class="text-right tabular-nums font-semibold" :class="m.profit >= 0 ? 'text-blue-700' : 'text-red-600'">{{ fmtSGD(m.profit) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Job profitability -->
      <div v-if="pnlData?.jobProfitability?.length" class="card p-0">
        <div class="card-header">
          <span class="card-title">Job Profitability</span>
          <button @click="exportCSV(pnlData.jobProfitability, 'job-profitability.csv')" class="btn-secondary h-8 px-3 text-xs">Export CSV</button>
        </div>
        <table class="mat-table">
          <thead><tr><th>Job</th><th>Client</th><th>Driver</th><th>Dates</th><th class="text-right">Revenue</th><th class="text-right">Expenses</th><th class="text-right">Profit</th></tr></thead>
          <tbody>
            <tr v-for="j in pnlData.jobProfitability" :key="j.jobId">
              <td class="font-medium text-gray-900 dark:text-slate-100 max-w-[180px] truncate">{{ j.description }}</td>
              <td class="text-gray-500 text-sm">{{ j.client || '—' }}</td>
              <td class="text-gray-500 text-sm">{{ j.driver || '—' }}</td>
              <td class="text-gray-400 text-xs">{{ j.fromDate }} — {{ j.toDate }}</td>
              <td class="text-right tabular-nums">
                <span v-if="j.revenue > 0" class="text-green-700">{{ fmtSGD(j.revenue) }}</span>
                <span v-else class="text-gray-300 text-xs italic">Not invoiced</span>
              </td>
              <td class="text-right tabular-nums text-red-600">{{ j.expenses > 0 ? fmtSGD(j.expenses) : '—' }}</td>
              <td class="text-right tabular-nums font-semibold" :class="j.profit >= 0 ? 'text-blue-700' : 'text-red-600'">{{ fmtSGD(j.profit) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else-if="pnlData" class="card text-center py-8 text-gray-400 text-sm">No jobs in this year.</div>
    </div>

    <!-- ── Statement of Account ── -->
    <div v-if="tab === 'soa'" class="space-y-4">
      <div class="card">
        <div class="flex flex-wrap gap-3 items-end">
          <div class="input-group flex-1 min-w-48">
            <label class="input-label">Select Client</label>
            <select v-model="soaClientId" class="input-field">
              <option value="">— Select a client —</option>
              <option v-for="c in clientsList" :key="c.id" :value="c.id">{{ c.companyName }}</option>
            </select>
          </div>
          <div class="input-group">
            <label class="input-label">From Date</label>
            <input type="date" v-model="soaFromDate" class="input-field" />
          </div>
          <div class="input-group">
            <label class="input-label">To Date</label>
            <input type="date" v-model="soaToDate" class="input-field" />
          </div>
          <div class="input-group">
            <label class="input-label">Status</label>
            <select v-model="soaStatus" class="input-field w-36">
              <option value="">All</option>
              <option value="sent">Pending</option>
              <option value="overdue">Overdue</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          <button @click="loadSoa" :disabled="!soaClientId || soaLoading" class="btn-primary h-9 px-4">
            {{ soaLoading ? 'Loading…' : 'Load Statement' }}
          </button>
        </div>
      </div>
      <div v-if="soaData" class="space-y-4">
        <div class="card p-0">
          <div class="card-header">
            <span class="card-title">{{ soaData.client?.companyName }}</span>
            <span class="text-xs text-gray-400">{{ soaData.client?.contactPerson }} &nbsp;|&nbsp; {{ soaData.client?.email }}</span>
          </div>
          <div class="px-4 pt-3 text-xs text-gray-400">
            Period: {{ soaData.period?.fromDate ? fmtDate(soaData.period.fromDate) : 'Account start' }} – {{ fmtDate(soaData.period?.toDate) }}
          </div>

          <!-- Consolidated summary -->
          <div class="flex flex-wrap gap-4 justify-between px-4 py-4">
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1 min-w-72">
              <div class="rounded-md bg-gray-50 dark:bg-slate-700/40 px-3 py-2">
                <div class="text-xs text-gray-500">Opening Balance</div>
                <div class="font-semibold tabular-nums">{{ fmtSGD(soaData.summary?.openingBalance) }}</div>
              </div>
              <div class="rounded-md bg-gray-50 dark:bg-slate-700/40 px-3 py-2">
                <div class="text-xs text-gray-500">Invoiced this Period</div>
                <div class="font-semibold tabular-nums">{{ fmtSGD(soaData.summary?.totalInvoicedInPeriod) }}</div>
              </div>
              <div class="rounded-md bg-gray-50 dark:bg-slate-700/40 px-3 py-2">
                <div class="text-xs text-green-700">Paid this Period</div>
                <div class="font-semibold tabular-nums text-green-700">{{ fmtSGD(soaData.summary?.totalPaidInPeriod) }}</div>
              </div>
              <div class="rounded-md bg-gray-800 dark:bg-slate-900 px-3 py-2">
                <div class="text-xs text-gray-300">Closing Balance</div>
                <div class="font-bold tabular-nums text-white">{{ fmtSGD(soaData.summary?.closingBalance) }}</div>
              </div>
            </div>
          </div>

          <!-- Aging -->
          <div class="px-4 pb-4 grid grid-cols-5 gap-2">
            <div class="text-center rounded-md border border-gray-100 dark:border-slate-700 py-2">
              <div class="text-[10px] uppercase text-gray-400">Current</div>
              <div class="text-sm font-semibold tabular-nums">{{ fmtSGD(soaData.aging?.current) }}</div>
            </div>
            <div class="text-center rounded-md border border-gray-100 dark:border-slate-700 py-2">
              <div class="text-[10px] uppercase text-gray-400">1-30 Days</div>
              <div class="text-sm font-semibold tabular-nums">{{ fmtSGD(soaData.aging?.d1_30) }}</div>
            </div>
            <div class="text-center rounded-md border border-gray-100 dark:border-slate-700 py-2">
              <div class="text-[10px] uppercase text-gray-400">31-60 Days</div>
              <div class="text-sm font-semibold tabular-nums">{{ fmtSGD(soaData.aging?.d31_60) }}</div>
            </div>
            <div class="text-center rounded-md border border-gray-100 dark:border-slate-700 py-2">
              <div class="text-[10px] uppercase text-gray-400">61-90 Days</div>
              <div class="text-sm font-semibold tabular-nums">{{ fmtSGD(soaData.aging?.d61_90) }}</div>
            </div>
            <div class="text-center rounded-md border border-gray-100 dark:border-slate-700 py-2">
              <div class="text-[10px] uppercase text-gray-400">90+ Days</div>
              <div class="text-sm font-semibold tabular-nums text-red-700">{{ fmtSGD(soaData.aging?.d90plus) }}</div>
            </div>
          </div>

          <!-- Detailed ledger -->
          <table class="mat-table">
            <thead>
              <tr>
                <th class="text-left">Date</th>
                <th class="text-left">Reference</th>
                <th class="text-left">Description</th>
                <th class="text-right">Debit</th>
                <th class="text-right">Credit</th>
                <th class="text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr class="bg-gray-50 dark:bg-slate-700/30">
                <td colspan="5" class="font-medium">Opening Balance</td>
                <td class="text-right tabular-nums font-medium">{{ fmtSGD(soaData.summary?.openingBalance) }}</td>
              </tr>
              <tr v-if="!soaData.ledger?.length"><td colspan="6" class="text-center py-8 text-gray-400">No transactions in this period.</td></tr>
              <tr v-for="(row, idx) in soaData.ledger" :key="idx">
                <td class="text-sm text-gray-500">{{ fmtDate(row.date) }}</td>
                <td class="font-medium">{{ row.ref }}</td>
                <td class="text-sm">
                  <span v-if="row.type === 'invoice'">Invoice
                    <span class="text-xs px-2 py-0.5 rounded-full font-medium ml-1"
                      :class="row.status==='paid'?'bg-green-50 text-green-700':row.status==='overdue'?'bg-red-50 text-red-700':'bg-amber-50 text-amber-700'">
                      {{ row.status }}
                    </span>
                  </span>
                  <span v-else>Payment Received</span>
                </td>
                <td class="text-right tabular-nums">{{ row.debit ? fmtSGD(row.debit) : '' }}</td>
                <td class="text-right tabular-nums text-green-700">{{ row.credit ? fmtSGD(row.credit) : '' }}</td>
                <td class="text-right tabular-nums font-medium">{{ fmtSGD(row.balance) }}</td>
              </tr>
              <tr class="bg-gray-800 dark:bg-slate-900 text-white">
                <td colspan="5" class="font-bold">Closing Balance</td>
                <td class="text-right tabular-nums font-bold">{{ fmtSGD(soaData.summary?.closingBalance) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ── Payroll ── -->
    <div v-if="tab === 'payroll'" class="space-y-4">
      <div class="flex flex-wrap gap-3 items-end">
        <div class="input-group w-28">
          <label class="input-label">Year</label>
          <input v-model.number="payrollYear" type="number" class="input-field" min="2020" max="2099"/>
        </div>
        <div class="input-group w-36">
          <label class="input-label">Month (optional)</label>
          <select v-model="payrollMonth" class="input-field">
            <option value="">All months</option>
            <option v-for="(m,i) in MONTH_NAMES" :key="i" :value="String(i+1).padStart(2,'0')">{{ m }}</option>
          </select>
        </div>
        <button @click="loadPayroll" :disabled="payrollLoading" class="btn-primary h-9 px-4">{{ payrollLoading ? 'Calculating…' : 'Calculate' }}</button>
      </div>
      <div v-if="payrollData" class="card p-0">
        <div class="card-header"><span class="card-title">Payroll Summary — {{ payrollYear }}{{ payrollMonth ? ' / ' + MONTH_NAMES[parseInt(payrollMonth)-1] : '' }}</span></div>
        <table class="mat-table">
          <thead>
            <tr>
              <th>Driver</th>
              <th class="text-center">Days Worked</th>
              <th class="text-right">Daily Rate</th>
              <th class="text-right">Gross Pay</th>
              <th class="text-right">CPF Emp (20%)</th>
              <th class="text-right">CPF Employer (17%)</th>
              <th class="text-right">Net Pay</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!payrollData.rows?.length"><td colspan="7" class="text-center py-8 text-gray-400">No payroll data for this period.</td></tr>
            <tr v-for="r in payrollData.rows" :key="r.driverId" :class="!r.dailyRate ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''">
              <td>
                <div class="font-medium text-gray-900 dark:text-slate-100">{{ r.name }}</div>
                <div v-if="!r.dailyRate" class="text-xs text-amber-600 mt-0.5">Set daily rate in Drivers</div>
              </td>
              <td class="text-center tabular-nums">{{ r.daysWorked }}</td>
              <td class="text-right tabular-nums">{{ r.dailyRate ? fmtSGD(r.dailyRate) : '—' }}</td>
              <td class="text-right tabular-nums font-medium">{{ fmtSGD(r.grossPay) }}</td>
              <td class="text-right tabular-nums text-red-700">{{ fmtSGD(r.cpfEmployee) }}</td>
              <td class="text-right tabular-nums text-gray-500">{{ fmtSGD(r.cpfEmployer) }}</td>
              <td class="text-right tabular-nums font-bold text-gray-900 dark:text-slate-100">{{ fmtSGD(r.netPay) }}</td>
            </tr>
            <tr v-if="payrollData.rows?.length" class="bg-gray-50 dark:bg-slate-700/40 font-semibold text-sm border-t-2 border-gray-200 dark:border-slate-600">
              <td colspan="3" class="text-right text-gray-600 dark:text-slate-400">Totals</td>
              <td class="text-right tabular-nums">{{ fmtSGD(payrollTotals(payrollData.rows).grossPay) }}</td>
              <td class="text-right tabular-nums text-red-700">{{ fmtSGD(payrollTotals(payrollData.rows).cpfEmployee) }}</td>
              <td class="text-right tabular-nums text-gray-500">{{ fmtSGD(payrollTotals(payrollData.rows).cpfEmployer) }}</td>
              <td class="text-right tabular-nums font-bold">{{ fmtSGD(payrollTotals(payrollData.rows).netPay) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── Job Summary ── -->
    <div v-if="tab === 'job-summary'" class="space-y-4">
      <div class="card">
        <div class="flex flex-wrap gap-3 items-end">
          <div class="input-group w-36"><label class="input-label">From Date</label><input v-model="jobSummaryFrom" type="date" class="input-field"/></div>
          <div class="input-group w-36"><label class="input-label">To Date</label><input v-model="jobSummaryTo" type="date" class="input-field"/></div>
          <div class="input-group w-40">
            <label class="input-label">Status</label>
            <select v-model="jobSummaryStatus" class="input-field">
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="in_transit">In Transit</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div class="input-group w-44">
            <label class="input-label">Client</label>
            <select v-model="jobSummaryClientId" class="input-field">
              <option value="">All clients</option>
              <option v-for="c in clientsList" :key="c.id" :value="c.id">{{ c.companyName }}</option>
            </select>
          </div>
          <div class="input-group w-44">
            <label class="input-label">Driver</label>
            <select v-model="jobSummaryDriverId" class="input-field">
              <option value="">All drivers</option>
              <option v-for="d in driversList" :key="d.id" :value="d.id">{{ d.user?.name }}</option>
            </select>
          </div>
          <button @click="loadJobSummary" class="btn-primary h-9 px-4">Search</button>
        </div>
      </div>
      <div class="card p-0">
        <div class="card-header"><span class="card-title">Job Summary</span><span class="text-xs text-gray-400">{{ jobSummaryData.length }} results</span></div>
        <div class="overflow-x-auto">
          <table class="mat-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Client</th>
                <th>Driver</th>
                <th>Vehicle</th>
                <th class="text-center">From</th>
                <th class="text-center">To</th>
                <th class="text-center">Days</th>
                <th>Status</th>
                <th>Invoice</th>
                <th class="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!jobSummaryData.length"><td colspan="10" class="text-center py-8 text-gray-400">No jobs found. Click Search to load results.</td></tr>
              <tr v-for="j in jobSummaryData" :key="j.jobId">
                <td class="max-w-[160px] truncate font-medium text-gray-900 dark:text-slate-100">{{ j.description }}</td>
                <td class="text-gray-500 text-sm">{{ j.client }}</td>
                <td class="text-gray-500 text-sm">{{ j.driver }}</td>
                <td class="text-gray-500 text-sm">{{ j.vehicle }}</td>
                <td class="text-center text-xs text-gray-400">{{ j.fromDate }}</td>
                <td class="text-center text-xs text-gray-400">{{ j.toDate }}</td>
                <td class="text-center tabular-nums text-gray-600">{{ j.days ?? '—' }}</td>
                <td>
                  <span class="text-xs px-2 py-0.5 rounded-full font-medium"
                    :class="j.status==='delivered'?'bg-green-50 text-green-700':j.status==='in_transit'?'bg-blue-50 text-blue-700':j.status==='cancelled'?'bg-red-50 text-red-700':'bg-gray-100 text-gray-500'">
                    {{ j.status }}
                  </span>
                </td>
                <td class="text-xs text-gray-500">{{ j.invoiceNo }}</td>
                <td class="text-right tabular-nums font-medium">{{ j.amount > 0 ? fmtSGD(j.amount) : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ── A/R Action ── -->
    <div v-if="tab === 'ar'" class="space-y-4">
      <div class="flex justify-between items-center">
        <p class="text-sm text-gray-500 dark:text-slate-400">All sent/overdue invoices requiring follow-up, sorted by days overdue.</p>
      </div>
      <div class="card p-0">
        <div class="card-header"><span class="card-title">A/R Action List</span><span class="text-xs text-gray-400">{{ arData.length }} outstanding</span></div>
        <div class="overflow-x-auto">
          <table class="mat-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Contact</th>
                <th>Phone</th>
                <th>Invoice No</th>
                <th class="text-right">Amount</th>
                <th class="text-center">Invoice Date</th>
                <th class="text-center">Due Date</th>
                <th class="text-right">Days Overdue</th>
                <th class="text-center">Last Payment</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!arData.length"><td colspan="9" class="text-center py-8 text-gray-400">No outstanding invoices.</td></tr>
              <tr v-for="r in arData" :key="r.invoiceId"
                :class="r.daysOverdue > 0 ? 'bg-red-50/40 dark:bg-red-900/10' : r.daysOverdue > -8 ? 'bg-amber-50/40 dark:bg-amber-900/10' : ''">
                <td class="font-medium text-gray-900 dark:text-slate-100">{{ r.clientName }}</td>
                <td class="text-gray-500 text-sm">{{ r.contactPerson }}</td>
                <td class="text-gray-500 text-sm">{{ r.phone }}</td>
                <td class="font-medium text-sm">{{ r.invoiceNo }}</td>
                <td class="text-right tabular-nums font-semibold">{{ fmtSGD(r.amount) }}</td>
                <td class="text-center text-xs text-gray-400">{{ fmtDate(r.invoiceDate) }}</td>
                <td class="text-center text-xs" :class="r.daysOverdue > 0 ? 'text-red-700 font-medium' : 'text-gray-400'">{{ fmtDate(r.dueDate) }}</td>
                <td class="text-right tabular-nums" :class="r.daysOverdue > 0 ? 'text-red-700 font-bold' : 'text-amber-700 font-medium'">
                  {{ r.daysOverdue > 0 ? `${r.daysOverdue}d` : 'Due soon' }}
                </td>
                <td class="text-center text-xs text-gray-400">{{ r.lastPaymentDate ? fmtDate(r.lastPaymentDate) : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ── Fleet Compliance ── -->
    <div v-if="tab === 'fleet'" class="space-y-4">
      <div class="flex gap-3 items-center">
        <span class="text-xs px-2.5 py-1 rounded-full bg-red-50 text-red-700 font-semibold border border-red-200">Red = Expired</span>
        <span class="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-semibold border border-amber-200">Amber = &lt;30 days</span>
        <span class="text-xs px-2.5 py-1 rounded-full bg-green-50 text-green-700 font-semibold border border-green-200">Green = OK</span>
      </div>
      <div class="card p-0">
        <div class="card-header"><span class="card-title">Fleet Compliance</span><span class="text-xs text-gray-400">{{ fleetData.length }} vehicles</span></div>
        <div class="overflow-x-auto">
          <table class="mat-table">
            <thead>
              <tr>
                <th>Plate</th>
                <th>Type</th>
                <th class="text-center">COE Expiry</th>
                <th class="text-center">Road Tax</th>
                <th class="text-center">Insurance</th>
                <th class="text-center">Inspection</th>
                <th class="text-center">Overall</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!fleetData.length"><td colspan="7" class="text-center py-8 text-gray-400">No vehicles found.</td></tr>
              <tr v-for="v in fleetData" :key="v.id">
                <td class="font-bold text-gray-900 dark:text-slate-100">{{ v.plateNumber }}</td>
                <td class="text-gray-500 text-sm">{{ v.type }} {{ v.size }}</td>
                <td class="text-center text-xs px-3 py-2" :class="fleetCellClass(v.coeExpiry)">{{ v.coeExpiry ? fmtDate(v.coeExpiry) : '—' }}</td>
                <td class="text-center text-xs px-3 py-2" :class="fleetCellClass(v.roadTaxExpiry)">{{ v.roadTaxExpiry ? fmtDate(v.roadTaxExpiry) : '—' }}</td>
                <td class="text-center text-xs px-3 py-2" :class="fleetCellClass(v.insuranceExpiry)">{{ v.insuranceExpiry ? fmtDate(v.insuranceExpiry) : '—' }}</td>
                <td class="text-center text-xs px-3 py-2" :class="fleetCellClass(v.inspectionDue)">{{ v.inspectionDue ? fmtDate(v.inspectionDue) : '—' }}</td>
                <td class="text-center">
                  <span v-if="[v.coeExpiry,v.roadTaxExpiry,v.insuranceExpiry,v.inspectionDue].filter(Boolean).some(d=>Math.ceil((new Date(d)-new Date())/86400000)<0)"
                    class="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-bold">Expired</span>
                  <span v-else-if="[v.coeExpiry,v.roadTaxExpiry,v.insuranceExpiry,v.inspectionDue].filter(Boolean).some(d=>Math.ceil((new Date(d)-new Date())/86400000)<=30)"
                    class="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold">Due Soon</span>
                  <span v-else
                    class="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-semibold">OK</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

  </div>
</template>
