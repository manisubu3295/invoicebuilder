<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { invoicesApi, clientsApi, itemCatalogApi, quotationsApi } from '../../api/index.js';
import { useSettingsStore } from '../../stores/settings.js';
import LineItemEditor from '../../components/shared/LineItemEditor.vue';

const route = useRoute();
const router = useRouter();
const settingsStore = useSettingsStore();
const isEdit = computed(() => !!route.params.id);
const currency = computed(() => settingsStore.settings?.currency || 'SGD');
const sym = computed(() => settingsStore.settings?.currencySymbol || 'S$');

const form = ref({
  clientId: '', date: new Date().toISOString().split('T')[0], dueDate: '', notes: '', quotationId: null,
  items: [{ sno: 1, itemType: 'service', jobDescription: '', fromDate: '', toDate: '', rate: '', rateType: 'per_week', deliveryDate: '', deliveryDates: [], quantity: 1, unitPrice: '', totalAmount: 0, runSheetNo: '' }],
});
const clients = ref([]);
const catalog = ref([]);
const quotations = ref([]);
const loadedQuotationNo = ref('');
const loading = ref(false);
const error = ref('');
const nextNumber = ref('');
const total = computed(() => form.value.items.reduce((s, i) => s + parseFloat(i.totalAmount || 0), 0));
const showRunSheet = computed(() => !!clients.value.find(c => c.id === form.value.clientId)?.requiresRunSheet);

async function loadQuotation(quotationId) {
  if (!quotationId) return;
  const { data: q } = await quotationsApi.get(quotationId);
  form.value.quotationId = q.id;
  form.value.clientId = q.clientId;
  form.value.notes = q.notes || '';
  form.value.items = (q.items || []).map((i, idx) => {
    const deliveryDates = i.deliveryDate ? [i.deliveryDate] : [];
    return {
      sno: i.sno || idx + 1, itemType: i.itemType || 'service', jobDescription: i.jobDescription,
      fromDate: i.fromDate || '', toDate: i.toDate || '', rate: i.rate || '', rateType: i.rateType || 'per_week',
      deliveryDate: i.deliveryDate || '', deliveryDates, quantity: i.quantity || 1, unitPrice: i.unitPrice || '',
      totalAmount: i.totalAmount || 0,
    };
  });
  loadedQuotationNo.value = q.quotationNo;
}

function clearQuotation() {
  form.value.quotationId = null;
  loadedQuotationNo.value = '';
}

async function refreshNextNumber() {
  if (isEdit.value) return;
  try { nextNumber.value = (await invoicesApi.getNextNumber(form.value.clientId || undefined)).data.nextNumber; }
  catch { nextNumber.value = ''; }
}
watch(() => form.value.clientId, refreshNextNumber);

onMounted(async () => {
  await settingsStore.fetchSettings();
  [clients.value, catalog.value] = await Promise.all([
    clientsApi.list().then(r => r.data),
    itemCatalogApi.list().then(r => r.data).catch(() => []),
  ]);
  if (isEdit.value) {
    const { data } = await invoicesApi.get(route.params.id);
    form.value = {
      clientId: data.clientId, date: data.date, dueDate: data.dueDate || '', notes: data.notes || '', quotationId: data.quotationId || null,
      items: (data.items || []).map(i => {
        let deliveryDates = [];
        try { deliveryDates = i.deliveryDates ? JSON.parse(i.deliveryDates) : []; } catch {}
        if (!deliveryDates.length && i.deliveryDate) deliveryDates = [i.deliveryDate];
        return { ...i, itemType: i.itemType || 'service', deliveryDate: i.deliveryDate || '', deliveryDates, quantity: i.quantity || 1, unitPrice: i.unitPrice || '' };
      }),
    };
  } else {
    await refreshNextNumber();
    quotationsApi.list().then(r => {
      quotations.value = r.data.filter(q => !['converted', 'rejected'].includes(q.status));
    });
    if (route.query.quotationId) await loadQuotation(route.query.quotationId);
  }
});

async function submit() {
  error.value = '';
  for (const item of form.value.items) {
    if (item.itemType === 'delivery') {
      if (!item.deliveryDates?.length) {
        error.value = 'Please add at least one delivery date for each delivery item.';
        return;
      }
    } else {
      if (!item.fromDate || !item.toDate) {
        error.value = 'Please fill in From Date and To Date for all service items.';
        return;
      }
    }
  }
  loading.value = true;
  try {
    let inv;
    if (isEdit.value) inv = (await invoicesApi.update(route.params.id, form.value)).data;
    else inv = (await invoicesApi.create(form.value)).data;
    router.push(`/invoices/${inv.id}`);
  } catch (e) { error.value = e.response?.data?.message || 'Error saving invoice'; }
  finally { loading.value = false; }
}
</script>

<template>
  <div class="page-container max-w-5xl">
    <div class="flex items-center gap-3 mb-6">
      <RouterLink to="/invoices" class="btn-icon text-gray-500"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg></RouterLink>
      <h1 class="page-title">{{ isEdit ? 'Edit Invoice' : 'New Invoice' }}</h1>
      <span v-if="!isEdit && nextNumber" class="text-sm text-gray-400 dark:text-slate-500">Next No: <strong class="text-gray-600 dark:text-slate-300">{{ nextNumber }}</strong></span>
    </div>

    <div class="card mb-4">
      <div v-if="error" class="alert-error mb-5">{{ error }}</div>

      <div v-if="!isEdit" class="input-group mb-5">
        <label class="input-label">Load from Quotation (optional)</label>
        <div v-if="form.quotationId" class="flex items-center gap-2 text-sm">
          <span class="font-medium">{{ loadedQuotationNo }}</span>
          <button type="button" @click="clearQuotation" class="text-xs text-gray-400 hover:text-red-600">✕ clear</button>
        </div>
        <select v-else @change="loadQuotation($event.target.value)" class="input-field">
          <option value="">None — create from scratch</option>
          <option v-for="q in quotations" :key="q.id" :value="q.id">{{ q.quotationNo }} — {{ q.client?.companyName }}</option>
        </select>
        <p class="text-xs text-gray-400 dark:text-slate-500 mt-1">Pre-fills the client and line items below; you can still edit everything before saving. The quotation will be marked as converted once this invoice is created.</p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
        <div class="input-group">
          <label class="input-label">Client *</label>
          <select v-model="form.clientId" class="input-field">
            <option value="">Select client…</option>
            <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.companyName }}{{ c.clientCode ? ` (${c.clientCode})` : '' }}</option>
          </select>
        </div>
        <div class="input-group"><label class="input-label">Invoice Date *</label><input v-model="form.date" type="date" class="input-field"/></div>
        <div class="input-group"><label class="input-label">Due Date</label><input v-model="form.dueDate" type="date" class="input-field"/></div>
        <div class="input-group sm:col-span-2"><label class="input-label">Notes</label><textarea v-model="form.notes" class="input-field" rows="2" placeholder="Optional notes for the client"></textarea></div>
      </div>

      <div class="section-label mb-3">Line Items</div>
      <LineItemEditor v-model="form.items" :catalog="catalog" :show-run-sheet="showRunSheet" />

      <div class="flex justify-end mt-5 pt-5 border-t border-gray-100">
        <div class="text-right">
          <div class="section-label mb-1">AMOUNT DUE ({{ currency }})</div>
          <div class="text-2xl font-light text-gray-900 tabular-nums">{{ sym }}{{ total.toFixed(2) }}</div>
        </div>
      </div>
    </div>

    <div class="flex gap-3">
      <button @click="submit" :disabled="loading || !form.clientId" class="btn-primary">{{ loading ? 'Saving…' : (isEdit ? 'Update Invoice' : 'Create Invoice') }}</button>
      <RouterLink to="/invoices" class="btn-secondary">Cancel</RouterLink>
    </div>
  </div>
</template>
