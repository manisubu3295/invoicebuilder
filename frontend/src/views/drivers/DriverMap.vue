<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { jobAttendanceApi } from '../../api/index.js';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix leaflet default marker icon paths (broken in Vite)
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
let timer = null;

function clearMarkers() {
  markers.forEach(m => m.remove());
  markers = [];
}

function plotMarkers() {
  clearMarkers();
  for (const s of sessions.value) {
    if (!s.startLat || !s.startLng) continue;
    const driverName = s.driver?.user?.name || 'Driver';
    const plate = s.job?.vehicle?.plateNumber || '—';
    const job = s.job?.description || '—';
    const startTime = s.startTime ? new Date(s.startTime).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit' }) : '—';

    const icon = L.divIcon({
      className: '',
      html: `<div style="background:#22c55e;color:white;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,.3);border:2px solid white">${driverName.charAt(0)}</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    const marker = L.marker([s.startLat, s.startLng], { icon });
    marker.bindPopup(`
      <div style="min-width:180px;font-family:sans-serif;font-size:13px">
        <div style="font-weight:700;font-size:14px;margin-bottom:4px">${driverName}</div>
        <div style="color:#555;margin-bottom:2px">🚛 ${plate}</div>
        <div style="color:#555;margin-bottom:2px">📋 ${job}</div>
        <div style="color:#555">⏱ Started ${startTime}</div>
      </div>
    `);
    marker.addTo(map);
    markers.push(marker);
  }

  if (markers.length > 0) {
    const group = L.featureGroup(markers);
    map.fitBounds(group.getBounds().pad(0.3));
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
    // Default center: Singapore
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
      <div class="flex items-center gap-2">
        <span class="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 border border-green-100 px-3 py-1.5 rounded-full">
          <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          Auto-refresh every 30s
        </span>
        <button @click="fetchActive" class="btn-secondary text-sm">
          <span class="material-icons" style="font-size:16px">refresh</span>
          Refresh
        </button>
      </div>
    </div>

    <!-- Map -->
    <div class="card p-0 overflow-hidden mb-4" style="height: 420px;">
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
            <th>Start Location</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!sessions.length">
            <td colspan="6" class="text-center py-10 text-gray-400">No active drivers right now.</td>
          </tr>
          <tr v-for="s in sessions" :key="s.id">
            <td class="font-medium">{{ s.driver?.user?.name || '—' }}</td>
            <td class="text-gray-600 text-sm">{{ s.job?.description || '—' }}</td>
            <td class="text-gray-500 text-sm">{{ s.job?.vehicle?.plateNumber || '—' }}</td>
            <td class="text-gray-500 text-sm">{{ fmtTime(s.startTime) }}</td>
            <td class="text-gray-500 text-xs">
              <span v-if="s.startLat">{{ s.startLat?.toFixed(4) }}°N, {{ s.startLng?.toFixed(4) }}°E</span>
              <span v-else class="text-gray-300">No GPS</span>
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
