<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { clientsApi, deliveriesApi } from '../../api/index.js';
import { useAuthStore } from '../../stores/auth.js';

const router = useRouter();
const auth = useAuthStore();

const clients = ref([]);
const logs = ref([]);
const loading = ref(false);
const error = ref('');
const deleting = ref(null);

const filters = ref({ clientId: '', startDate: '', endDate: '' });
const isAdminOrStaff = computed(() => auth.user?.role === 'admin' || auth.user?.role === 'staff');

onMounted(async () => {
  if (auth.user?.role !== 'driver') {
    const { data } = await clientsApi.list();
    clients.value = data;
  }
  await loadLogs();
});

async function loadLogs() {
  loading.value = true; error.value = '';
  try {
    const params = {};
    if (filters.value.clientId)  params.clientId  = filters.value.clientId;
    if (filters.value.startDate) params.startDate = filters.value.startDate;
    if (filters.value.endDate)   params.endDate   = filters.value.endDate;
    logs.value = (await deliveriesApi.list(params)).data;
  } catch { error.value = 'Failed to load delivery entries.'; }
  finally { loading.value = false; }
}

watch(filters, loadLogs, { deep: true });

const groupedLogs = computed(() => {
  const g = {};
  logs.value.forEach(l => { (g[l.deliveryDate] ??= []).push(l); });
  return Object.entries(g).sort((a, b) => b[0].localeCompare(a[0]));
});

const pendingByClient = computed(() => {
  const map = {};
  logs.value.filter(l => l.status === 'pending').forEach(l => {
    const cid = l.clientId;
    if (!map[cid]) map[cid] = { client: l.client, count: 0, dates: [] };
    map[cid].count++;
    if (!map[cid].dates.includes(l.deliveryDate)) map[cid].dates.push(l.deliveryDate);
  });
  return Object.values(map);
});

function fmt(d) {
  return d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
}
function logTotal(log) {
  return (log.items?.reduce((s, i) => s + parseFloat(i.totalAmount || 0), 0) || 0).toFixed(2);
}

async function deleteLog(log) {
  if (!confirm(`Delete delivery entry for ${log.client?.companyName} on ${fmt(log.deliveryDate)}?`)) return;
  deleting.value = log.id;
  try {
    await deliveriesApi.remove(log.id);
    logs.value = logs.value.filter(l => l.id !== log.id);
  } catch (e) {
    alert(e.response?.data?.message || 'Delete failed.');
  } finally { deleting.value = null; }
}

function goInvoiceForClient(cs) {
  const dates = cs.dates.slice().sort();
  router.push({ path: '/delivery-log/invoice', query: { clientId: cs.client.id, startDate: dates[0], endDate: dates[dates.length - 1] } });
}
function goGenerateInvoice() {
  const query = {};
  if (filters.value.clientId)  query.clientId  = filters.value.clientId;
  if (filters.value.startDate) query.startDate = filters.value.startDate;
  if (filters.value.endDate)   query.endDate   = filters.value.endDate;
  router.push({ path: '/delivery-log/invoice', query });
}
</script>

<template>
  <div class="page-container">

    <div class="page-header">
      <div>
        <h1 class="page-title">Delivery Log</h1>
        <p class="page-subtitle">Daily delivery entries per client.</p>
      </div>
      <div class="flex gap-2">
        <button v-if="isAdminOrStaff" @click="goGenerateInvoice" class="btn-secondary">Generate Invoice</button>
        <button @click="router.push('/delivery-log/new')" class="btn-primary">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          Log Delivery
        </button>
      </div>
    </div>

    <!-- Pending banner -->
    <div v-if="isAdminOrStaff && pendingByClient.length" class="card mb-4 p-4 border-l-4 border-amber-500" style="box-shadow:var(--md-z1)">
      <div class="flex items-center gap-2 mb-3">
        <svg class="w-4 h-4 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        <span class="text-sm font-medium text-amber-800">Pending — ready to invoice</span>
      </div>
      <div class="space-y-2">
        <div v-for="cs in pendingByClient" :key="cs.client?.id" class="flex items-center justify-between bg-amber-50 rounded px-3 py-2">
          <div>
            <span class="text-sm font-medium text-gray-900">{{ cs.client?.companyName }}</span>
            <span class="ml-2 text-xs text-gray-500">{{ cs.count }} entr{{ cs.count === 1 ? 'y' : 'ies' }} · {{ cs.dates.length }} day{{ cs.dates.length > 1 ? 's' : '' }}</span>
          </div>
          <button @click="goInvoiceForClient(cs)" class="btn-primary h-7 px-3 text-xs">Invoice Now →</button>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="filter-bar">
      <div v-if="auth.user?.role !== 'driver'" class="input-group">
        <label class="input-label">Client</label>
        <select v-model="filters.clientId" class="input-field w-52">
          <option value="">All Clients</option>
          <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.companyName }}</option>
        </select>
      </div>
      <div class="input-group">
        <label class="input-label">From Date</label>
        <input v-model="filters.startDate" type="date" class="input-field w-40"/>
      </div>
      <div class="input-group">
        <label class="input-label">To Date</label>
        <input v-model="filters.endDate" type="date" class="input-field w-40"/>
      </div>
      <div class="text-sm text-gray-500 ml-auto self-end pb-1.5">{{ logs.length }} entr{{ logs.length !== 1 ? 'ies' : 'y' }}</div>
    </div>

    <div v-if="error" class="alert-error mb-4">{{ error }}</div>
    <div v-if="loading" class="text-center py-12 text-gray-400 text-sm">Loading…</div>

    <div v-else-if="!groupedLogs.length" class="empty-state card">
      <div class="empty-state-icon">📦</div>
      <div class="empty-state-title">No delivery entries found</div>
      <div class="empty-state-body">Start logging daily deliveries using the button above.</div>
    </div>

    <!-- Grouped by date -->
    <div v-else class="space-y-4">
      <div v-for="[date, dateLogs] in groupedLogs" :key="date" class="card p-0 overflow-hidden">
        <!-- Date row -->
        <div class="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
          <span class="text-sm font-medium text-gray-800">{{ fmt(date) }}</span>
          <span class="section-label">{{ dateLogs.length }} entr{{ dateLogs.length > 1 ? 'ies' : 'y' }}</span>
        </div>
        <!-- Entries -->
        <div v-for="log in dateLogs" :key="log.id" class="border-b border-gray-100 last:border-0 px-5 py-4">
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap mb-2">
                <span class="font-medium text-gray-900">{{ log.client?.companyName || '—' }}</span>
                <span :class="`badge-${log.status}`">{{ log.status }}</span>
                <span class="text-xs text-gray-400">by {{ log.deliveredBy?.name || '—' }}</span>
              </div>
              <table class="text-xs text-gray-600 w-full max-w-lg">
                <thead><tr class="text-gray-400 uppercase text-[10px]">
                  <th class="text-left pb-1 pr-4">Item</th>
                  <th class="text-right pb-1 pr-4">Qty</th>
                  <th class="text-right pb-1 pr-4">Unit Price</th>
                  <th class="text-right pb-1">Total</th>
                </tr></thead>
                <tbody>
                  <tr v-for="item in log.items" :key="item.id" class="border-t border-gray-100">
                    <td class="py-0.5 pr-4">{{ item.itemName }}</td>
                    <td class="py-0.5 pr-4 text-right tabular-nums">{{ parseFloat(item.quantity).toFixed(3).replace(/\.?0+$/, '') }}</td>
                    <td class="py-0.5 pr-4 text-right tabular-nums">{{ parseFloat(item.unitPrice).toFixed(2) }}</td>
                    <td class="py-0.5 text-right font-medium tabular-nums">{{ parseFloat(item.totalAmount).toFixed(2) }}</td>
                  </tr>
                </tbody>
                <tfoot><tr>
                  <td colspan="3" class="pt-1.5 text-right font-semibold text-gray-700 pr-4">Entry Total</td>
                  <td class="pt-1.5 text-right font-bold text-gray-900 tabular-nums">{{ logTotal(log) }}</td>
                </tr></tfoot>
              </table>
              <div v-if="log.notes" class="mt-1.5 text-xs text-gray-400 italic">{{ log.notes }}</div>
            </div>
            <div class="flex gap-0.5 shrink-0">
              <button v-if="log.status !== 'invoiced' && (auth.user?.role === 'admin' || log.deliveredById === auth.user?.id)"
                @click="router.push(`/delivery-log/${log.id}/edit`)" class="btn-icon text-gray-400 hover:text-blue-600" title="Edit">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              </button>
              <button v-if="log.status !== 'invoiced' && (auth.user?.role === 'admin' || log.deliveredById === auth.user?.id)"
                @click="deleteLog(log)" :disabled="deleting === log.id" class="btn-icon text-gray-400 hover:text-red-700 disabled:opacity-40" title="Delete">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
