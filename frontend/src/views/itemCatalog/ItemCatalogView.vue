<script setup>
import { ref, onMounted, watch } from 'vue';
import { itemCatalogApi } from '../../api/index.js';
import { useAuthStore } from '../../stores/auth.js';

const auth = useAuthStore();

const items = ref([]);
const loading = ref(false);
const saving = ref(false);
const deleting = ref(null);
const error = ref('');
const search = ref('');
let searchTimer = null;

const blank = () => ({ name: '', unit: '', unitPrice: '' });
const form = ref(blank());
const editingId = ref(null);
const showForm = ref(false);

onMounted(() => load());

watch(search, () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(load, 300);
});

async function load() {
  loading.value = true;
  try {
    const { data } = await itemCatalogApi.list({ search: search.value || undefined, includeInactive: true });
    items.value = data;
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

function openEdit(item) {
  editingId.value = item.id;
  form.value = { name: item.name, unit: item.unit || '', unitPrice: item.unitPrice };
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
  if (!form.value.name.trim()) { error.value = 'Item name is required.'; return; }
  saving.value = true;
  try {
    if (editingId.value) {
      const { data } = await itemCatalogApi.update(editingId.value, form.value);
      const idx = items.value.findIndex(i => i.id === editingId.value);
      if (idx !== -1) items.value[idx] = data;
    } else {
      const { data } = await itemCatalogApi.create(form.value);
      items.value.push(data);
      items.value.sort((a, b) => a.name.localeCompare(b.name));
    }
    cancelForm();
  } catch (e) {
    error.value = e.response?.data?.message || 'Save failed.';
  } finally {
    saving.value = false;
  }
}

async function deactivate(item) {
  if (!confirm(`Deactivate "${item.name}"? It stops showing up as a suggestion but stays in the list here.`)) return;
  deleting.value = item.id;
  try {
    await itemCatalogApi.remove(item.id);
    item.isActive = false;
  } catch (e) {
    alert(e.response?.data?.message || 'Deactivate failed.');
  } finally {
    deleting.value = null;
  }
}

async function reactivate(item) {
  deleting.value = item.id;
  try {
    await itemCatalogApi.update(item.id, { ...item, isActive: true });
    item.isActive = true;
  } catch (e) {
    alert(e.response?.data?.message || 'Reactivate failed.');
  } finally {
    deleting.value = null;
  }
}

async function deletePermanent(item) {
  if (!confirm(`Permanently delete "${item.name}"? This cannot be undone.`)) return;
  deleting.value = item.id;
  try {
    await itemCatalogApi.removePermanent(item.id);
    items.value = items.value.filter(i => i.id !== item.id);
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
        <h1 class="page-title">Item Catalog</h1>
        <p class="page-subtitle">Predefined items with fixed unit prices used in delivery log entries.</p>
      </div>
      <button @click="openAdd" class="btn-primary">
        <span class="material-icons text-[18px]" style="font-family:'Material Icons',serif;font-style:normal">add</span>
        Add Item
      </button>
    </div>

    <!-- Add / Edit form -->
    <div v-if="showForm" class="card mb-5">
      <div class="flex items-center justify-between mb-5">
        <h2 class="card-title">{{ editingId ? 'Edit Item' : 'New Item' }}</h2>
        <button @click="cancelForm" class="btn-icon">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      <div v-if="error" class="alert-error mb-4">{{ error }}</div>
      <div class="grid grid-cols-1 sm:grid-cols-4 gap-5">
        <div class="sm:col-span-2 input-group">
          <label class="input-label">Item Name *</label>
          <input v-model="form.name" type="text" class="input-field" placeholder="e.g. Sand, Cement Bag…"/>
        </div>
        <div class="input-group">
          <label class="input-label">Unit</label>
          <input v-model="form.unit" type="text" class="input-field" placeholder="kg, bag, load…"/>
        </div>
        <div class="input-group">
          <label class="input-label">Unit Price *</label>
          <input v-model.number="form.unitPrice" type="number" min="0" step="0.01" class="input-field" placeholder="0.00"/>
        </div>
      </div>
      <div class="flex gap-3 mt-6">
        <button @click="save" :disabled="saving" class="btn-primary">
          {{ saving ? 'Saving…' : (editingId ? 'Update Item' : 'Add Item') }}
        </button>
        <button @click="cancelForm" class="btn-secondary">Cancel</button>
      </div>
    </div>

    <!-- Filter bar -->
    <div class="filter-bar">
      <div class="search-input w-72">
        <svg class="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <input v-model="search" placeholder="Search items…" autocomplete="off"/>
      </div>
      <div class="text-sm text-gray-500 ml-auto">{{ items.length }} item{{ items.length !== 1 ? 's' : '' }}</div>
    </div>

    <!-- Table -->
    <div class="card p-0 overflow-hidden">
      <div v-if="loading" class="text-center py-12 text-sm text-gray-400">Loading…</div>
      <div v-else-if="!items.length" class="empty-state">
        <div class="empty-state-icon">🗂️</div>
        <div class="empty-state-title">{{ search ? 'No items match your search' : 'No items yet' }}</div>
        <div class="empty-state-body">{{ search ? 'Try a different search term.' : 'Add catalog items above.' }}</div>
      </div>
      <table v-else class="mat-table">
        <thead>
          <tr>
            <th>Item Name</th>
            <th>Unit</th>
            <th class="text-right">Unit Price (S$)</th>
            <th>Status</th>
            <th class="w-28"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.id" :class="[editingId === item.id ? 'bg-blue-50' : '', !item.isActive ? 'opacity-50' : '']">
            <td class="font-medium text-gray-900">{{ item.name }}</td>
            <td class="text-gray-500">{{ item.unit || '—' }}</td>
            <td class="text-right font-medium tabular-nums">{{ parseFloat(item.unitPrice).toFixed(2) }}</td>
            <td><span :class="item.isActive ? 'badge-active' : 'badge-inactive'">{{ item.isActive ? 'Active' : 'Inactive' }}</span></td>
            <td>
              <div class="flex gap-0.5 justify-end">
                <button @click="openEdit(item)" class="btn-icon text-gray-400 hover:text-blue-600" title="Edit">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                </button>
                <button v-if="item.isActive" @click="deactivate(item)" :disabled="deleting === item.id" class="btn-icon text-gray-400 hover:text-amber-600 disabled:opacity-40" title="Deactivate">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
                </button>
                <button v-else @click="reactivate(item)" :disabled="deleting === item.id" class="btn-icon text-gray-400 hover:text-emerald-600 disabled:opacity-40" title="Reactivate">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                </button>
                <button v-if="auth.isAdmin" @click="deletePermanent(item)" :disabled="deleting === item.id" class="btn-icon text-gray-400 hover:text-red-700 disabled:opacity-40" title="Delete permanently">
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
