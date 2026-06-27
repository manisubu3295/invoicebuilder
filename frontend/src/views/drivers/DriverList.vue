<script setup>
import { ref, onMounted } from 'vue';
import { driversApi, vehiclesApi } from '../../api/index.js';

const drivers = ref([]);
const vehicles = ref([]);
const loading = ref(true);
const showForm = ref(false);
const saving = ref(false);
const error = ref('');
const editingId = ref(null);
const form = ref(blank());

function blank() {
  return { name: '', email: '', phone: '', password: '', licenseNumber: '', licenseExpiry: '', assignedVehicleId: '', isActive: true };
}

function licenseWarning(expiry) {
  if (!expiry) return false;
  return Math.ceil((new Date(expiry) - new Date()) / 86400000) <= 30;
}

function fmt(d) { return d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; }

function openAdd() {
  editingId.value = null;
  form.value = blank();
  error.value = '';
  showForm.value = true;
}

function openEdit(d) {
  editingId.value = d.id;
  form.value = {
    name: d.user?.name || '',
    email: d.user?.email || '',
    phone: d.user?.phone || '',
    password: '',
    licenseNumber: d.licenseNumber || '',
    licenseExpiry: d.licenseExpiry || '',
    assignedVehicleId: d.assignedVehicleId || '',
    isActive: d.user?.isActive ?? true,
  };
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
      const payload = { ...form.value };
      if (!payload.password) delete payload.password;
      await driversApi.update(editingId.value, payload);
    } else {
      await driversApi.create(form.value);
    }
    drivers.value = (await driversApi.list()).data;
    cancelForm();
  } catch (e) { error.value = e.response?.data?.message || 'Error saving driver.'; }
  finally { saving.value = false; }
}

onMounted(async () => {
  try {
    [drivers.value, vehicles.value] = await Promise.all([driversApi.list().then(r => r.data), vehiclesApi.list().then(r => r.data)]);
  } finally { loading.value = false; }
});
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h1 class="page-title">Drivers</h1>
        <p class="page-subtitle">{{ drivers.length }} driver{{ drivers.length !== 1 ? 's' : '' }} registered</p>
      </div>
      <button @click="openAdd" class="btn-primary">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
        Add Driver
      </button>
    </div>

    <div v-if="showForm" class="card mb-5">
      <div class="flex items-center justify-between mb-5">
        <h2 class="card-title">{{ editingId ? 'Edit Driver' : 'New Driver Account' }}</h2>
        <button @click="cancelForm" class="btn-icon"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
      </div>
      <div v-if="error" class="alert-error mb-4">{{ error }}</div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div class="input-group"><label class="input-label">Full Name *</label><input v-model="form.name" class="input-field"/></div>
        <div class="input-group">
          <label class="input-label">Email *</label>
          <input v-model="form.email" type="email" :disabled="!!editingId" class="input-field"/>
          <p v-if="editingId" class="text-xs text-gray-400 mt-1 px-3">Email cannot be changed after creation.</p>
        </div>
        <div class="input-group"><label class="input-label">Phone</label><input v-model="form.phone" class="input-field"/></div>
        <div class="input-group">
          <label class="input-label">Password {{ editingId ? '(leave blank to keep)' : '*' }}</label>
          <input v-model="form.password" type="password" class="input-field"/>
        </div>
        <div class="input-group"><label class="input-label">License No</label><input v-model="form.licenseNumber" class="input-field"/></div>
        <div class="input-group"><label class="input-label">License Expiry</label><input v-model="form.licenseExpiry" type="date" class="input-field"/></div>
        <div class="input-group sm:col-span-2">
          <label class="input-label">Assigned Vehicle</label>
          <select v-model="form.assignedVehicleId" class="input-field">
            <option value="">None</option>
            <option v-for="v in vehicles.filter(v => v.status === 'active')" :key="v.id" :value="v.id">{{ v.plateNumber }} ({{ v.size }})</option>
          </select>
        </div>
        <div v-if="editingId" class="flex items-center pt-1">
          <label class="flex items-center gap-2.5 cursor-pointer">
            <input v-model="form.isActive" type="checkbox" class="w-4 h-4 rounded accent-blue-600"/>
            <span class="text-sm text-gray-700 dark:text-slate-300">Active (can log in)</span>
          </label>
        </div>
      </div>
      <div class="flex gap-3 mt-6">
        <button @click="save" :disabled="saving" class="btn-primary">{{ saving ? 'Saving…' : (editingId ? 'Update Driver' : 'Create Driver') }}</button>
        <button @click="cancelForm" class="btn-secondary">Cancel</button>
      </div>
    </div>

    <div class="card p-0 overflow-hidden">
      <table class="mat-table">
        <thead>
          <tr><th>Name</th><th>Email</th><th>Phone</th><th>License No</th><th>Expiry</th><th>Vehicle</th><th>Status</th><th class="w-10"></th></tr>
        </thead>
        <tbody>
          <tr v-if="loading"><td colspan="8" class="text-center py-12 text-gray-400">Loading…</td></tr>
          <tr v-else-if="!drivers.length"><td colspan="8" class="text-center py-12 text-gray-400">No drivers yet.</td></tr>
          <tr v-for="d in drivers" :key="d.id" :class="!d.user?.isActive ? 'opacity-50' : ''">
            <td class="font-medium text-gray-900 dark:text-slate-100">{{ d.user?.name }}</td>
            <td class="text-gray-600 dark:text-slate-400">{{ d.user?.email }}</td>
            <td class="text-gray-500">{{ d.user?.phone || '—' }}</td>
            <td class="text-gray-600">{{ d.licenseNumber || '—' }}</td>
            <td :class="licenseWarning(d.licenseExpiry) ? 'text-red-700 font-medium' : 'text-gray-500'">
              {{ fmt(d.licenseExpiry) }}
              <span v-if="licenseWarning(d.licenseExpiry)" class="text-xs ml-1">⚠ Expiring</span>
            </td>
            <td class="text-gray-500">{{ d.assignedVehicle ? `${d.assignedVehicle.plateNumber} (${d.assignedVehicle.size})` : '—' }}</td>
            <td><span :class="d.user?.isActive ? 'badge-active' : 'badge-inactive'">{{ d.user?.isActive ? 'Active' : 'Inactive' }}</span></td>
            <td>
              <button @click="openEdit(d)" class="btn-icon text-gray-400 hover:text-blue-600" title="Edit">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
