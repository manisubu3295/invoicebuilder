<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { invoicesApi, clientsApi, itemCatalogApi } from '../../api/index.js';
import { useSettingsStore } from '../../stores/settings.js';
import LineItemEditor from '../../components/shared/LineItemEditor.vue';

const route = useRoute();
const router = useRouter();
const settingsStore = useSettingsStore();
const isEdit = computed(() => !!route.params.id);
const currency = computed(() => settingsStore.settings?.currency || 'SGD');
const sym = computed(() => settingsStore.settings?.currencySymbol || 'S$');

const form = ref({
  clientId: '', date: new Date().toISOString().split('T')[0], dueDate: '', notes: '',
  items: [{ sno: 1, itemType: 'service', jobDescription: '', fromDate: '', toDate: '', rate: '', rateType: 'per_week', deliveryDate: '', deliveryDates: [], quantity: 1, unitPrice: '', totalAmount: 0 }],
});
const clients = ref([]);
const catalog = ref([]);
const loading = ref(false);
const error = ref('');
const total = computed(() => form.value.items.reduce((s, i) => s + parseFloat(i.totalAmount || 0), 0));

onMounted(async () => {
  await settingsStore.fetchSettings();
  [clients.value, catalog.value] = await Promise.all([
    clientsApi.list().then(r => r.data),
    itemCatalogApi.list().then(r => r.data).catch(() => []),
  ]);
  if (isEdit.value) {
    const { data } = await invoicesApi.get(route.params.id);
    form.value = {
      clientId: data.clientId, date: data.date, dueDate: data.dueDate || '', notes: data.notes || '',
      items: (data.items || []).map(i => {
        let deliveryDates = [];
        try { deliveryDates = i.deliveryDates ? JSON.parse(i.deliveryDates) : []; } catch {}
        if (!deliveryDates.length && i.deliveryDate) deliveryDates = [i.deliveryDate];
        return { ...i, itemType: i.itemType || 'service', deliveryDate: i.deliveryDate || '', deliveryDates, quantity: i.quantity || 1, unitPrice: i.unitPrice || '' };
      }),
    };
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
    </div>

    <div class="card mb-4">
      <div v-if="error" class="alert-error mb-5">{{ error }}</div>
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
      <LineItemEditor v-model="form.items" :catalog="catalog" />

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
