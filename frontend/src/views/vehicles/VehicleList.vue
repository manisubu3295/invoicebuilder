<script setup>
import { ref, onMounted, computed } from 'vue';
import { vehiclesApi } from '../../api/index.js';

const vehicles = ref([]);
const loading = ref(true);
const showForm = ref(false);
const saving = ref(false);
const error = ref('');
const editingId = ref(null);
const form = ref(blank());

function blank() {
  return { plateNumber: '', type: 'Lorry', size: '14ft', notes: '',
    coeExpiry: '', roadTaxExpiry: '', insuranceExpiry: '', inspectionDue: '', mileage: '' };
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}

function expiryClass(dateStr) {
  const d = daysUntil(dateStr);
  if (d === null) return '';
  if (d < 0) return 'text-red-600 font-semibold';
  if (d <= 14) return 'text-red-600 font-semibold';
  if (d <= 30) return 'text-amber-600 font-medium';
  return 'text-gray-600';
}

function expiryLabel(dateStr) {
  const d = daysUntil(dateStr);
  if (d === null) return '—';
  const base = new Date(dateStr).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
  if (d < 0) return `${base} ⚠ EXPIRED`;
  if (d === 0) return `${base} ⚠ TODAY`;
  if (d <= 30) return `${base} (${d}d)`;
  return base;
}

const alerts = computed(() => {
  const out = [];
  for (const v of vehicles.value) {
    if (v.status === 'retired') continue;
    const checks = [['COE', v.coeExpiry], ['Road Tax', v.roadTaxExpiry], ['Insurance', v.insuranceExpiry], ['Inspection', v.inspectionDue]];
    for (const [label, date] of checks) {
      const d = daysUntil(date);
      if (d !== null && d <= 30) out.push({ plate: v.plateNumber, label, date, days: d });
    }
  }
  return out.sort((a, b) => a.days - b.days);
});

function openAdd() { editingId.value = null; form.value = blank(); error.value = ''; showForm.value = true; }

function openEdit(v) {
  editingId.value = v.id;
  form.value = {
    plateNumber: v.plateNumber, type: v.type, size: v.size, notes: v.notes || '',
    coeExpiry: v.coeExpiry || '', roadTaxExpiry: v.roadTaxExpiry || '',
    insuranceExpiry: v.insuranceExpiry || '', inspectionDue: v.inspectionDue || '',
    mileage: v.mileage || '',
  };
  error.value = ''; showForm.value = true;
}

function cancelForm() { showForm.value = false; editingId.value = null; form.value = blank(); error.value = ''; }

async function save() {
  saving.value = true; error.value = '';
  try {
    if (editingId.value) {
      const updated = (await vehiclesApi.update(editingId.value, form.value)).data;
      const idx = vehicles.value.findIndex(v => v.id === editingId.value);
      if (idx !== -1) vehicles.value[idx] = { ...vehicles.value[idx], ...updated };
    } else {
      await vehiclesApi.create(form.value);
      vehicles.value = (await vehiclesApi.list()).data;
    }
    cancelForm();
  } catch (e) { error.value = e.response?.data?.message || 'Error saving vehicle.'; }
  finally { saving.value = false; }
}

async function updateStatus(v, status) {
  await vehiclesApi.update(v.id, { ...v, status });
  v.status = status;
}

async function retire(v) {
  if (!confirm(`Retire ${v.plateNumber}? It will no longer be available for jobs.`)) return;
  await vehiclesApi.remove(v.id);
  v.status = 'retired';
}

onMounted(async () => {
  try { vehicles.value = (await vehiclesApi.list()).data; }
  finally { loading.value = false; }
});

const statusBadge = (s) => s === 'active' ? 'badge-active' : s === 'maintenance' ? 'badge-pending' : 'badge-inactive';
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h1 class="page-title">Fleet Management</h1>
        <p class="page-subtitle">{{ vehicles.length }} vehicle{{ vehicles.length !== 1 ? 's' : '' }} registered</p>
      </div>
      <button @click="openAdd" class="btn-primary">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
        Add Vehicle
      </button>
    </div>

    <!-- Expiry alerts banner -->
    <div v-if="alerts.length" class="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
      <div class="flex items-center gap-2 mb-2">
        <span class="material-icons text-amber-600" style="font-size:18px">warning</span>
        <span class="font-semibold text-amber-800 text-sm">{{ alerts.length }} compliance item{{ alerts.length !== 1 ? 's' : '' }} expiring within 30 days</span>
      </div>
      <div class="flex flex-wrap gap-2">
        <span v-for="a in alerts" :key="a.plate+a.label"
          :class="a.days < 0 ? 'bg-red-100 border-red-200 text-red-700' : a.days <= 14 ? 'bg-red-50 border-red-200 text-red-600' : 'bg-amber-100 border-amber-200 text-amber-700'"
          class="text-xs px-2.5 py-1 rounded-full border font-medium">
          {{ a.plate }} · {{ a.label }} · {{ a.days < 0 ? 'EXPIRED' : a.days === 0 ? 'TODAY' : a.days + 'd' }}
        </span>
      </div>
    </div>

    <!-- Form -->
    <div v-if="showForm" class="card mb-5">
      <div class="flex items-center justify-between mb-5">
        <h2 class="card-title">{{ editingId ? 'Edit Vehicle' : 'New Vehicle' }}</h2>
        <button @click="cancelForm" class="btn-icon"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
      </div>
      <div v-if="error" class="alert-error mb-4">{{ error }}</div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div class="input-group"><label class="input-label">Plate No *</label><input v-model="form.plateNumber" class="input-field uppercase" :disabled="!!editingId"/></div>
        <div class="input-group">
          <label class="input-label">Type *</label>
          <select v-model="form.type" class="input-field"><option>Lorry</option><option>Van</option><option>Truck</option><option>Flatbed</option></select>
        </div>
        <div class="input-group">
          <label class="input-label">Size</label>
          <select v-model="form.size" class="input-field"><option>10ft</option><option>14ft</option><option>24ft</option><option>Van</option></select>
        </div>
        <div class="input-group"><label class="input-label">Mileage (km)</label><input v-model="form.mileage" type="number" class="input-field" placeholder="e.g. 85000"/></div>
        <div class="input-group"><label class="input-label">COE Expiry</label><input v-model="form.coeExpiry" type="date" class="input-field"/></div>
        <div class="input-group"><label class="input-label">Road Tax Expiry</label><input v-model="form.roadTaxExpiry" type="date" class="input-field"/></div>
        <div class="input-group"><label class="input-label">Insurance Expiry</label><input v-model="form.insuranceExpiry" type="date" class="input-field"/></div>
        <div class="input-group"><label class="input-label">LTA Inspection Due</label><input v-model="form.inspectionDue" type="date" class="input-field"/></div>
        <div class="input-group sm:col-span-2"><label class="input-label">Notes</label><input v-model="form.notes" class="input-field" placeholder="Optional"/></div>
      </div>
      <div class="flex gap-3 mt-6">
        <button @click="save" :disabled="saving" class="btn-primary">{{ saving ? 'Saving…' : (editingId ? 'Update Vehicle' : 'Add Vehicle') }}</button>
        <button @click="cancelForm" class="btn-secondary">Cancel</button>
      </div>
    </div>

    <div v-if="loading" class="text-center py-12 text-gray-400 text-sm">Loading…</div>
    <div v-else-if="!vehicles.length" class="empty-state card">
      <div class="empty-state-icon">🚛</div>
      <div class="empty-state-title">No vehicles yet</div>
      <div class="empty-state-body">Add your first vehicle above.</div>
    </div>
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-for="v in vehicles" :key="v.id" class="card" :class="v.status === 'retired' ? 'opacity-50' : ''">
        <div class="flex items-start justify-between mb-2">
          <span class="text-base font-bold text-gray-900 dark:text-slate-100">{{ v.plateNumber }}</span>
          <span :class="statusBadge(v.status)">{{ v.status }}</span>
        </div>
        <div class="text-sm text-gray-600 dark:text-slate-400 mb-3">{{ v.type }} · {{ v.size }}<span v-if="v.mileage" class="ml-2 text-xs text-gray-400">{{ v.mileage.toLocaleString() }} km</span></div>

        <!-- Compliance dates -->
        <div class="space-y-1.5 text-xs mb-3">
          <div v-if="v.coeExpiry" class="flex justify-between">
            <span class="text-gray-400">COE</span>
            <span :class="expiryClass(v.coeExpiry)">{{ expiryLabel(v.coeExpiry) }}</span>
          </div>
          <div v-if="v.roadTaxExpiry" class="flex justify-between">
            <span class="text-gray-400">Road Tax</span>
            <span :class="expiryClass(v.roadTaxExpiry)">{{ expiryLabel(v.roadTaxExpiry) }}</span>
          </div>
          <div v-if="v.insuranceExpiry" class="flex justify-between">
            <span class="text-gray-400">Insurance</span>
            <span :class="expiryClass(v.insuranceExpiry)">{{ expiryLabel(v.insuranceExpiry) }}</span>
          </div>
          <div v-if="v.inspectionDue" class="flex justify-between">
            <span class="text-gray-400">Inspection</span>
            <span :class="expiryClass(v.inspectionDue)">{{ expiryLabel(v.inspectionDue) }}</span>
          </div>
        </div>

        <div v-if="v.notes" class="text-xs text-gray-400 mb-3">{{ v.notes }}</div>
        <div v-if="v.status !== 'retired'" class="flex gap-2 pt-2 border-t border-gray-100 dark:border-slate-700 flex-wrap">
          <button v-if="v.status !== 'active'" @click="updateStatus(v,'active')" class="btn-secondary h-7 px-3 text-xs">Set Active</button>
          <button v-if="v.status === 'active'" @click="updateStatus(v,'maintenance')" class="btn-text h-7 px-3 text-xs text-amber-700">Maintenance</button>
          <button @click="openEdit(v)" class="btn-text h-7 px-3 text-xs text-blue-600">Edit</button>
          <button @click="retire(v)" class="btn-text h-7 px-3 text-xs text-red-600">Retire</button>
        </div>
        <div v-else class="pt-2 border-t border-gray-100 dark:border-slate-700">
          <span class="text-xs text-gray-400 italic">Retired</span>
        </div>
      </div>
    </div>
  </div>
</template>
