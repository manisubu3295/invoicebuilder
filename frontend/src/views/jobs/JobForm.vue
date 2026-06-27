<script setup>
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { jobsApi, clientsApi, driversApi, vehiclesApi } from '../../api/index.js';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const route = useRoute();
const router = useRouter();
const isEdit = computed(() => !!route.params.id);
const form = ref({
  clientId: '', vehicleId: '', driverId: '', description: '', fromDate: '', toDate: '', notes: '',
  pickupLat: null, pickupLng: null, pickupAddress: '',
  deliveryLat: null, deliveryLng: null, deliveryAddress: '',
});
const clients = ref([]);
const drivers = ref([]);
const vehicles = ref([]);
const loading = ref(false);
const error = ref('');

// Map
const mapEl = ref(null);
const pinMode = ref('pickup'); // 'pickup' | 'delivery' | null
let map = null;
let pickupMarker = null;
let deliveryMarker = null;

const pickupIcon = L.divIcon({
  className: '',
  html: `<div style="background:#2563eb;color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,.3);border:2px solid white">P</div>`,
  iconSize: [28, 28], iconAnchor: [14, 14],
});
const deliveryIcon = L.divIcon({
  className: '',
  html: `<div style="background:#16a34a;color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,.3);border:2px solid white">D</div>`,
  iconSize: [28, 28], iconAnchor: [14, 14],
});

function setPickupMarker(lat, lng) {
  if (pickupMarker) pickupMarker.remove();
  pickupMarker = L.marker([lat, lng], { icon: pickupIcon }).addTo(map);
  pickupMarker.bindPopup('<b>Pickup Location</b>').openPopup();
  form.value.pickupLat = lat;
  form.value.pickupLng = lng;
  form.value.pickupAddress = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function setDeliveryMarker(lat, lng) {
  if (deliveryMarker) deliveryMarker.remove();
  deliveryMarker = L.marker([lat, lng], { icon: deliveryIcon }).addTo(map);
  deliveryMarker.bindPopup('<b>Delivery Location</b>').openPopup();
  form.value.deliveryLat = lat;
  form.value.deliveryLng = lng;
  form.value.deliveryAddress = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function clearPickup() {
  if (pickupMarker) { pickupMarker.remove(); pickupMarker = null; }
  form.value.pickupLat = null; form.value.pickupLng = null; form.value.pickupAddress = '';
}
function clearDelivery() {
  if (deliveryMarker) { deliveryMarker.remove(); deliveryMarker = null; }
  form.value.deliveryLat = null; form.value.deliveryLng = null; form.value.deliveryAddress = '';
}

async function initMap() {
  await nextTick();
  if (!mapEl.value || map) return;
  map = L.map(mapEl.value).setView([1.3521, 103.8198], 11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
  }).addTo(map);

  // Restore pins if editing
  if (form.value.pickupLat) setPickupMarker(form.value.pickupLat, form.value.pickupLng);
  if (form.value.deliveryLat) setDeliveryMarker(form.value.deliveryLat, form.value.deliveryLng);

  map.on('click', (e) => {
    if (pinMode.value === 'pickup') {
      setPickupMarker(e.latlng.lat, e.latlng.lng);
      pinMode.value = 'delivery';
    } else if (pinMode.value === 'delivery') {
      setDeliveryMarker(e.latlng.lat, e.latlng.lng);
      pinMode.value = null;
    }
  });
}

onMounted(async () => {
  [clients.value, drivers.value, vehicles.value] = await Promise.all([
    clientsApi.list().then(r => r.data),
    driversApi.list().then(r => r.data),
    vehiclesApi.list().then(r => r.data.filter(v => v.status === 'active')),
  ]);
  if (isEdit.value) {
    const { data } = await jobsApi.get(route.params.id);
    form.value = {
      clientId: data.clientId, vehicleId: data.vehicleId || '', driverId: data.driverId || '',
      description: data.description, fromDate: data.fromDate, toDate: data.toDate, notes: data.notes || '',
      pickupLat: data.pickupLat || null, pickupLng: data.pickupLng || null, pickupAddress: data.pickupAddress || '',
      deliveryLat: data.deliveryLat || null, deliveryLng: data.deliveryLng || null, deliveryAddress: data.deliveryAddress || '',
    };
    if (data.pickupLat || data.deliveryLat) pinMode.value = null;
  }
  await initMap();
});

onUnmounted(() => {
  if (map) { map.remove(); map = null; }
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
  <div class="max-w-2xl page-container">
    <div class="flex items-center gap-3 mb-6">
      <RouterLink to="/jobs" class="btn-icon text-gray-500">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
      </RouterLink>
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
        <div class="input-group">
          <label class="input-label">Job Description *</label>
          <input v-model="form.description" class="input-field" placeholder="e.g. Delivery to warehouse"/>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
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

        <!-- Route Map -->
        <div class="input-group">
          <label class="input-label">Route Pins</label>
          <p class="text-xs text-gray-500 mb-2">Click the map to place the Pickup pin first, then the Delivery pin. Click again on a pin to move it.</p>

          <!-- Pin mode indicator -->
          <div class="flex gap-2 mb-2">
            <button type="button" @click="pinMode = 'pickup'" :class="pinMode === 'pickup' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'" class="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1">
              <span class="w-4 h-4 rounded-full bg-blue-500 text-white text-[10px] font-bold inline-flex items-center justify-center" :class="pinMode === 'pickup' ? 'bg-white text-blue-700' : ''">P</span>
              Set Pickup
            </button>
            <button type="button" @click="pinMode = 'delivery'" :class="pinMode === 'delivery' ? 'bg-green-600 text-white' : 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'" class="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1">
              <span class="w-4 h-4 rounded-full bg-green-500 text-white text-[10px] font-bold inline-flex items-center justify-center" :class="pinMode === 'delivery' ? 'bg-white text-green-700' : ''">D</span>
              Set Delivery
            </button>
            <span v-if="pinMode" class="text-xs text-gray-500 self-center ml-1 italic">Click on the map…</span>
          </div>

          <div ref="mapEl" class="w-full rounded-xl border border-gray-200 overflow-hidden" style="height: 320px;"></div>

          <!-- Pin summary -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <div class="p-3 rounded-lg text-xs" :class="form.pickupLat ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50 border border-gray-100'">
              <div class="font-semibold text-blue-700 mb-1 flex items-center justify-between">
                <span>Pickup Pin</span>
                <button v-if="form.pickupLat" @click="clearPickup" type="button" class="text-gray-400 hover:text-red-500">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
              <div v-if="form.pickupLat" class="text-gray-600">{{ form.pickupLat.toFixed(5) }}, {{ form.pickupLng.toFixed(5) }}</div>
              <div v-else class="text-gray-400 italic">Not set</div>
            </div>
            <div class="p-3 rounded-lg text-xs" :class="form.deliveryLat ? 'bg-green-50 border border-green-100' : 'bg-gray-50 border border-gray-100'">
              <div class="font-semibold text-green-700 mb-1 flex items-center justify-between">
                <span>Delivery Pin</span>
                <button v-if="form.deliveryLat" @click="clearDelivery" type="button" class="text-gray-400 hover:text-red-500">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
              <div v-if="form.deliveryLat" class="text-gray-600">{{ form.deliveryLat.toFixed(5) }}, {{ form.deliveryLng.toFixed(5) }}</div>
              <div v-else class="text-gray-400 italic">Not set</div>
            </div>
          </div>
        </div>
      </div>

      <div class="flex gap-3 mt-7 pt-5 border-t border-gray-100">
        <button @click="submit" :disabled="loading" class="btn-primary">{{ loading ? 'Saving…' : (isEdit ? 'Update Job' : 'Create Job') }}</button>
        <RouterLink to="/jobs" class="btn-secondary">Cancel</RouterLink>
      </div>
    </div>
  </div>
</template>
