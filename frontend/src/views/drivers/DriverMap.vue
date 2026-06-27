<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { jobAttendanceApi } from '../../api/index.js';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const mapEl = ref(null);
const sessions = ref([]);
const loading = ref(true);
const lastRefresh = ref(null);
let map = null;
let markers = [];
let destinationMarkers = [];
let timer = null;

const pickupIcon = L.divIcon({
  className: '',
  html: `<div style="background:#2563eb;color:white;border-radius:4px;padding:2px 5px;font-size:10px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,.3);border:1px solid white;white-space:nowrap">P</div>`,
  iconSize: [20, 20], iconAnchor: [10, 10],
});
const deliveryIcon = L.divIcon({
  className: '',
  html: `<div style="background:#16a34a;color:white;border-radius:4px;padding:2px 5px;font-size:10px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,.3);border:1px solid white;white-space:nowrap">D</div>`,
  iconSize: [20, 20], iconAnchor: [10, 10],
});

function clearMarkers() {
  markers.forEach(m => m.remove()); markers = [];
  destinationMarkers.forEach(m => m.remove()); destinationMarkers = [];
}

function plotMarkers() {
  clearMarkers();
  const bounds = [];

  for (const s of sessions.value) {
    // Use currentLat/currentLng (live ping) if available, fall back to startLat/startLng
    const lat = s.currentLat ?? s.startLat;
    const lng = s.currentLng ?? s.startLng;
    const isLive = !!(s.currentLat && s.currentLng);

    const driverName = s.driver?.user?.name || 'Driver';
    const plate = s.job?.vehicle?.plateNumber || '—';
    const jobDesc = s.job?.description || '—';
    const startTime = s.startTime ? new Date(s.startTime).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit' }) : '—';
    const lastPing = s.lastPingAt ? new Date(s.lastPingAt).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : null;

    if (lat && lng) {
      const driverIcon = L.divIcon({
        className: '',
        html: `<div style="background:${isLive ? '#22c55e' : '#f59e0b'};color:white;border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,.35);border:2px solid white">${driverName.charAt(0)}</div>`,
        iconSize: [34, 34], iconAnchor: [17, 17],
      });

      const marker = L.marker([lat, lng], { icon: driverIcon });
      marker.bindPopup(`
        <div style="min-width:200px;font-family:sans-serif;font-size:13px">
          <div style="font-weight:700;font-size:14px;margin-bottom:4px">${driverName}</div>
          <div style="color:#555;margin-bottom:2px">🚛 ${plate}</div>
          <div style="color:#555;margin-bottom:2px">📋 ${jobDesc}</div>
          <div style="color:#555;margin-bottom:2px">⏱ Started ${startTime}</div>
          ${lastPing ? `<div style="color:#16a34a;font-size:11px">📡 Live ping ${lastPing}</div>` : `<div style="color:#d97706;font-size:11px">⚠ GPS at check-in only</div>`}
          ${lat ? `<div style="color:#888;font-size:11px;margin-top:2px">${lat.toFixed(5)}, ${lng.toFixed(5)}</div>` : ''}
        </div>
      `);
      marker.addTo(map);
      markers.push(marker);
      bounds.push([lat, lng]);
    }

    // Show destination pins for this job
    const job = s.job;
    if (job?.pickupLat && job?.pickupLng) {
      const pm = L.marker([job.pickupLat, job.pickupLng], { icon: pickupIcon });
      pm.bindPopup(`<b>Pickup</b><br>${driverName}<br><span style="font-size:11px;color:#888">${job.pickupLat.toFixed(5)}, ${job.pickupLng.toFixed(5)}</span>`);
      pm.addTo(map);
      destinationMarkers.push(pm);
      bounds.push([job.pickupLat, job.pickupLng]);
    }
    if (job?.deliveryLat && job?.deliveryLng) {
      const dm = L.marker([job.deliveryLat, job.deliveryLng], { icon: deliveryIcon });
      dm.bindPopup(`<b>Delivery</b><br>${driverName}<br><span style="font-size:11px;color:#888">${job.deliveryLat.toFixed(5)}, ${job.deliveryLng.toFixed(5)}</span>`);
      dm.addTo(map);
      destinationMarkers.push(dm);
      bounds.push([job.deliveryLat, job.deliveryLng]);
    }
  }

  if (bounds.length > 0) {
    map.fitBounds(bounds.map(b => b), { padding: [40, 40] });
  }
}

async function fetchActive() {
  try {
    const { data } = await jobAttendanceApi.activeSessions();
    sessions.value = data;
    lastRefresh.value = new Date();
    if (map) plotMarkers();
  } catch (e) {
    console.error('Failed to fetch active sessions', e);
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await fetchActive();
  await nextTick();
  if (mapEl.value) {
    map = L.map(mapEl.value).setView([1.3521, 103.8198], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);
    plotMarkers();
  }
  timer = setInterval(fetchActive, 30_000);
});

onUnmounted(() => {
  clearInterval(timer);
  if (map) { map.remove(); map = null; }
});

function fmtTime(t) {
  return t ? new Date(t).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit' }) : '—';
}
function fmtPing(t) {
  if (!t) return null;
  return new Date(t).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h1 class="page-title">Driver Location Map</h1>
        <p class="page-subtitle">
          {{ sessions.length }} active driver{{ sessions.length !== 1 ? 's' : '' }} today
          <span v-if="lastRefresh" class="text-gray-400"> · refreshed {{ lastRefresh.toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }}</span>
        </p>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <div class="flex items-center gap-3 text-xs">
          <span class="flex items-center gap-1">
            <span class="w-4 h-4 rounded-full bg-green-500 inline-block"></span> Driver (live)
          </span>
          <span class="flex items-center gap-1">
            <span class="w-4 h-4 rounded-full bg-amber-400 inline-block"></span> Driver (check-in GPS)
          </span>
          <span class="flex items-center gap-1">
            <span class="w-4 h-2 rounded bg-blue-600 inline-block"></span> Pickup
          </span>
          <span class="flex items-center gap-1">
            <span class="w-4 h-2 rounded bg-green-700 inline-block"></span> Delivery
          </span>
        </div>
        <span class="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 border border-green-100 px-3 py-1.5 rounded-full">
          <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          Map refreshes every 30s
        </span>
        <button @click="fetchActive" class="btn-secondary text-sm">
          <span class="material-icons" style="font-size:16px">refresh</span>
          Refresh
        </button>
      </div>
    </div>

    <!-- Map -->
    <div class="card p-0 overflow-hidden mb-4" style="height: 450px;">
      <div v-if="loading" class="h-full flex items-center justify-center text-gray-400">
        <div class="text-center">
          <span class="material-icons text-4xl mb-2 block">map</span>
          Loading map…
        </div>
      </div>
      <div v-show="!loading" ref="mapEl" class="w-full h-full"></div>
    </div>

    <!-- Active sessions table -->
    <div class="card p-0 overflow-hidden">
      <div class="px-5 py-3.5 border-b border-gray-100 dark:border-slate-700/60">
        <h2 class="card-title">Active Sessions Today</h2>
      </div>
      <table class="mat-table">
        <thead>
          <tr>
            <th>Driver</th>
            <th>Job</th>
            <th>Vehicle</th>
            <th>Start Time</th>
            <th>Live Position</th>
            <th>Last Ping</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!sessions.length">
            <td colspan="7" class="text-center py-10 text-gray-400">No active drivers right now.</td>
          </tr>
          <tr v-for="s in sessions" :key="s.id">
            <td class="font-medium">{{ s.driver?.user?.name || '—' }}</td>
            <td class="text-gray-600 text-sm">{{ s.job?.description || '—' }}</td>
            <td class="text-gray-500 text-sm">{{ s.job?.vehicle?.plateNumber || '—' }}</td>
            <td class="text-gray-500 text-sm">{{ fmtTime(s.startTime) }}</td>
            <td class="text-gray-500 text-xs font-mono">
              <template v-if="s.currentLat">
                <span class="text-green-600">{{ s.currentLat.toFixed(4) }}, {{ s.currentLng.toFixed(4) }}</span>
              </template>
              <template v-else-if="s.startLat">
                <span class="text-amber-600">{{ s.startLat.toFixed(4) }}, {{ s.startLng.toFixed(4) }}</span>
                <span class="text-gray-400 text-[10px] ml-1">(check-in)</span>
              </template>
              <span v-else class="text-gray-300">No GPS</span>
            </td>
            <td class="text-gray-500 text-xs">
              <span v-if="s.lastPingAt" class="flex items-center gap-1 text-green-600">
                <span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                {{ fmtPing(s.lastPingAt) }}
              </span>
              <span v-else class="text-gray-300">—</span>
            </td>
            <td>
              <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                <span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                Active
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
