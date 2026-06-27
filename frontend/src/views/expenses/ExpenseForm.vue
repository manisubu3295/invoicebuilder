<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { expensesApi, driversApi, vehiclesApi, jobsApi } from '../../api/index.js';
import { useAuthStore } from '../../stores/auth.js';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const isEdit = computed(() => !!route.params.id);
const loading = ref(false);
const error = ref('');
const drivers = ref([]);
const vehicles = ref([]);
const jobs = ref([]);

const form = ref({
  driverId: '',
  jobId: '',
  vehicleId: '',
  date: new Date().toISOString().slice(0, 10),
  category: '',
  amount: '',
  description: '',
  fuelLiters: '',
  odometer: '',
});

const CATEGORIES = [
  { value: 'fuel_petrol', label: 'Fuel — Petrol' },
  { value: 'fuel_diesel', label: 'Fuel — Diesel' },
  { value: 'toll', label: 'Toll' },
  { value: 'parking', label: 'Parking' },
  { value: 'maintenance', label: 'Maintenance / Repair' },
  { value: 'other', label: 'Other' },
];

const isFuel = computed(() => ['fuel_petrol', 'fuel_diesel'].includes(form.value.category));

onMounted(async () => {
  const promises = [vehiclesApi.list(), jobsApi.list()];
  if (auth.isAdmin || auth.user?.role === 'staff') promises.push(driversApi.list());

  const results = await Promise.all(promises);
  vehicles.value = results[0].data.filter(v => v.status === 'active');
  jobs.value = results[1].data;
  if (results[2]) drivers.value = results[2].data;

  if (isEdit.value) {
    try {
      const { data } = await expensesApi.list({ id: route.params.id });
      const exp = Array.isArray(data) ? data[0] : data;
      if (exp) {
        form.value = {
          driverId: exp.driverId || '',
          jobId: exp.jobId || '',
          vehicleId: exp.vehicleId || '',
          date: exp.date || '',
          category: exp.category || '',
          amount: exp.amount || '',
          description: exp.description || '',
          fuelLiters: exp.fuelLiters || '',
          odometer: exp.odometer || '',
        };
      }
    } catch (e) {
      error.value = 'Failed to load expense';
    }
  }
});

async function submit() {
  error.value = '';
  if (!form.value.date || !form.value.category || !form.value.amount) {
    error.value = 'Date, category, and amount are required.';
    return;
  }
  loading.value = true;
  try {
    const payload = {
      ...form.value,
      jobId: form.value.jobId || null,
      vehicleId: form.value.vehicleId || null,
      driverId: form.value.driverId || null,
      fuelLiters: isFuel.value ? (form.value.fuelLiters || null) : null,
      odometer: form.value.odometer || null,
    };
    if (isEdit.value) {
      await expensesApi.update(route.params.id, payload);
    } else {
      await expensesApi.create(payload);
    }
    router.push('/expenses');
  } catch (e) {
    error.value = e.response?.data?.message || 'Save failed';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="page-container max-w-2xl">
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ isEdit ? 'Edit Expense' : 'Add Expense' }}</h1>
        <p class="page-subtitle">{{ isEdit ? 'Update expense record' : 'Log a new expense' }}</p>
      </div>
    </div>

    <form @submit.prevent="submit" class="card space-y-5">
      <div v-if="error" class="alert-error">{{ error }}</div>

      <!-- Driver (admin/staff only) -->
      <div v-if="auth.isAdmin || auth.user?.role === 'staff'" class="input-group">
        <label class="input-label">Driver</label>
        <select v-model="form.driverId" class="input-field" required>
          <option value="">Select driver…</option>
          <option v-for="d in drivers" :key="d.id" :value="d.id">{{ d.user?.name }}</option>
        </select>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Date -->
        <div class="input-group">
          <label class="input-label">Date <span class="text-red-500">*</span></label>
          <input v-model="form.date" type="date" class="input-field" required />
        </div>

        <!-- Category -->
        <div class="input-group">
          <label class="input-label">Category <span class="text-red-500">*</span></label>
          <select v-model="form.category" class="input-field" required>
            <option value="">Select category…</option>
            <option v-for="c in CATEGORIES" :key="c.value" :value="c.value">{{ c.label }}</option>
          </select>
        </div>

        <!-- Amount -->
        <div class="input-group">
          <label class="input-label">Amount (S$) <span class="text-red-500">*</span></label>
          <input v-model="form.amount" type="number" step="0.01" min="0" class="input-field" required placeholder="0.00" />
        </div>

        <!-- Fuel Liters (conditional) -->
        <div v-if="isFuel" class="input-group">
          <label class="input-label">Fuel Liters</label>
          <input v-model="form.fuelLiters" type="number" step="0.1" min="0" class="input-field" placeholder="e.g. 45.5" />
        </div>

        <!-- Odometer (conditional) -->
        <div v-if="isFuel" class="input-group">
          <label class="input-label">Odometer (km)</label>
          <input v-model="form.odometer" type="number" min="0" class="input-field" placeholder="e.g. 123456" />
        </div>

        <!-- Vehicle -->
        <div class="input-group">
          <label class="input-label">Vehicle</label>
          <select v-model="form.vehicleId" class="input-field">
            <option value="">— None —</option>
            <option v-for="v in vehicles" :key="v.id" :value="v.id">{{ v.plateNumber }} ({{ v.type }})</option>
          </select>
        </div>

        <!-- Job -->
        <div class="input-group">
          <label class="input-label">Linked Job</label>
          <select v-model="form.jobId" class="input-field">
            <option value="">— None —</option>
            <option v-for="j in jobs" :key="j.id" :value="j.id">{{ j.description }} — {{ j.client?.companyName }}</option>
          </select>
        </div>
      </div>

      <!-- Description -->
      <div class="input-group">
        <label class="input-label">Description / Notes</label>
        <textarea v-model="form.description" class="input-field" rows="3" placeholder="Additional details…"></textarea>
      </div>

      <div class="flex gap-3 pt-2">
        <button type="submit" :disabled="loading" class="btn-primary">
          {{ loading ? 'Saving…' : isEdit ? 'Update Expense' : 'Add Expense' }}
        </button>
        <button type="button" @click="router.push('/expenses')" class="btn-secondary">Cancel</button>
      </div>
    </form>
  </div>
</template>
