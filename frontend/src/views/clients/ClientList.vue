<script setup>
import { ref, computed, onMounted } from 'vue';
import { clientsApi } from '../../api/index.js';
import { useAuthStore } from '../../stores/auth.js';

const auth = useAuthStore();
const clients = ref([]);
const loading = ref(true);
const search = ref('');
const busyId = ref('');

const filtered = computed(() => {
  const q = search.value.toLowerCase();
  return q
    ? clients.value.filter(c =>
        c.companyName.toLowerCase().includes(q) ||
        (c.clientCode || '').toLowerCase().includes(q) ||
        (c.contactPerson || '').toLowerCase().includes(q))
    : clients.value;
});

onMounted(async () => {
  try { clients.value = (await clientsApi.list()).data; }
  finally { loading.value = false; }
});

async function toggleActive(c) {
  busyId.value = c.id;
  try {
    if (c.isActive) {
      if (!confirm(`Deactivate ${c.companyName}? They'll be hidden from client pickers but their history stays intact.`)) return;
      await clientsApi.remove(c.id);
      c.isActive = false;
    } else {
      await clientsApi.update(c.id, { ...c, isActive: true });
      c.isActive = true;
    }
  } catch (e) { alert(e.response?.data?.message || 'Update failed.'); }
  finally { busyId.value = ''; }
}

async function deletePermanent(c) {
  if (!confirm(`Permanently delete ${c.companyName}? This cannot be undone.`)) return;
  busyId.value = c.id;
  try {
    await clientsApi.removePermanent(c.id);
    clients.value = clients.value.filter(x => x.id !== c.id);
  } catch (e) { alert(e.response?.data?.message || 'Delete failed.'); }
  finally { busyId.value = ''; }
}
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h1 class="page-title">Clients</h1>
        <p class="page-subtitle">{{ clients.length }} client{{ clients.length !== 1 ? 's' : '' }} registered</p>
      </div>
      <RouterLink v-if="auth.isAdmin" to="/clients/new" class="btn-primary">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
        New Client
      </RouterLink>
    </div>

    <div class="filter-bar">
      <div class="search-input w-72">
        <svg class="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <input v-model="search" placeholder="Search by name, code or contact…"/>
      </div>
      <div class="text-sm text-gray-500 ml-auto">{{ filtered.length }} result{{ filtered.length !== 1 ? 's' : '' }}</div>
    </div>

    <div class="card p-0 overflow-hidden">
      <table class="mat-table">
        <thead>
          <tr>
            <th>Company</th>
            <th>Code</th>
            <th>Contact Person</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Status</th>
            <th class="w-28"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading"><td colspan="7" class="text-center py-12 text-gray-400">Loading…</td></tr>
          <tr v-else-if="!filtered.length"><td colspan="7" class="text-center py-12 text-gray-400">No clients found.</td></tr>
          <tr v-for="c in filtered" :key="c.id" :class="!c.isActive ? 'opacity-50' : ''">
            <td class="font-medium text-gray-900">{{ c.companyName }}</td>
            <td><span class="badge-sent">{{ c.clientCode || '—' }}</span></td>
            <td class="text-gray-600">{{ c.contactPerson || '—' }}</td>
            <td class="text-gray-600">{{ c.email || '—' }}</td>
            <td class="text-gray-600">{{ c.phone || '—' }}</td>
            <td>
              <button v-if="auth.isAdmin" @click="toggleActive(c)" :disabled="busyId === c.id"
                :class="c.isActive ? 'badge-active cursor-pointer hover:opacity-80' : 'badge-inactive cursor-pointer hover:opacity-80'">
                {{ c.isActive ? 'Active' : 'Inactive' }}
              </button>
              <span v-else :class="c.isActive ? 'badge-active' : 'badge-inactive'">{{ c.isActive ? 'Active' : 'Inactive' }}</span>
            </td>
            <td class="flex gap-1">
              <RouterLink v-if="auth.isAdmin" :to="`/clients/${c.id}/edit`" class="btn-icon text-gray-400 hover:text-blue-600" title="Edit">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              </RouterLink>
              <button v-if="auth.isAdmin" @click="deletePermanent(c)" :disabled="busyId === c.id" class="btn-icon text-gray-400 hover:text-red-600" title="Delete permanently">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
