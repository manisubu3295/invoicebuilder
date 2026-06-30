<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { clientsApi } from '../../api/index.js';

const route = useRoute();
const router = useRouter();
const isEdit = computed(() => !!route.params.id);
const form = ref({ companyName: '', clientCode: '', contactPerson: '', email: '', phone: '', address: '', invoicePrefix: '', invoiceStartNumber: '', quotationPrefix: '', quotationStartNumber: '' });
const loading = ref(false);
const error = ref('');

onMounted(async () => {
  if (isEdit.value) form.value = { ...(await clientsApi.get(route.params.id)).data };
});

function autoCode() {
  if (!isEdit.value && form.value.companyName && !form.value.clientCode)
    form.value.clientCode = form.value.companyName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 5);
}

async function submit() {
  loading.value = true; error.value = '';
  try {
    if (isEdit.value) await clientsApi.update(route.params.id, form.value);
    else await clientsApi.create(form.value);
    router.push('/clients');
  } catch (e) { error.value = e.response?.data?.message || 'Error saving client.'; }
  finally { loading.value = false; }
}
</script>

<template>
  <div class="max-w-xl page-container">
    <div class="flex items-center gap-3 mb-6">
      <RouterLink to="/clients" class="btn-icon text-gray-500"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg></RouterLink>
      <h1 class="page-title">{{ isEdit ? 'Edit Client' : 'New Client' }}</h1>
    </div>

    <div class="card">
      <div v-if="error" class="alert-error mb-5">{{ error }}</div>
      <div class="space-y-5">
        <div class="input-group"><label class="input-label">Company Name *</label><input v-model="form.companyName" @blur="autoCode" class="input-field"/></div>
        <div class="input-group">
          <label class="input-label">Client Code * <span class="normal-case font-normal text-gray-400 text-xs">(used in invoice numbers e.g. SMM)</span></label>
          <input v-model="form.clientCode" class="input-field uppercase" maxlength="10"/>
        </div>
        <div class="input-group"><label class="input-label">Contact Person</label><input v-model="form.contactPerson" class="input-field"/></div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div class="input-group"><label class="input-label">Email</label><input v-model="form.email" type="email" class="input-field"/></div>
          <div class="input-group"><label class="input-label">Phone</label><input v-model="form.phone" class="input-field"/></div>
        </div>
        <div class="input-group"><label class="input-label">Address</label><textarea v-model="form.address" class="input-field" rows="2"></textarea></div>

        <!-- Client-specific document numbering -->
        <div class="pt-2">
          <p class="text-sm font-medium text-gray-700 mb-1">Document Numbering <span class="font-normal text-gray-400 text-xs">(optional — overrides global settings)</span></p>
          <p class="text-xs text-gray-400 mb-4">Leave blank to use the global prefix from Settings.</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div class="input-group">
              <label class="input-label">Invoice Prefix</label>
              <input v-model="form.invoicePrefix" class="input-field uppercase" maxlength="20" placeholder="e.g. SMM-INV"/>
            </div>
            <div class="input-group">
              <label class="input-label">Invoice Start No.</label>
              <input v-model="form.invoiceStartNumber" type="number" min="1" class="input-field" placeholder="1"/>
            </div>
            <div class="input-group">
              <label class="input-label">Quotation Prefix</label>
              <input v-model="form.quotationPrefix" class="input-field uppercase" maxlength="20" placeholder="e.g. SMM-QUO"/>
            </div>
            <div class="input-group">
              <label class="input-label">Quotation Start No.</label>
              <input v-model="form.quotationStartNumber" type="number" min="1" class="input-field" placeholder="1"/>
            </div>
          </div>
          <div v-if="form.invoicePrefix || form.quotationPrefix" class="mt-3 p-3 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-700 space-y-1">
            <div v-if="form.invoicePrefix">Invoice numbers will use: <strong>{{ form.invoicePrefix.toUpperCase() }}-{{ String(form.invoiceStartNumber || 1).padStart(4, '0') }}</strong>, <strong>{{ form.invoicePrefix.toUpperCase() }}-{{ String((form.invoiceStartNumber || 1) + 1).padStart(4, '0') }}</strong>…</div>
            <div v-if="form.quotationPrefix">Quotation numbers will use: <strong>{{ form.quotationPrefix.toUpperCase() }}-{{ String(form.quotationStartNumber || 1).padStart(4, '0') }}</strong>, <strong>{{ form.quotationPrefix.toUpperCase() }}-{{ String((form.quotationStartNumber || 1) + 1).padStart(4, '0') }}</strong>…</div>
          </div>
        </div>
      </div>
      <div class="flex gap-3 mt-7 pt-5 border-t border-gray-100">
        <button @click="submit" :disabled="loading" class="btn-primary">{{ loading ? 'Saving…' : (isEdit ? 'Update Client' : 'Create Client') }}</button>
        <RouterLink to="/clients" class="btn-secondary">Cancel</RouterLink>
      </div>
    </div>
  </div>
</template>
