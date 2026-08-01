<script setup>
import { ref, onMounted } from 'vue';
import { rateUnitsApi } from '../../api/index.js';
import { useAuthStore } from '../../stores/auth.js';
import { useRateUnitsStore } from '../../stores/rateUnits.js';

const auth = useAuthStore();
const rateUnitsStore = useRateUnitsStore();

const units = ref([]);
const loading = ref(false);
const saving = ref(false);
const deleting = ref(null);
const error = ref('');

const blank = () => ({ label: '', divisorDays: 1, calendarBased: false });
const form = ref(blank());
const editingId = ref(null);
const showForm = ref(false);

onMounted(() => load());

async function load() {
  loading.value = true;
  try {
    const { data } = await rateUnitsApi.list({ includeInactive: true });
    units.value = data;
  } finally {
    loading.value = false;
  }
}

function openAdd() {
  editingId.value = null;
  form.value = blank();
  error.value = '';
  showForm.value = true;
}

function openEdit(unit) {
  editingId.value = unit.id;
  form.value = { label: unit.label, divisorDays: unit.divisorDays || 1, calendarBased: !!unit.calendarBased };
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
  error.value = '';
  if (!form.value.label.trim()) { error.value = 'Label is required.'; return; }
  if (!form.value.calendarBased && (!form.value.divisorDays || form.value.divisorDays < 1)) {
    error.value = 'Billing cycle must be at least 1 day.'; return;
  }
  saving.value = true;
  try {
    if (editingId.value) {
      const { data } = await rateUnitsApi.update(editingId.value, form.value);
      const idx = units.value.findIndex(u => u.id === editingId.value);
      if (idx !== -1) units.value[idx] = data;
    } else {
      const { data } = await rateUnitsApi.create(form.value);
      units.value.push(data);
    }
    rateUnitsStore.invalidate();
    cancelForm();
  } catch (e) {
    error.value = e.response?.data?.message || 'Save failed.';
  } finally {
    saving.value = false;
  }
}

async function deactivate(unit) {
  if (!confirm(`Deactivate "${unit.label}"? It stops showing up as a Per/Qty option on new line items but existing ones keep working.`)) return;
  deleting.value = unit.id;
  try {
    await rateUnitsApi.remove(unit.id);
    unit.isActive = false;
    rateUnitsStore.invalidate();
  } catch (e) {
    alert(e.response?.data?.message || 'Deactivate failed.');
  } finally {
    deleting.value = null;
  }
}

async function reactivate(unit) {
  deleting.value = unit.id;
  try {
    await rateUnitsApi.update(unit.id, { label: unit.label, divisorDays: unit.divisorDays, calendarBased: unit.calendarBased, isActive: true });
    unit.isActive = true;
    rateUnitsStore.invalidate();
  } catch (e) {
    alert(e.response?.data?.message || 'Reactivate failed.');
  } finally {
    deleting.value = null;
  }
}

async function deletePermanent(unit) {
  if (!confirm(`Permanently delete "${unit.label}"? This cannot be undone.`)) return;
  deleting.value = unit.id;
  try {
    await rateUnitsApi.removePermanent(unit.id);
    units.value = units.value.filter(u => u.id !== unit.id);
    rateUnitsStore.invalidate();
  } catch (e) {
    alert(e.response?.data?.message || 'Delete failed.');
  } finally {
    deleting.value = null;
  }
}
</script>

<template>
  <div class="page-container">

    <!-- Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Billing Units</h1>
        <p class="page-subtitle">Options shown in the "Per / Qty" field on invoice and quotation line items.</p>
      </div>
      <button @click="openAdd" class="btn-primary">
        <span class="material-icons text-[18px]" style="font-family:'Material Icons',serif;font-style:normal">add</span>
        Add Unit
      </button>
    </div>

    <!-- Add / Edit form -->
    <div v-if="showForm" class="card mb-5">
      <div class="flex items-center justify-between mb-5">
        <h2 class="card-title">{{ editingId ? 'Edit Unit' : 'New Unit' }}</h2>
        <button @click="cancelForm" class="btn-icon">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      <div v-if="error" class="alert-error mb-4">{{ error }}</div>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div class="sm:col-span-2 input-group">
          <label class="input-label">Label *</label>
          <input v-model="form.label" type="text" class="input-field" placeholder="e.g. Per Month"/>
        </div>
        <div v-if="!form.calendarBased" class="input-group">
          <label class="input-label">Billing Cycle (days) *</label>
          <input v-model.number="form.divisorDays" type="number" min="1" step="1" class="input-field" placeholder="30"/>
        </div>
      </div>
      <label class="flex items-start gap-2 mt-4 text-sm text-gray-600 cursor-pointer">
        <input type="checkbox" v-model="form.calendarBased" class="mt-0.5"/>
        <span>
          Use calendar months instead of a fixed day cycle
          <span class="block text-xs text-gray-400">Bills by actual calendar months crossed, so a 28, 30, or 31-day month all count as exactly 1 — recommended for "Per Month".</span>
        </span>
      </label>
      <p v-if="!form.calendarBased" class="text-xs text-gray-400 mt-2">
        The date range on a line item is divided by this to get the billed quantity — e.g. 7 for a week bills a 65-day range as 10 weeks.
      </p>
      <div class="flex gap-3 mt-6">
        <button @click="save" :disabled="saving" class="btn-primary">
          {{ saving ? 'Saving…' : (editingId ? 'Update Unit' : 'Add Unit') }}
        </button>
        <button @click="cancelForm" class="btn-secondary">Cancel</button>
      </div>
    </div>

    <!-- Table -->
    <div class="card p-0 overflow-hidden">
      <div v-if="loading" class="text-center py-12 text-sm text-gray-400">Loading…</div>
      <div v-else-if="!units.length" class="empty-state">
        <div class="empty-state-icon">📅</div>
        <div class="empty-state-title">No billing units yet</div>
        <div class="empty-state-body">Add units above — Per Day and Per Week are seeded by default.</div>
      </div>
      <table v-else class="mat-table">
        <thead>
          <tr>
            <th>Label</th>
            <th class="text-right">Billing Cycle</th>
            <th>Status</th>
            <th class="w-28"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="unit in units" :key="unit.id" :class="[editingId === unit.id ? 'bg-blue-50' : '', !unit.isActive ? 'opacity-50' : '']">
            <td class="font-medium text-gray-900">{{ unit.label }}</td>
            <td class="text-right text-gray-500 tabular-nums">
              {{ unit.calendarBased ? 'Calendar month' : `${unit.divisorDays} day${unit.divisorDays !== 1 ? 's' : ''}` }}
            </td>
            <td><span :class="unit.isActive ? 'badge-active' : 'badge-inactive'">{{ unit.isActive ? 'Active' : 'Inactive' }}</span></td>
            <td>
              <div class="flex gap-0.5 justify-end">
                <button @click="openEdit(unit)" class="btn-icon text-gray-400 hover:text-blue-600" title="Edit">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                </button>
                <button v-if="unit.isActive" @click="deactivate(unit)" :disabled="deleting === unit.id" class="btn-icon text-gray-400 hover:text-amber-600 disabled:opacity-40" title="Deactivate">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
                </button>
                <button v-else @click="reactivate(unit)" :disabled="deleting === unit.id" class="btn-icon text-gray-400 hover:text-emerald-600 disabled:opacity-40" title="Reactivate">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                </button>
                <button v-if="auth.isAdmin" @click="deletePermanent(unit)" :disabled="deleting === unit.id" class="btn-icon text-gray-400 hover:text-red-700 disabled:opacity-40" title="Delete permanently">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

  </div>
</template>
