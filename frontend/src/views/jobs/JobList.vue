<script setup>
import { ref, computed, onMounted } from 'vue';
import { jobsApi } from '../../api/index.js';
import { useAuthStore } from '../../stores/auth.js';
import StatusBadge from '../../components/shared/StatusBadge.vue';

const auth = useAuthStore();
const jobs = ref([]);
const loading = ref(true);
const search = ref('');
const deletingId = ref('');

const filtered = computed(() => {
  const q = search.value.toLowerCase();
  return q ? jobs.value.filter(j => j.description?.toLowerCase().includes(q) || j.client?.companyName.toLowerCase().includes(q)) : jobs.value;
});

function fmt(d) { return d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; }

async function updateStatus(job, status) {
  await jobsApi.updateStatus(job.id, status);
  job.status = status;
}

onMounted(async () => {
  try { jobs.value = (await jobsApi.list()).data; }
  finally { loading.value = false; }
});

async function deletePermanent(job) {
  if (!confirm(`Permanently delete this job? This cannot be undone.`)) return;
  deletingId.value = job.id;
  try {
    await jobsApi.removePermanent(job.id);
    jobs.value = jobs.value.filter(j => j.id !== job.id);
  } catch (e) { alert(e.response?.data?.message || 'Delete failed.'); }
  finally { deletingId.value = ''; }
}
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ auth.isDriver ? 'My Jobs' : 'Jobs' }}</h1>
        <p class="page-subtitle">{{ jobs.length }} job{{ jobs.length !== 1 ? 's' : '' }}</p>
      </div>
      <RouterLink v-if="!auth.isDriver" to="/jobs/new" class="btn-primary">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
        New Job
      </RouterLink>
    </div>

    <div class="filter-bar">
      <div class="search-input w-64">
        <svg class="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <input v-model="search" placeholder="Search jobs…"/>
      </div>
    </div>

    <div class="card p-0 overflow-hidden">
      <table class="mat-table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Client</th>
            <th>Period</th>
            <th>Vehicle</th>
            <th>Driver</th>
            <th>Status</th>
            <th class="w-24"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading"><td colspan="7" class="text-center py-12 text-gray-400">Loading…</td></tr>
          <tr v-else-if="!filtered.length"><td colspan="7" class="text-center py-12 text-gray-400">No jobs found.</td></tr>
          <tr v-for="job in filtered" :key="job.id">
            <td><RouterLink :to="`/jobs/${job.id}`" class="font-medium text-blue-600 hover:underline">{{ job.description }}</RouterLink></td>
            <td class="text-gray-600">{{ job.client?.companyName }}</td>
            <td class="text-gray-500 text-xs">{{ fmt(job.fromDate) }} — {{ fmt(job.toDate) }}</td>
            <td class="text-gray-500">{{ job.vehicle ? `${job.vehicle.plateNumber} (${job.vehicle.size})` : '—' }}</td>
            <td class="text-gray-500">{{ job.driver?.user?.name || '—' }}</td>
            <td><StatusBadge :status="job.status"/></td>
            <td>
              <div class="flex gap-1">
                <button v-if="auth.isDriver && job.status === 'pending'" @click="updateStatus(job,'in_transit')" class="btn-secondary h-7 px-2 text-xs">Start</button>
                <button v-if="auth.isDriver && job.status === 'in_transit'" @click="updateStatus(job,'delivered')" class="btn-primary h-7 px-2 text-xs">Done</button>
                <RouterLink v-if="!auth.isDriver" :to="`/jobs/${job.id}/edit`" class="btn-icon text-gray-400 hover:text-blue-600" title="Edit">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                </RouterLink>
                <button v-if="auth.isAdmin" @click="deletePermanent(job)" :disabled="deletingId === job.id" class="btn-icon text-gray-400 hover:text-red-600" title="Delete permanently">
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
