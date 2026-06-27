<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { jobsApi, clientsApi, driversApi, vehiclesApi } from '../../api/index.js';

const route = useRoute();
const router = useRouter();
const isEdit = computed(() => !!route.params.id);
const form = ref({ clientId: '', vehicleId: '', driverId: '', description: '', fromDate: '', toDate: '', notes: '' });
const clients = ref([]);
const drivers = ref([]);
const vehicles = ref([]);
const loading = ref(false);
const error = ref('');

onMounted(async () => {
  [clients.value, drivers.value, vehicles.value] = await Promise.all([
    clientsApi.list().then(r => r.data),
    driversApi.list().then(r => r.data),
    vehiclesApi.list().then(r => r.data.filter(v => v.status === 'active')),
  ]);
  if (isEdit.value) {
    const { data } = await jobsApi.get(route.params.id);
    form.value = { clientId: data.clientId, vehicleId: data.vehicleId || '', driverId: data.driverId || '', description: data.description, fromDate: data.fromDate, toDate: data.toDate, notes: data.notes || '' };
  }
});

async function submit() {
  loading.value = true; error.value = '';
  try {
    if (isEdit.value) await jobsApi.update(route.params.id, form.value);
    else await jobsApi.create(form.value);
    router.push('/jobs');
  } catch (e) { error.value = e.response?.data?.message || 'Error saving job.'; }
  finally { loading.value = false; }
}
</script>

<template>
  <div class="max-w-xl page-container">
    <div class="flex items-center gap-3 mb-6">
      <RouterLink to="/jobs" class="btn-icon text-gray-500"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg></RouterLink>
      <h1 class="page-title">{{ isEdit ? 'Edit Job' : 'New Delivery Job' }}</h1>
    </div>

    <div class="card">
      <div v-if="error" class="alert-error mb-5">{{ error }}</div>
      <div class="space-y-5">
        <div class="input-group">
          <label class="input-label">Client *</label>
          <select v-model="form.clientId" class="input-field">
            <option value="">Select client…</option>
            <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.companyName }}</option>
          </select>
        </div>
        <div class="input-group"><label class="input-label">Job Description *</label><input v-model="form.description" class="input-field" placeholder="e.g. Delivery to warehouse"/></div>
        <div class="grid grid-cols-2 gap-5">
          <div class="input-group"><label class="input-label">From Date *</label><input v-model="form.fromDate" type="date" class="input-field"/></div>
          <div class="input-group"><label class="input-label">To Date *</label><input v-model="form.toDate" type="date" class="input-field"/></div>
        </div>
        <div class="input-group">
          <label class="input-label">Vehicle</label>
          <select v-model="form.vehicleId" class="input-field">
            <option value="">None</option>
            <option v-for="v in vehicles" :key="v.id" :value="v.id">{{ v.plateNumber }} ({{ v.type }} {{ v.size }})</option>
          </select>
        </div>
        <div class="input-group">
          <label class="input-label">Driver</label>
          <select v-model="form.driverId" class="input-field">
            <option value="">None</option>
            <option v-for="d in drivers" :key="d.id" :value="d.id">{{ d.user?.name }}</option>
          </select>
        </div>
        <div class="input-group"><label class="input-label">Notes</label><textarea v-model="form.notes" class="input-field" rows="2" placeholder="Optional"></textarea></div>
      </div>
      <div class="flex gap-3 mt-7 pt-5 border-t border-gray-100">
        <button @click="submit" :disabled="loading" class="btn-primary">{{ loading ? 'Saving…' : (isEdit ? 'Update Job' : 'Create Job') }}</button>
        <RouterLink to="/jobs" class="btn-secondary">Cancel</RouterLink>
      </div>
    </div>
  </div>
</template>
