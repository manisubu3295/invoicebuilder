<script setup>
import { ref, onMounted } from 'vue';
import { vehiclesApi } from '../../api/index.js';

const vehicles = ref([]);
const loading = ref(true);
const showForm = ref(false);
const saving = ref(false);
const error = ref('');
const editingId = ref(null);
const form = ref(blank());

function blank() { return { plateNumber: '', type: 'Lorry', size: '14ft', notes: '' }; }

function openAdd() {
  editingId.value = null;
  form.value = blank();
  error.value = '';
  showForm.value = true;
}

function openEdit(v) {
  editingId.value = v.id;
  form.value = { plateNumber: v.plateNumber, type: v.type, size: v.size, notes: v.notes || '' };
  error.value = '';
  showForm.value = true;
}

function cancelForm() {
  showForm.value = false;
  editingId.value = null;
  form.value = blank();
  error.value = '';
}

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
  if (!confirm(`Retire vehicle ${v.plateNumber}? It will no longer be available for jobs.`)) return;
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
        <div class="input-group"><label class="input-label">Notes</label><input v-model="form.notes" class="input-field" placeholder="Optional"/></div>
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
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <div v-for="v in vehicles" :key="v.id" class="card" :class="v.status === 'retired' ? 'opacity-50' : ''">
        <div class="flex items-start justify-between mb-3">
          <span class="text-base font-bold text-gray-900 dark:text-slate-100">{{ v.plateNumber }}</span>
          <span :class="statusBadge(v.status)">{{ v.status }}</span>
        </div>
        <div class="text-sm text-gray-600 dark:text-slate-400 mb-1">{{ v.type }} · {{ v.size }}</div>
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
