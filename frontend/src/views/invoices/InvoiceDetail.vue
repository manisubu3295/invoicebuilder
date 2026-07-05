<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { invoicesApi } from '../../api/index.js';
import { useSettingsStore } from '../../stores/settings.js';
import { useAuthStore } from '../../stores/auth.js';
import StatusBadge from '../../components/shared/StatusBadge.vue';

const route = useRoute();
const router = useRouter();
const settingsStore = useSettingsStore();
const authStore = useAuthStore();
const invoice = ref(null);
const loading = ref(true);
const actionLoading = ref('');
const toast = ref('');
const showPaidModal = ref(false);
const paidForm = ref({ paymentDate: '', method: 'Bank Transfer' });
const editingNo = ref(false);
const editNo = ref('');
const editNoError = ref('');
const editNoSaving = ref(false);

const s = computed(() => settingsStore.settings || {});
const sym = computed(() => s.value.currencySymbol || 'S$');
const logoText = computed(() => (s.value.logoText || s.value.companyName || 'CO').substring(0, 3).toUpperCase());

function fmt(v) { return `${sym.value}${parseFloat(v || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
}
function fmtDateLong(d) {
  if (!d) return '';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase();
}
function calcPeriod(item) {
  if (item.itemType === 'delivery') {
    let dates = [];
    try { dates = item.deliveryDates ? JSON.parse(item.deliveryDates) : []; } catch {}
    if (!dates.length && item.deliveryDate) dates = [item.deliveryDate];
    return dates.map(d => fmtDate(d)).join(', ') || '—';
  }
  if (!item.fromDate || !item.toDate) return '';
  const days = Math.round((new Date(item.toDate) - new Date(item.fromDate)) / 86400000) + 1;
  if (item.rateType === 'per_day') return `${days}d`;
  return `${Math.ceil(days / 7)}wk (${days}d)`;
}
function rateLabel(item) {
  if (item.itemType === 'delivery') {
    const qty = parseFloat(item.quantity || 0), price = parseFloat(item.unitPrice || 0);
    return qty || price ? `${qty.toFixed(3).replace(/\.?0+$/, '')} × ${fmt(price)}` : '';
  }
  return item.rate ? `${fmt(item.rate)} / ${item.rateType === 'per_day' ? 'day' : 'wk'}` : '';
}

function showToast(msg) { toast.value = msg; setTimeout(() => toast.value = '', 3000); }

function startEditNo() {
  editNo.value = invoice.value.invoiceNo;
  editNoError.value = '';
  editingNo.value = true;
}

async function saveInvoiceNo() {
  const newNo = editNo.value.trim();
  if (!newNo) { editNoError.value = 'Invoice number cannot be empty'; return; }
  editNoSaving.value = true;
  editNoError.value = '';
  try {
    await invoicesApi.updateNumber(invoice.value.id, newNo);
    invoice.value = { ...invoice.value, invoiceNo: newNo };
    editingNo.value = false;
    showToast('Invoice number updated');
  } catch (e) {
    editNoError.value = e.response?.data?.message || 'Failed to update invoice number';
  } finally {
    editNoSaving.value = false;
  }
}

function viewPdf() {
  const token = localStorage.getItem('akb_token');
  const base = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  window.open(`${base}/invoices/${invoice.value.id}/pdf?token=${token}`, '_blank');
}

async function sendEmail() {
  if (!confirm(`Send invoice to ${invoice.value.client?.email}?`)) return;
  actionLoading.value = 'email';
  try {
    await invoicesApi.sendEmail(invoice.value.id);
    await reload();
    showToast('Invoice emailed successfully!');
  } catch (e) { showToast('Error: ' + (e.response?.data?.message || 'Email failed')); }
  finally { actionLoading.value = ''; }
}

function openPaidModal() {
  paidForm.value = { paymentDate: new Date().toISOString().split('T')[0], method: 'Bank Transfer' };
  showPaidModal.value = true;
}

async function markSent() {
  actionLoading.value = 'sent';
  try {
    await invoicesApi.markSent(invoice.value.id);
    await reload();
    showToast('Invoice marked as sent!');
  } catch (e) { showToast('Error: ' + (e.response?.data?.message || 'Failed')); }
  finally { actionLoading.value = ''; }
}

async function confirmMarkPaid() {
  if (!paidForm.value.paymentDate) return;
  actionLoading.value = 'paid';
  showPaidModal.value = false;
  try {
    await invoicesApi.markPaid(invoice.value.id, { paymentDate: paidForm.value.paymentDate, method: paidForm.value.method });
    await reload();
    showToast('Invoice marked as paid!');
  } finally { actionLoading.value = ''; }
}

async function cancelInvoice() {
  const msg = invoice.value.status === 'paid'
    ? 'Cancel this PAID invoice? Its payment records stay on file, but the invoice will be marked cancelled.'
    : 'Cancel this invoice? It stays on record but is marked cancelled.';
  if (!confirm(msg)) return;
  actionLoading.value = 'cancel';
  try {
    await invoicesApi.cancel(invoice.value.id);
    await reload();
    showToast('Invoice cancelled');
  } catch (e) { showToast('Error: ' + (e.response?.data?.message || 'Cancel failed')); }
  finally { actionLoading.value = ''; }
}

async function deleteInvoice() {
  const msg = invoice.value.payments?.length
    ? `Permanently delete this invoice AND its ${invoice.value.payments.length} payment record(s)? This destroys payment history and cannot be undone.`
    : 'Permanently delete this invoice? This cannot be undone.';
  if (!confirm(msg)) return;
  actionLoading.value = 'delete';
  try {
    await invoicesApi.remove(invoice.value.id);
    router.push('/invoices');
  } catch (e) { showToast('Error: ' + (e.response?.data?.message || 'Delete failed')); actionLoading.value = ''; }
}

async function reload() { invoice.value = (await invoicesApi.get(route.params.id)).data; }

const hasRunSheet = computed(() => !!invoice.value?.items?.some(i => i.runSheetNo));

const daysUntilDue = computed(() => {
  if (!invoice.value?.dueDate) return null;
  return Math.ceil((new Date(invoice.value.dueDate) - new Date()) / (1000 * 60 * 60 * 24));
});

const outstandingAlert = computed(() => {
  const inv = invoice.value;
  if (!inv || !['sent', 'overdue'].includes(inv.status)) return null;
  const days = daysUntilDue.value;
  const paid = (inv.payments || []).reduce((s, p) => s + parseFloat(p.amount || 0), 0);
  const outstanding = parseFloat(inv.totalAmount || 0) - paid;
  return { outstanding, days };
});

onMounted(async () => {
  await settingsStore.fetchSettings();
  try { await reload(); } finally { loading.value = false; }
});
</script>

<template>
  <div v-if="loading" class="flex items-center justify-center h-64 text-gray-400 text-sm">Loading…</div>
  <div v-else-if="invoice" class="page-container max-w-4xl">

    <Teleport to="body">
      <div v-if="toast" class="fixed top-5 right-5 z-50 px-4 py-2 rounded text-sm text-white bg-green-700" style="box-shadow:var(--md-z4)">{{ toast }}</div>
    </Teleport>

    <!-- Mark Paid modal -->
    <Teleport to="body">
      <div v-if="showPaidModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="showPaidModal = false">
        <div class="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-sm shadow-2xl">
          <h3 class="card-title mb-5">Record Payment</h3>
          <div class="space-y-4">
            <div class="input-group">
              <label class="input-label">Payment Date *</label>
              <input v-model="paidForm.paymentDate" type="date" class="input-field"/>
            </div>
            <div class="input-group">
              <label class="input-label">Payment Method</label>
              <select v-model="paidForm.method" class="input-field">
                <option>Bank Transfer</option>
                <option>PayNow</option>
                <option>Cheque</option>
                <option>Cash</option>
                <option>Other</option>
              </select>
            </div>
          </div>
          <div class="flex gap-3 mt-6">
            <button @click="confirmMarkPaid" :disabled="!paidForm.paymentDate" class="btn-primary flex-1">Confirm Payment</button>
            <button @click="showPaidModal = false" class="btn-secondary">Cancel</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Toolbar -->
    <div class="flex items-center justify-between flex-wrap gap-3 mb-5">
      <div class="flex items-center gap-3 flex-wrap">
        <RouterLink to="/invoices" class="btn-icon text-gray-500"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg></RouterLink>
        <template v-if="!editingNo">
          <h1 class="page-title mb-0">{{ invoice.invoiceNo }}</h1>
          <button v-if="authStore.isAdmin" @click="startEditNo" class="btn-icon text-gray-400 hover:text-blue-600" title="Edit invoice number">
            <span class="material-icons" style="font-size:16px">edit</span>
          </button>
        </template>
        <div v-else class="flex flex-col gap-1">
          <div class="flex items-center gap-2">
            <input v-model="editNo" @keydown.enter="saveInvoiceNo" @keydown.esc="editingNo = false"
              class="input-field w-44 text-sm font-mono" autofocus placeholder="e.g. INV-0042"/>
            <button @click="saveInvoiceNo" :disabled="editNoSaving" class="btn-primary text-xs px-3 py-1.5">{{ editNoSaving ? '…' : 'Save' }}</button>
            <button @click="editingNo = false" class="btn-secondary text-xs px-3 py-1.5">Cancel</button>
          </div>
          <p v-if="editNoError" class="text-xs text-red-600 font-medium">{{ editNoError }}</p>
        </div>
        <StatusBadge v-if="!editingNo" :status="invoice.status" />
      </div>
      <div class="flex gap-2 flex-wrap print:hidden">
        <RouterLink v-if="invoice.status === 'draft'" :to="`/invoices/${invoice.id}/edit`" class="btn-secondary">Edit</RouterLink>
        <button @click="viewPdf" class="btn-secondary">View PDF</button>
        <button v-if="!['paid','cancelled'].includes(invoice.status)" @click="sendEmail" :disabled="actionLoading === 'email'" class="btn-secondary">{{ actionLoading === 'email' ? 'Sending…' : 'Send Email' }}</button>
        <button v-if="invoice.status === 'draft'" @click="markSent" :disabled="actionLoading === 'sent'" class="btn-secondary text-indigo-600 border-indigo-200 hover:bg-indigo-50">{{ actionLoading === 'sent' ? '…' : 'Mark as Sent' }}</button>
        <button v-if="['sent','overdue'].includes(invoice.status)" @click="openPaidModal" :disabled="actionLoading === 'paid'" class="btn-primary">{{ actionLoading === 'paid' ? '…' : 'Mark Paid' }}</button>
        <button v-if="invoice.status !== 'cancelled'" @click="cancelInvoice" :disabled="actionLoading === 'cancel'" class="btn-secondary text-amber-700 border-amber-200 hover:bg-amber-50">{{ actionLoading === 'cancel' ? '…' : 'Cancel Invoice' }}</button>
        <button v-if="authStore.isAdmin && ['draft','cancelled'].includes(invoice.status)" @click="deleteInvoice" :disabled="actionLoading === 'delete'" class="btn-secondary text-red-600 border-red-200 hover:bg-red-50">{{ actionLoading === 'delete' ? 'Deleting…' : 'Delete Permanently' }}</button>
      </div>
    </div>

    <!-- Outstanding alert -->
    <div v-if="outstandingAlert" class="print:hidden mb-4 rounded-xl border p-4 flex items-center justify-between gap-4"
      :class="invoice.status === 'overdue'
        ? 'bg-red-50 border-red-200'
        : outstandingAlert.days !== null && outstandingAlert.days <= 7
          ? 'bg-amber-50 border-amber-200'
          : 'bg-blue-50 border-blue-200'">
      <div class="flex items-center gap-3">
        <span class="material-icons text-2xl"
          :class="invoice.status === 'overdue' ? 'text-red-500' : 'text-amber-500'">
          {{ invoice.status === 'overdue' ? 'warning' : 'pending_actions' }}
        </span>
        <div>
          <div class="text-lg font-bold"
            :class="invoice.status === 'overdue' ? 'text-red-700' : 'text-amber-700'">
            Outstanding: {{ fmt(outstandingAlert.outstanding) }}
          </div>
          <div class="text-sm"
            :class="invoice.status === 'overdue' ? 'text-red-600' : 'text-amber-600'">
            <span v-if="invoice.status === 'overdue'">Overdue since {{ fmtDate(invoice.dueDate) }}</span>
            <span v-else-if="outstandingAlert.days !== null && outstandingAlert.days >= 0">
              Due {{ fmtDate(invoice.dueDate) }} · {{ outstandingAlert.days }} day{{ outstandingAlert.days !== 1 ? 's' : '' }} remaining
            </span>
            <span v-else>Due {{ fmtDate(invoice.dueDate) }}</span>
          </div>
        </div>
      </div>
      <button @click="openPaidModal" class="btn-primary shrink-0">Record Payment</button>
    </div>

    <!-- Document -->
    <div class="bg-white rounded relative overflow-hidden print:overflow-visible mb-4" style="box-shadow:var(--md-z2)">
      <div v-if="invoice.status === 'paid'" class="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div class="text-green-500 text-7xl font-black uppercase tracking-widest opacity-5 rotate-[-30deg] select-none">PAID</div>
      </div>
      <div class="p-10 text-[13px] text-gray-800 leading-relaxed">

        <!-- Letterhead -->
        <div class="flex justify-between items-start pb-5 mb-5 border-b-2 border-slate-800">
          <div class="space-y-0.5">
            <div class="text-base font-bold text-slate-800 uppercase tracking-wide">{{ s.companyName || 'My Company' }}</div>
            <div v-if="s.registrationNo" class="text-gray-500 text-xs">{{ s.registrationNo }}</div>
            <div v-if="s.address" class="text-gray-600 text-xs leading-5 whitespace-pre-line mt-1">{{ s.address }}</div>
            <div v-if="s.email" class="text-blue-600 text-xs">{{ s.email }}</div>
            <div v-if="s.phone" class="text-gray-600 text-xs">{{ s.phone }}</div>
          </div>
          <img v-if="s.logoImage" :src="s.logoImage" alt="Logo" class="max-h-12 max-w-[110px] object-contain"/>
          <div v-else class="w-14 h-10 rounded flex items-center justify-center text-white font-bold text-xs" style="background:var(--md-primary-dark)">{{ logoText }}</div>
        </div>

        <!-- Title + Bill To + Meta -->
        <div class="flex justify-between items-start mb-6">
          <div>
            <div class="text-2xl font-bold tracking-widest text-slate-800 mb-3">INVOICE</div>
            <div class="text-xs text-gray-400 uppercase tracking-widest mb-1">Bill To</div>
            <div class="font-bold text-slate-800">{{ invoice.client?.companyName }}</div>
            <div v-if="invoice.client?.contactPerson" class="text-gray-600 text-xs">{{ invoice.client.contactPerson }}</div>
            <div v-if="invoice.client?.address" class="text-gray-500 text-xs mt-0.5 whitespace-pre-line">{{ invoice.client.address }}</div>
          </div>
          <div class="text-xs bg-gray-50 border border-gray-200 rounded p-3 space-y-1.5 min-w-48">
            <div class="flex justify-between gap-6"><span class="text-gray-500">Invoice No</span><span class="font-semibold">{{ invoice.invoiceNo }}</span></div>
            <div class="flex justify-between gap-6"><span class="text-gray-500">Date</span><span>{{ fmtDate(invoice.date) }}</span></div>
            <div v-if="invoice.dueDate" class="flex justify-between gap-6">
              <span class="text-gray-500">Due Date</span>
              <span :class="invoice.status === 'overdue' ? 'text-red-600 font-bold' : ''">{{ fmtDate(invoice.dueDate) }}</span>
            </div>
            <div v-if="invoice.category" class="flex justify-between gap-6"><span class="text-gray-500">Category</span><span class="font-semibold">{{ invoice.category.name }}</span></div>
          </div>
        </div>

        <!-- Line Items -->
        <table class="w-full border-collapse mb-4 text-[12.5px]">
          <thead>
            <tr class="bg-slate-800 text-white text-xs uppercase tracking-wide">
              <th class="px-3 py-2.5 text-center w-8 border border-slate-700">#</th>
              <th class="px-3 py-2.5 text-left border border-slate-700">Description</th>
              <th v-if="hasRunSheet" class="px-3 py-2.5 text-center w-28 border border-slate-700">Run Sheet</th>
              <th class="px-3 py-2.5 text-center w-32 border border-slate-700">Period</th>
              <th class="px-3 py-2.5 text-right w-28 border border-slate-700">Rate</th>
              <th class="px-3 py-2.5 text-right w-28 border border-slate-700">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!invoice.items?.length"><td colspan="6" class="px-3 py-8 text-center text-gray-400 border border-gray-200">No items</td></tr>
            <tr v-for="item in invoice.items?.slice().sort((a,b)=>a.sno-b.sno)" :key="item.id" class="border-b border-gray-200 hover:bg-gray-50">
              <td class="px-3 py-3 text-center text-gray-400 border border-gray-200">{{ item.sno }}</td>
              <td class="px-3 py-3 border border-gray-200">
                <span class="font-medium text-slate-800">{{ item.jobDescription }}</span>
                <div v-if="item.itemType !== 'delivery' && item.fromDate" class="text-gray-400 text-xs mt-0.5">{{ fmtDate(item.fromDate) }} – {{ fmtDate(item.toDate) }}</div>
              </td>
              <td v-if="hasRunSheet" class="px-3 py-3 text-center text-gray-600 text-xs border border-gray-200">{{ item.runSheetNo || '—' }}</td>
              <td class="px-3 py-3 text-center text-gray-600 text-xs border border-gray-200">{{ calcPeriod(item) }}</td>
              <td class="px-3 py-3 text-right text-xs border border-gray-200">
                <span v-if="rateLabel(item)" class="text-slate-700">{{ rateLabel(item) }}</span>
                <span v-else class="text-gray-300">—</span>
              </td>
              <td class="px-3 py-3 text-right font-bold text-slate-800 border border-gray-200">{{ fmt(item.totalAmount) }}</td>
            </tr>
          </tbody>
        </table>

        <!-- Totals -->
        <div class="flex justify-end mb-6">
          <div class="w-72">
            <div class="flex justify-between py-2 text-sm text-gray-600 border-b border-gray-200">
              <span>Subtotal</span><span>{{ fmt(invoice.totalAmount) }}</span>
            </div>
            <div class="flex justify-between py-3 text-sm font-bold text-slate-800 border-b-2 border-slate-800">
              <span>AMOUNT DUE ({{ s.currency || 'SGD' }})</span><span>{{ fmt(invoice.totalAmount) }}</span>
            </div>
          </div>
        </div>

        <div v-if="invoice.notes" class="mb-6 p-3 bg-amber-50 border-l-4 border-amber-400 text-sm text-gray-700">
          <div class="text-xs font-semibold text-amber-800 mb-1 uppercase tracking-wide">Notes</div>
          <div class="whitespace-pre-line">{{ invoice.notes }}</div>
        </div>

        <!-- Payment Details + Signature -->
        <div class="flex justify-between items-start pt-5 border-t border-gray-200 gap-8">
          <div v-if="s.bankName || s.bankAccountNo" class="text-xs space-y-1">
            <div class="font-semibold text-slate-700 uppercase tracking-wide mb-2">Payment Details</div>
            <div v-if="s.bankAccountName"><span class="text-gray-500">Account Name: </span><span class="font-medium">{{ s.bankAccountName }}</span></div>
            <div v-if="s.bankName"><span class="text-gray-500">Bank: </span><span class="font-medium">{{ s.bankName }}</span></div>
            <div v-if="s.bankAccountNo"><span class="text-gray-500">Account No: </span><span class="font-medium">{{ s.bankAccountNo }}</span></div>
            <div class="text-gray-400 italic mt-2">Payment due within {{ s.paymentTermsDays || 30 }} days.<br/>Please quote invoice number when paying.</div>
          </div>
          <div v-else class="text-xs text-gray-400 italic">Payment due within {{ s.paymentTermsDays || 30 }} days of invoice date.</div>
          <div class="text-center min-w-40">
            <div class="h-10 border-b border-gray-400 mb-2"></div>
            <div class="font-semibold text-sm text-slate-800">{{ s.signatoryName || 'Authorised Signatory' }}</div>
            <div class="text-xs text-gray-500">{{ s.companyName }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Payment History -->
    <div v-if="invoice.payments?.length" class="card p-0">
      <div class="card-header"><span class="card-title">Payment History</span></div>
      <div v-for="p in invoice.payments" :key="p.id" class="flex justify-between text-sm py-3 px-5 border-b border-gray-100 last:border-0">
        <span class="text-gray-600">{{ fmtDateLong(p.paymentDate) }} <span class="text-gray-400">· {{ p.method }}</span></span>
        <span class="font-semibold text-green-700">{{ fmt(p.amount) }}</span>
      </div>
    </div>
  </div>
</template>

<style>
@media print {
  aside, header, nav, [data-topbar] { display: none !important; }
  body, html { background: white !important; margin: 0 !important; }
  .page-container { max-width: 100% !important; padding: 0 !important; margin: 0 !important; }
  .print\:hidden { display: none !important; }
  .print\:overflow-visible { overflow: visible !important; }
}
</style>
