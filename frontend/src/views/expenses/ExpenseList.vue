<script setup>
import { ref, computed, onMounted } from 'vue';
import { expensesApi, driversApi, vehiclesApi } from '../../api/index.js';
import { useAuthStore } from '../../stores/auth.js';
import StatusBadge from '../../components/shared/StatusBadge.vue';

const auth = useAuthStore();
const expenses = ref([]);
const drivers = ref([]);
const vehicles = ref([]);
const loading = ref(true);
const rejectNote = ref('');
const rejectingId = ref('');

const filters = ref({ driverId: '', vehicleId: '', status: '', startDate: '', endDate: '' });

const filtered = computed(() => {
  let list = expenses.value;
  if (filters.value.driverId) list = list.filter(e => e.driverId === filters.value.driverId);
  if (filters.value.vehicleId) list = list.filter(e => e.vehicleId === filters.value.vehicleId);
  if (filters.value.status) list = list.filter(e => e.status === filters.value.status);
  return list;
});

const totalPending = computed(() => expenses.value.filter(e => e.status === 'pending').reduce((s, e) => s + parseFloat(e.amount || 0), 0));
const totalApproved = computed(() => expenses.value.filter(e => e.status === 'approved').reduce((s, e) => s + parseFloat(e.amount || 0), 0));

function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; }
function fmtSGD(v) { return `S$${parseFloat(v || 0).toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function catLabel(c) {
  const map = { fuel_petrol: 'Petrol', fuel_diesel: 'Diesel', toll: 'Toll', parking: 'Parking', maintenance: 'Maintenance', other: 'Other' };
  return map[c] || c;
}

async function load() {
  loading.value = true;
  try {
    const params = {};
    if (filters.value.startDate) params.startDate = filters.value.startDate;
    if (filters.value.endDate) params.endDate = filters.value.endDate;
    expenses.value = (await expensesApi.list(params)).data;
  } finally {
    loading.value = false;
  }
}

async function approve(id) {
  await expensesApi.approve(id, {});
  await load();
}

async function reject(id) {
  if (!rejectNote.value.trim()) { alert('Please enter a reason for rejection.'); return; }
  await expensesApi.reject(id, { adminNote: rejectNote.value });
  rejectingId.value = '';
  rejectNote.value = '';
  await load();
}

async function remove(exp) {
  if (!confirm(`Delete this ${catLabel(exp.category)} expense of ${fmtSGD(exp.amount)}?`)) return;
  await expensesApi.remove(exp.id);
  await load();
}

onMounted(async () => {
  const proms = [load()];
  if (auth.isAdmin || auth.user?.role === 'staff') {
    proms.push(driversApi.list().then(r => drivers.value = r.data));
    proms.push(vehiclesApi.list().then(r => vehicles.value = r.data));
  }
  await Promise.all(proms);
});
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ auth.isDriver ? 'My Expenses' : 'Expenses' }}</h1>
        <p class="page-subtitle">{{ expenses.length }} record{{ expenses.length !== 1 ? 's' : '' }}</p>
      </div>
      <RouterLink to="/expenses/new" class="btn-primary">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
        Add Expense
      </RouterLink>
    </div>

    <!-- Summary cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
      <div class="card">
        <div class="section-label mb-1">Total Expenses</div>
        <div class="text-xl font-semibold text-gray-900 dark:text-slate-100">{{ fmtSGD(expenses.reduce((s,e)=>s+parseFloat(e.amount||0),0)) }}</div>
        <div class="text-xs text-gray-400 mt-0.5">{{ expenses.length }} records</div>
      </div>
      <div class="card">
        <div class="section-label mb-1">Pending</div>
        <div class="text-xl font-semibold text-amber-600">{{ fmtSGD(totalPending) }}</div>
        <div class="text-xs text-gray-400 mt-0.5">{{ expenses.filter(e=>e.status==='pending').length }} awaiting review</div>
      </div>
      <div class="card">
        <div class="section-label mb-1">Approved</div>
        <div class="text-xl font-semibold text-green-600">{{ fmtSGD(totalApproved) }}</div>
        <div class="text-xs text-gray-400 mt-0.5">{{ expenses.filter(e=>e.status==='approved').length }} approved</div>
      </div>
      <div class="card">
        <div class="section-label mb-1">Rejected</div>
        <div class="text-xl font-semibold text-red-500">{{ fmtSGD(expenses.filter(e=>e.status==='rejected').reduce((s,e)=>s+parseFloat(e.amount||0),0)) }}</div>
        <div class="text-xs text-gray-400 mt-0.5">{{ expenses.filter(e=>e.status==='rejected').length }} rejected</div>
      </div>
    </div>

    <!-- Filters (admin/staff) -->
    <div v-if="!auth.isDriver" class="filter-bar mb-4">
      <select v-model="filters.driverId" class="input-field w-44">
        <option value="">All Drivers</option>
        <option v-for="d in drivers" :key="d.id" :value="d.id">{{ d.user?.name }}</option>
      </select>
      <select v-model="filters.vehicleId" class="input-field w-44">
        <option value="">All Vehicles</option>
        <option v-for="v in vehicles" :key="v.id" :value="v.id">{{ v.plateNumber }}</option>
      </select>
      <select v-model="filters.status" class="input-field w-36">
        <option value="">All Status</option>
        <option value="pending">Pending</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
      </select>
      <div class="flex items-center gap-2">
        <input v-model="filters.startDate" type="date" class="input-field w-36" @change="load" />
        <span class="text-gray-400 text-sm">to</span>
        <input v-model="filters.endDate" type="date" class="input-field w-36" @change="load" />
      </div>
      <div class="text-sm text-gray-400 ml-auto self-end pb-1.5">{{ filtered.length }} result{{ filtered.length !== 1 ? 's' : '' }}</div>
    </div>

    <!-- Table -->
    <div class="card p-0 overflow-hidden">
      <table class="mat-table">
        <thead>
          <tr>
            <th>Date</th>
            <th v-if="!auth.isDriver">Driver</th>
            <th>Category</th>
            <th>Description</th>
            <th>Vehicle</th>
            <th>Job</th>
            <th class="text-right">Amount</th>
            <th>Fuel L</th>
            <th>Status</th>
            <th class="w-28"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading"><td :colspan="auth.isDriver ? 9 : 10" class="text-center py-12 text-gray-400">Loading…</td></tr>
          <tr v-else-if="!filtered.length"><td :colspan="auth.isDriver ? 9 : 10" class="text-center py-12 text-gray-400">No expenses found.</td></tr>
          <template v-for="exp in filtered" :key="exp.id">
            <tr>
              <td class="text-gray-500 text-sm">{{ fmtDate(exp.date) }}</td>
              <td v-if="!auth.isDriver" class="font-medium text-sm">{{ exp.driver?.user?.name || '—' }}</td>
              <td>
                <span class="text-xs font-medium px-2 py-1 rounded-full"
                  :class="['fuel_petrol','fuel_diesel'].includes(exp.category) ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'">
                  {{ catLabel(exp.category) }}
                </span>
              </td>
              <td class="text-gray-600 text-sm max-w-xs truncate">{{ exp.description || '—' }}</td>
              <td class="text-gray-500 text-sm">{{ exp.vehicle?.plateNumber || '—' }}</td>
              <td class="text-gray-500 text-sm max-w-[120px] truncate">{{ exp.job?.description || '—' }}</td>
              <td class="text-right font-semibold tabular-nums">{{ fmtSGD(exp.amount) }}</td>
              <td class="text-gray-500 text-sm text-center">{{ exp.fuelLiters ? `${exp.fuelLiters}L` : '—' }}</td>
              <td><StatusBadge :status="exp.status" /></td>
              <td>
                <div class="flex gap-1 items-center">
                  <!-- Admin approve/reject (pending only) -->
                  <template v-if="auth.isAdmin && exp.status === 'pending'">
                    <button @click="approve(exp.id)" class="btn-icon text-green-600 hover:bg-green-50" title="Approve">
                      <span class="material-icons" style="font-size:18px">check_circle</span>
                    </button>
                    <button @click="rejectingId = rejectingId === exp.id ? '' : exp.id" class="btn-icon text-red-500 hover:bg-red-50" title="Reject">
                      <span class="material-icons" style="font-size:18px">cancel</span>
                    </button>
                  </template>
                  <!-- Driver edit/delete (pending only) -->
                  <template v-if="auth.isDriver && exp.status === 'pending'">
                    <RouterLink :to="`/expenses/${exp.id}/edit`" class="btn-icon text-gray-400 hover:text-blue-600">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    </RouterLink>
                    <button @click="remove(exp)" class="btn-icon text-gray-400 hover:text-red-600">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                  </template>
                  <!-- Admin note -->
                  <span v-if="exp.adminNote" :title="exp.adminNote" class="material-icons text-gray-300 hover:text-gray-500 cursor-help" style="font-size:16px">info</span>
                </div>
              </td>
            </tr>
            <!-- Reject note input row -->
            <tr v-if="rejectingId === exp.id" class="bg-red-50 dark:bg-red-900/10">
              <td :colspan="auth.isDriver ? 9 : 10" class="px-5 py-3">
                <div class="flex gap-2 items-center">
                  <input v-model="rejectNote" placeholder="Reason for rejection…" class="input-field flex-1 text-sm" />
                  <button @click="reject(exp.id)" class="btn-primary bg-red-600 hover:bg-red-700 text-sm px-3 py-1.5">Reject</button>
                  <button @click="rejectingId='';rejectNote=''" class="btn-secondary text-sm px-3 py-1.5">Cancel</button>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>
