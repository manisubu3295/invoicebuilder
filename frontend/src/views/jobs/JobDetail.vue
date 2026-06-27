<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { jobsApi, jobAttendanceApi } from '../../api/index.js';
import { useAuthStore } from '../../stores/auth.js';
import StatusBadge from '../../components/shared/StatusBadge.vue';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const job = ref(null);
const attendance = ref([]);
const loading = ref(true);
const updating = ref(false);
const gpsError = ref('');
const checkinLoading = ref('');

function fmt(d) { return d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'; }
function fmtShort(d) { return d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; }
function fmtTime(t) { return t ? new Date(t).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit' }) : '—'; }

// Generate all dates between fromDate and toDate inclusive
const jobDays = computed(() => {
  if (!job.value?.fromDate || !job.value?.toDate) return [];
  const days = [];
  const start = new Date(job.value.fromDate);
  const end = new Date(job.value.toDate);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
});

// Find attendance record for a given date
function recordForDate(date) {
  return attendance.value.find(a => a.date === date) || null;
}

async function updateStatus(status) {
  updating.value = true;
  try {
    await jobsApi.updateStatus(job.value.id, status);
    job.value.status = status;
  } finally { updating.value = false; }
}

function getGPS() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 8000 }
    );
  });
}

async function checkIn(date) {
  checkinLoading.value = date;
  gpsError.value = '';
  try {
    const gps = await getGPS();
    if (!gps) gpsError.value = 'Location unavailable — checked in without GPS.';
    await jobAttendanceApi.checkin({
      jobId: job.value.id,
      date,
      startLat: gps?.lat || null,
      startLng: gps?.lng || null,
    });
    await loadAttendance();
  } catch (e) {
    gpsError.value = e.response?.data?.message || 'Check-in failed.';
  } finally {
    checkinLoading.value = '';
  }
}

async function checkOut(record) {
  checkinLoading.value = record.date + '-out';
  gpsError.value = '';
  try {
    const gps = await getGPS();
    await jobAttendanceApi.checkout(record.id, {
      endLat: gps?.lat || null,
      endLng: gps?.lng || null,
    });
    await loadAttendance();
  } catch (e) {
    gpsError.value = e.response?.data?.message || 'Check-out failed.';
  } finally {
    checkinLoading.value = '';
  }
}

async function loadAttendance() {
  if (!job.value) return;
  try { attendance.value = (await jobAttendanceApi.list(job.value.id)).data; }
  catch { attendance.value = []; }
}

onMounted(async () => {
  try {
    job.value = (await jobsApi.get(route.params.id)).data;
    await loadAttendance();
  } finally { loading.value = false; }
});
</script>

<template>
  <div v-if="loading" class="flex items-center justify-center h-64 text-gray-400 text-sm">Loading…</div>
  <div v-else-if="job" class="page-container max-w-3xl">

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

    <!-- Job details card -->
    <div class="card space-y-5 mb-5">
      <div>
        <div class="section-label mb-1">Client</div>
        <div class="font-medium text-gray-900 dark:text-slate-100">{{ job.client?.companyName }}</div>
      </div>
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
      <div>
        <div class="section-label mb-1">Vehicle</div>
        <div class="text-gray-800 dark:text-slate-200">
          {{ job.vehicle ? `${job.vehicle.plateNumber} — ${job.vehicle.type} ${job.vehicle.size}` : '—' }}
        </div>
      </div>
      <div>
        <div class="section-label mb-1">Driver</div>
        <div v-if="job.driver" class="text-gray-800 dark:text-slate-200">
          {{ job.driver.user?.name }}
          <span v-if="job.driver.user?.phone" class="text-gray-500 text-sm ml-2">{{ job.driver.user.phone }}</span>
        </div>
        <div v-else class="text-gray-400">—</div>
      </div>
      <div v-if="job.notes">
        <div class="section-label mb-1">Notes</div>
        <div class="text-gray-700 dark:text-slate-300 whitespace-pre-line text-sm">{{ job.notes }}</div>
      </div>
    </div>

    <!-- ── Daily Attendance ── -->
    <div class="card p-0 overflow-hidden">
      <div class="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-slate-700/60">
        <div class="flex items-center gap-2">
          <span class="material-icons text-blue-600" style="font-size:18px">event_available</span>
          <span class="card-title">Daily Attendance</span>
          <span class="text-xs text-gray-400 ml-1">{{ jobDays.length }} day{{ jobDays.length !== 1 ? 's' : '' }}</span>
        </div>
        <span class="text-xs text-gray-400">
          {{ attendance.filter(a=>a.status==='completed').length }} / {{ jobDays.length }} completed
        </span>
      </div>

      <!-- GPS error -->
      <div v-if="gpsError" class="mx-5 mt-3 p-3 rounded-lg bg-amber-50 border border-amber-100 text-xs text-amber-700 flex items-center gap-2">
        <span class="material-icons" style="font-size:16px">warning</span>
        {{ gpsError }}
      </div>

      <!-- Driver view: interactive day cards -->
      <div v-if="auth.isDriver" class="divide-y divide-gray-100 dark:divide-slate-700/40">
        <div v-if="!jobDays.length" class="py-8 text-center text-gray-400 text-sm">No days in this job.</div>
        <div v-for="date in jobDays" :key="date" class="px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div class="font-medium text-gray-800 dark:text-slate-200 text-sm">{{ fmtShort(date) }}</div>
            <div v-if="recordForDate(date)" class="text-xs text-gray-400 mt-0.5">
              <span v-if="recordForDate(date).startTime">In: {{ fmtTime(recordForDate(date).startTime) }}</span>
              <span v-if="recordForDate(date).startLat" class="ml-1 text-green-600">📍</span>
              <span v-if="recordForDate(date).endTime" class="ml-2">Out: {{ fmtTime(recordForDate(date).endTime) }}</span>
              <span v-if="recordForDate(date).endLat" class="ml-1 text-green-600">📍</span>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <!-- Not checked in -->
            <template v-if="!recordForDate(date)">
              <button
                @click="checkIn(date)"
                :disabled="checkinLoading === date"
                class="btn-secondary text-sm h-8 px-3 text-blue-600 border-blue-200 hover:bg-blue-50">
                {{ checkinLoading === date ? 'Locating…' : 'Start Day' }}
              </button>
            </template>
            <!-- Started, not checked out -->
            <template v-else-if="recordForDate(date).status === 'started'">
              <span class="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full border border-amber-100">
                <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                In progress
              </span>
              <button
                @click="checkOut(recordForDate(date))"
                :disabled="checkinLoading === date + '-out'"
                class="btn-primary text-sm h-8 px-3">
                {{ checkinLoading === date + '-out' ? 'Saving…' : 'End Day' }}
              </button>
            </template>
            <!-- Completed -->
            <template v-else>
              <span class="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-1 rounded-full border border-green-100">
                <span class="material-icons" style="font-size:13px">check_circle</span>
                Done
              </span>
            </template>
          </div>
        </div>
      </div>

      <!-- Admin/staff view: read-only table -->
      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-gray-50 dark:bg-slate-700/40">
              <th class="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
              <th class="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Driver</th>
              <th class="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Start</th>
              <th class="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Start Location</th>
              <th class="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">End</th>
              <th class="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">End Location</th>
              <th class="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!attendance.length">
              <td colspan="7" class="text-center py-8 text-gray-400">No attendance records yet.</td>
            </tr>
            <tr v-for="a in attendance" :key="a.id" class="border-t border-gray-100 dark:border-slate-700/40 hover:bg-gray-50/50">
              <td class="px-5 py-3 font-medium text-gray-800">{{ fmtShort(a.date) }}</td>
              <td class="px-5 py-3 text-gray-600">{{ a.driver?.user?.name || '—' }}</td>
              <td class="px-5 py-3 text-gray-500 tabular-nums">{{ fmtTime(a.startTime) }}</td>
              <td class="px-5 py-3 text-gray-400 text-xs">
                <span v-if="a.startLat">{{ a.startLat?.toFixed(4) }}°N, {{ a.startLng?.toFixed(4) }}°E</span>
                <span v-else class="text-gray-300">—</span>
              </td>
              <td class="px-5 py-3 text-gray-500 tabular-nums">{{ fmtTime(a.endTime) }}</td>
              <td class="px-5 py-3 text-gray-400 text-xs">
                <span v-if="a.endLat">{{ a.endLat?.toFixed(4) }}°N, {{ a.endLng?.toFixed(4) }}°E</span>
                <span v-else class="text-gray-300">—</span>
              </td>
              <td class="px-5 py-3"><StatusBadge :status="a.status" /></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
