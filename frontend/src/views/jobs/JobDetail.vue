<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { jobsApi } from '../../api/index.js';
import { useAuthStore } from '../../stores/auth.js';
import StatusBadge from '../../components/shared/StatusBadge.vue';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const job = ref(null);
const loading = ref(true);
const updating = ref(false);

function fmt(d) { return d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'; }

async function updateStatus(status) {
  updating.value = true;
  try {
    await jobsApi.updateStatus(job.value.id, status);
    job.value.status = status;
  } finally { updating.value = false; }
}

onMounted(async () => {
  try { job.value = (await jobsApi.get(route.params.id)).data; }
  finally { loading.value = false; }
});
</script>

<template>
  <div v-if="loading" class="flex items-center justify-center h-64 text-gray-400 text-sm">Loading…</div>
  <div v-else-if="job" class="page-container max-w-2xl">

    <!-- Toolbar -->
    <div class="flex items-center justify-between flex-wrap gap-3 mb-5">
      <div class="flex items-center gap-3">
        <button @click="router.push('/jobs')" class="btn-icon text-gray-500">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <h1 class="page-title mb-0">{{ job.description }}</h1>
        <StatusBadge :status="job.status" />
      </div>
      <div class="flex gap-2 flex-wrap">
        <button v-if="auth.isDriver && job.status === 'pending'" @click="updateStatus('in_transit')" :disabled="updating" class="btn-secondary">Start Job</button>
        <button v-if="auth.isDriver && job.status === 'in_transit'" @click="updateStatus('delivered')" :disabled="updating" class="btn-primary">Mark Delivered</button>
        <RouterLink v-if="!auth.isDriver" :to="`/jobs/${job.id}/edit`" class="btn-secondary">Edit</RouterLink>
      </div>
    </div>

    <div class="card space-y-5">
      <!-- Client -->
      <div>
        <div class="section-label mb-1">Client</div>
        <div class="font-medium text-gray-900 dark:text-slate-100">{{ job.client?.companyName }}</div>
      </div>

      <!-- Period -->
      <div class="grid grid-cols-2 gap-5">
        <div>
          <div class="section-label mb-1">From Date</div>
          <div class="text-gray-800 dark:text-slate-200">{{ fmt(job.fromDate) }}</div>
        </div>
        <div>
          <div class="section-label mb-1">To Date</div>
          <div class="text-gray-800 dark:text-slate-200">{{ fmt(job.toDate) }}</div>
        </div>
      </div>

      <!-- Vehicle -->
      <div>
        <div class="section-label mb-1">Vehicle</div>
        <div class="text-gray-800 dark:text-slate-200">
          {{ job.vehicle ? `${job.vehicle.plateNumber} — ${job.vehicle.type} ${job.vehicle.size}` : '—' }}
        </div>
      </div>

      <!-- Driver -->
      <div>
        <div class="section-label mb-1">Driver</div>
        <div v-if="job.driver" class="text-gray-800 dark:text-slate-200">
          {{ job.driver.user?.name }}
          <span v-if="job.driver.user?.phone" class="text-gray-500 text-sm ml-2">{{ job.driver.user.phone }}</span>
        </div>
        <div v-else class="text-gray-400">—</div>
      </div>

      <!-- Notes -->
      <div v-if="job.notes">
        <div class="section-label mb-1">Notes</div>
        <div class="text-gray-700 dark:text-slate-300 whitespace-pre-line text-sm">{{ job.notes }}</div>
      </div>
    </div>
  </div>
</template>
