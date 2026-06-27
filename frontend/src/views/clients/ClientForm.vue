<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { clientsApi } from '../../api/index.js';

const route = useRoute();
const router = useRouter();
const isEdit = computed(() => !!route.params.id);
const form = ref({ companyName: '', clientCode: '', contactPerson: '', email: '', phone: '', address: '' });
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
      </div>
      <div class="flex gap-3 mt-7 pt-5 border-t border-gray-100">
        <button @click="submit" :disabled="loading" class="btn-primary">{{ loading ? 'Saving…' : (isEdit ? 'Update Client' : 'Create Client') }}</button>
        <RouterLink to="/clients" class="btn-secondary">Cancel</RouterLink>
      </div>
    </div>
  </div>
</template>
