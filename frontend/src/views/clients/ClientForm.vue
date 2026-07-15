<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { clientsApi, categoriesApi } from '../../api/index.js';

const route = useRoute();
const router = useRouter();
const isEdit = computed(() => !!route.params.id);
const form = ref({ companyName: '', clientCode: '', contactPerson: '', email: '', phone: '', address: '', invoicePrefix: '', invoiceStartNumber: '', quotationPrefix: '', quotationStartNumber: '', requiresRunSheet: false, bulkRunSheet: false, itemMatrix: false, categoryIds: [] });

// The two invoice PDF formats are mutually exclusive — picking one clears the other
function pickBulkRunSheet() { if (form.value.bulkRunSheet) form.value.itemMatrix = false; }
function pickItemMatrix() { if (form.value.itemMatrix) form.value.bulkRunSheet = false; }
const loading = ref(false);
const error = ref('');

const categories = ref([]);
const newCategoryName = ref('');
const newCategoryPrefix = ref('');
const addingCategory = ref(false);

onMounted(async () => {
  categories.value = (await categoriesApi.list()).data;
  if (isEdit.value) {
    const { data } = await clientsApi.get(route.params.id);
    form.value = { ...data, categoryIds: (data.categories || []).map(c => c.id) };
  }
});

function toggleCategory(id) {
  const idx = form.value.categoryIds.indexOf(id);
  if (idx === -1) form.value.categoryIds.push(id);
  else form.value.categoryIds.splice(idx, 1);
}

async function addCategory() {
  if (!newCategoryName.value.trim() || !newCategoryPrefix.value.trim()) return;
  addingCategory.value = true;
  try {
    const { data } = await categoriesApi.create({ name: newCategoryName.value.trim(), invoicePrefix: newCategoryPrefix.value.trim() });
    categories.value.push(data);
    form.value.categoryIds.push(data.id);
    newCategoryName.value = '';
    newCategoryPrefix.value = '';
  } catch (e) { error.value = e.response?.data?.message || 'Failed to add category.'; }
  finally { addingCategory.value = false; }
}

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

        <!-- Categories -->
        <div class="pt-2 border-t border-gray-100">
          <p class="text-sm font-medium text-gray-700 mb-1">Categories</p>
          <p class="text-xs text-gray-400 mb-3">Types of work this client is invoiced for (e.g. Transport, Storage). If only one is selected, drivers and staff won't be asked to pick it — it's applied automatically. With more than one, they'll choose which applies each time.</p>

          <div v-if="categories.length" class="flex flex-wrap gap-2 mb-3">
            <label v-for="c in categories" :key="c.id"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm cursor-pointer transition-colors"
              :class="form.categoryIds.includes(c.id) ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'">
              <input type="checkbox" class="w-3.5 h-3.5 accent-blue-600" :checked="form.categoryIds.includes(c.id)" @change="toggleCategory(c.id)"/>
              {{ c.name }} <span class="text-xs opacity-60">({{ c.invoicePrefix }})</span>
            </label>
          </div>
          <p v-else class="text-xs text-gray-400 italic mb-3">No categories yet — add one below.</p>

          <div class="flex items-end gap-2">
            <div class="input-group flex-1">
              <label class="input-label">New Category</label>
              <input v-model="newCategoryName" class="input-field" placeholder="e.g. Transport"/>
            </div>
            <div class="input-group w-28">
              <label class="input-label">Prefix</label>
              <input v-model="newCategoryPrefix" class="input-field uppercase" maxlength="20" placeholder="TRN"/>
            </div>
            <button type="button" @click="addCategory" :disabled="addingCategory || !newCategoryName.trim() || !newCategoryPrefix.trim()" class="btn-secondary shrink-0">
              {{ addingCategory ? 'Adding…' : '+ Add' }}
            </button>
          </div>
        </div>

        <div class="pt-2 border-t border-gray-100">
          <label class="flex items-center gap-2.5 cursor-pointer">
            <input v-model="form.requiresRunSheet" type="checkbox" class="w-4 h-4 rounded accent-blue-600"/>
            <span class="text-sm text-gray-700">Requires Run Sheet</span>
          </label>
          <p class="text-xs text-gray-400 mt-1 pl-6">When checked, invoices for this client show an optional "Run Sheet No." field on each line item.</p>
          <label v-if="form.requiresRunSheet" class="flex items-center gap-2.5 cursor-pointer mt-3 pl-6">
            <input v-model="form.bulkRunSheet" @change="pickBulkRunSheet" type="checkbox" class="w-4 h-4 rounded accent-blue-600"/>
            <span class="text-sm text-gray-700">Bulk run-sheet invoice format</span>
          </label>
          <p v-if="form.requiresRunSheet" class="text-xs text-gray-400 mt-1 pl-12">Invoice PDF lists No / Date / Run Sheet / Item / Count / Total with a subtotal under each run sheet. Can be overridden per invoice.</p>

          <label v-if="form.requiresRunSheet" class="flex items-center gap-2.5 cursor-pointer mt-3 pl-6">
            <input v-model="form.itemMatrix" @change="pickItemMatrix" type="checkbox" class="w-4 h-4 rounded accent-blue-600"/>
            <span class="text-sm text-gray-700">Item matrix invoice format</span>
          </label>
          <p v-if="form.requiresRunSheet" class="text-xs text-gray-400 mt-1 pl-12">Invoice PDF lists No / Date / Run Sheet, then one column per item (count delivered), then Total — with a period total row. Can be overridden per invoice.</p>
        </div>
      </div>
      <div class="flex gap-3 mt-7 pt-5 border-t border-gray-100">
        <button @click="submit" :disabled="loading" class="btn-primary">{{ loading ? 'Saving…' : (isEdit ? 'Update Client' : 'Create Client') }}</button>
        <RouterLink to="/clients" class="btn-secondary">Cancel</RouterLink>
      </div>
    </div>
  </div>
</template>
