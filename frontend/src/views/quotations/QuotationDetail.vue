<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { quotationsApi } from '../../api/index.js';
import { useSettingsStore } from '../../stores/settings.js';
import StatusBadge from '../../components/shared/StatusBadge.vue';

const route = useRoute();
const router = useRouter();
const settingsStore = useSettingsStore();
const q = ref(null);
const loading = ref(true);
const actionLoading = ref('');
const toast = ref('');

const s = computed(() => settingsStore.settings || {});
const sym = computed(() => s.value.currencySymbol || 'S$');
const cur = computed(() => s.value.currency || 'SGD');
const terms = computed(() => s.value.paymentTermsDays || 30);
const logoText = computed(() => (s.value.logoText || s.value.companyName || 'CO').substring(0, 3).toUpperCase());

function fmt(v) { return `${sym.value}${parseFloat(v || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
}
function calcPeriod(item) {
  if (item.itemType === 'delivery') return fmtDate(item.deliveryDate);
  if (!item.fromDate || !item.toDate) return '';
  const days = Math.round((new Date(item.toDate) - new Date(item.fromDate)) / 86400000) + 1;
  if (item.rateType === 'per_day') return `${days} day${days !== 1 ? 's' : ''}`;
  return `${Math.ceil(days / 7)} wk (${days}d)`;
}
function rateLabel(item) {
  if (item.itemType === 'delivery') {
    const qty = parseFloat(item.quantity || 0), price = parseFloat(item.unitPrice || 0);
    return qty || price ? `${qty.toFixed(3).replace(/\.?0+$/, '')} × ${fmt(price)}` : '';
  }
  return item.rate ? `${fmt(item.rate)} / ${item.rateType === 'per_day' ? 'day' : 'wk'}` : '';
}

function showToast(msg) { toast.value = msg; setTimeout(() => toast.value = '', 3000); }

function viewPdf() {
  const token = localStorage.getItem('akb_token');
  const base = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  window.open(`${base}/quotations/${q.value.id}/pdf?token=${token}`, '_blank');
}

async function sendEmail() {
  if (!confirm(`Send quotation to ${q.value.client?.email}?`)) return;
  actionLoading.value = 'email';
  try {
    await quotationsApi.sendEmail(q.value.id);
    q.value.status = 'sent';
    showToast('Quotation emailed successfully!');
  } catch (e) { showToast('Error: ' + (e.response?.data?.message || 'Email failed')); }
  finally { actionLoading.value = ''; }
}

async function convertToInvoice() {
  if (!confirm('Convert this quotation to an invoice?')) return;
  actionLoading.value = 'convert';
  try {
    const { data } = await quotationsApi.convertToInvoice(q.value.id);
    showToast('Converted to invoice!');
    setTimeout(() => router.push(`/invoices/${data.id}`), 1000);
  } catch (e) { showToast('Error: ' + (e.response?.data?.message || 'Conversion failed')); }
  finally { actionLoading.value = ''; }
}

async function deleteQuotation() {
  if (!confirm('Delete this draft quotation? This cannot be undone.')) return;
  actionLoading.value = 'delete';
  try {
    await quotationsApi.remove(q.value.id);
    router.push('/quotations');
  } catch (e) { showToast('Error: ' + (e.response?.data?.message || 'Delete failed')); actionLoading.value = ''; }
}

onMounted(async () => {
  await settingsStore.fetchSettings();
  try { q.value = (await quotationsApi.get(route.params.id)).data; }
  finally { loading.value = false; }
});
</script>

<template>
  <div v-if="loading" class="flex items-center justify-center h-64 text-gray-400 text-sm">Loading…</div>
  <div v-else-if="q" class="page-container max-w-4xl">

    <Teleport to="body">
      <div v-if="toast" class="fixed top-5 right-5 z-50 px-4 py-2 rounded text-sm text-white bg-green-700" style="box-shadow:var(--md-z4)">{{ toast }}</div>
    </Teleport>

    <!-- Toolbar -->
    <div class="flex items-center justify-between flex-wrap gap-3 mb-5">
      <div class="flex items-center gap-3">
        <RouterLink to="/quotations" class="btn-icon text-gray-500"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg></RouterLink>
        <h1 class="page-title mb-0">{{ q.quotationNo }}</h1>
        <StatusBadge :status="q.status" />
      </div>
      <div class="flex gap-2 flex-wrap">
        <RouterLink v-if="q.status === 'draft'" :to="`/quotations/${q.id}/edit`" class="btn-secondary">Edit</RouterLink>
        <button @click="viewPdf" class="btn-secondary">View PDF</button>
        <button v-if="['draft','sent'].includes(q.status) && q.client?.email" @click="sendEmail" :disabled="actionLoading === 'email'" class="btn-secondary">{{ actionLoading === 'email' ? 'Sending…' : 'Send Email' }}</button>
        <button v-if="['sent','accepted'].includes(q.status)" @click="convertToInvoice" :disabled="actionLoading === 'convert'" class="btn-primary">{{ actionLoading === 'convert' ? 'Converting…' : 'Convert to Invoice' }}</button>
        <button v-if="q.status === 'draft'" @click="deleteQuotation" :disabled="actionLoading === 'delete'" class="btn-secondary text-red-600 border-red-200 hover:bg-red-50">{{ actionLoading === 'delete' ? 'Deleting…' : 'Delete' }}</button>
      </div>
    </div>

    <!-- Document -->
    <div class="bg-white rounded" style="box-shadow:var(--md-z2)">
      <div class="p-10 font-sans text-[13px] text-gray-800 leading-relaxed">

        <!-- Letterhead -->
        <div class="flex justify-between items-start mb-8">
          <div>
            <div class="text-xl font-bold text-gray-900 uppercase tracking-wide">{{ s.companyName || 'My Company' }}</div>
            <div v-if="s.registrationNo" class="text-gray-500 text-xs mt-0.5">{{ s.registrationNo }}</div>
            <div v-if="s.address" class="text-gray-600 text-xs mt-2 leading-5 whitespace-pre-line">{{ s.address }}</div>
            <div class="mt-1 text-xs space-x-3">
              <span v-if="s.phone" class="text-gray-600">Tel: {{ s.phone }}</span>
              <span v-if="s.email" class="text-blue-600">{{ s.email }}</span>
            </div>
          </div>
          <div class="w-16 h-12 rounded flex items-center justify-center text-white font-bold text-sm" style="background:var(--md-primary-dark)">{{ logoText }}</div>
        </div>

        <!-- Title + Meta -->
        <div class="border-t-2 border-gray-800 pt-5 mb-6 flex justify-between items-start">
          <div class="text-2xl font-bold tracking-widest text-gray-900">QUOTATION</div>
          <div class="text-xs bg-gray-50 border border-gray-200 rounded p-3 space-y-1.5 min-w-52">
            <div class="flex justify-between gap-8"><span class="text-gray-500">Quotation No.</span><span class="font-bold">{{ q.quotationNo }}</span></div>
            <div class="flex justify-between gap-8"><span class="text-gray-500">Date</span><span>{{ fmtDate(q.date) }}</span></div>
            <div v-if="q.validUntil" class="flex justify-between gap-8"><span class="text-gray-500">Valid Until</span><span class="text-amber-700 font-semibold">{{ fmtDate(q.validUntil) }}</span></div>
          </div>
        </div>

        <!-- Addressed to -->
        <div class="mb-6">
          <div class="text-xs text-gray-400 uppercase tracking-widest mb-1">To</div>
          <div class="font-bold text-gray-900">{{ q.client?.companyName }}</div>
          <div v-if="q.client?.contactPerson" class="text-gray-600">Attn: {{ q.client.contactPerson }}</div>
          <div v-if="q.client?.address" class="text-gray-500 text-xs mt-0.5 whitespace-pre-line">{{ q.client.address }}</div>
        </div>

        <div class="mb-5 text-gray-700">Dear Sir / Madam,<br/><br/>We are pleased to submit our quotation for your kind consideration and approval.</div>

        <!-- Items table -->
        <table class="w-full border-collapse mb-6 text-[12.5px]">
          <thead>
            <tr class="bg-gray-900 text-white">
              <th class="px-3 py-2.5 text-center w-10 border border-gray-800">S.No</th>
              <th class="px-3 py-2.5 text-left border border-gray-800">Description</th>
              <th class="px-3 py-2.5 text-center w-40 border border-gray-800">Period</th>
              <th class="px-3 py-2.5 text-right w-32 border border-gray-800">Rate</th>
              <th class="px-3 py-2.5 text-right w-32 border border-gray-800">Amount ({{ cur }})</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in q.items?.slice().sort((a,b)=>a.sno-b.sno)" :key="item.id" class="border-b border-gray-100 even:bg-gray-50">
              <td class="px-3 py-3 text-center text-gray-400 border-x border-gray-200">{{ item.sno }}</td>
              <td class="px-3 py-3 border-x border-gray-200 font-medium text-gray-900">{{ item.jobDescription }}</td>
              <td class="px-3 py-3 text-center border-x border-gray-200 text-xs text-gray-600">{{ calcPeriod(item) }}</td>
              <td class="px-3 py-3 text-right border-x border-gray-200 text-gray-700 text-xs">{{ rateLabel(item) }}</td>
              <td class="px-3 py-3 text-right font-bold text-gray-900 border-x border-gray-200">{{ fmt(item.totalAmount) }}</td>
            </tr>
            <tr class="bg-gray-900 text-white font-bold">
              <td colspan="4" class="px-3 py-3 text-right border border-gray-700 tracking-wide">TOTAL AMOUNT ({{ cur }})</td>
              <td class="px-3 py-3 text-right border border-gray-700">{{ fmt(q.totalAmount) }}</td>
            </tr>
          </tbody>
        </table>

        <div v-if="q.notes" class="mb-6 p-3 bg-amber-50 border-l-4 border-amber-400 text-sm text-gray-700">
          <span class="font-semibold text-amber-800">Note: </span>{{ q.notes }}
        </div>

        <div class="mb-8 text-xs text-gray-600">
          <div class="font-semibold text-gray-800 mb-2 uppercase tracking-wide text-[11px]">Terms & Conditions</div>
          <ol class="list-decimal list-inside space-y-1">
            <li>This quotation is valid for <strong>{{ terms }} days</strong> from the date of issue.</li>
            <li>All prices are in <strong>{{ cur }}</strong> and are subject to applicable taxes.</li>
            <li>Payment terms: Net <strong>{{ terms }} days</strong> from invoice date.</li>
            <li>Please confirm your acceptance by signing and returning a copy of this quotation.</li>
          </ol>
        </div>

        <div class="mb-8 text-gray-700">We look forward to your favourable response. Should you require any clarification, please do not hesitate to contact us.</div>

        <div class="flex justify-between items-end">
          <div class="text-gray-500 text-xs">Yours faithfully,<br/>For and on behalf of</div>
          <div class="text-center min-w-48">
            <div class="border-b border-gray-500 mb-2 w-48 mx-auto"></div>
            <div class="font-bold text-gray-900">{{ s.signatoryName || 'Authorised Signatory' }}</div>
            <div class="text-gray-500 text-xs mt-0.5">{{ s.companyName }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
