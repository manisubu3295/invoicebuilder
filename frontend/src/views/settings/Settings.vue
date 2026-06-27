<script setup>
import { ref, onMounted } from 'vue';
import { settingsApi } from '../../api/index.js';
import { useSettingsStore } from '../../stores/settings.js';
import { useThemeStore } from '../../stores/theme.js';

const store = useSettingsStore();
const themeStore = useThemeStore();
const saving = ref(false);
const toast = ref(null);
const form = ref({
  companyName: '', registrationNo: '', address: '', phone: '', email: '', website: '',
  bankName: '', bankAccountNo: '', bankAccountName: '',
  currency: 'SGD', currencySymbol: 'S$', paymentTermsDays: 30, signatoryName: '', logoText: '',
});

function showToast(msg, error = false) {
  toast.value = { msg, error };
  setTimeout(() => toast.value = null, 3500);
}

async function save() {
  saving.value = true;
  try {
    await settingsApi.update(form.value);
    store.invalidate();
    await store.fetchSettings();
    showToast('Settings saved successfully.');
  } catch (e) { showToast(e.response?.data?.message || 'Failed to save settings.', true); }
  finally { saving.value = false; }
}

onMounted(async () => {
  const data = await store.fetchSettings();
  if (data) Object.keys(form.value).forEach(k => { if (data[k] != null) form.value[k] = data[k]; });
});
</script>

<template>
  <div class="page-container max-w-2xl">

    <!-- Toast -->
    <Teleport to="body">
      <div v-if="toast" class="fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded text-sm text-white"
           :class="toast.error ? 'bg-red-700' : 'bg-green-700'" style="box-shadow:var(--md-z4)">
        {{ toast.msg }}
      </div>
    </Teleport>

    <div class="page-header">
      <h1 class="page-title">Company Settings</h1>
      <button @click="save" :disabled="saving" class="btn-primary">{{ saving ? 'Saving…' : 'Save Changes' }}</button>
    </div>

    <!-- Appearance -->
    <div class="card mb-5">
      <h2 class="section-label mb-4 pb-2 border-b border-gray-100 dark:border-slate-700">Appearance</h2>
      <p class="text-sm text-gray-500 dark:text-slate-400 mb-4">Choose how the application looks on your device.</p>
      <div class="flex gap-3">
        <!-- Light -->
        <button @click="themeStore.setMode('light')"
          class="flex-1 flex flex-col items-center gap-2.5 p-4 rounded-xl border-2 transition-all"
          :class="themeStore.mode === 'light'
            ? 'border-blue-600 bg-blue-50 dark:bg-blue-600/10'
            : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'">
          <!-- Light mockup -->
          <div class="w-16 h-10 rounded-lg bg-white border border-gray-200 shadow-sm overflow-hidden flex">
            <div class="w-4 bg-gray-100 h-full shrink-0"></div>
            <div class="flex-1 p-1 space-y-1">
              <div class="h-1.5 bg-gray-200 rounded w-full"></div>
              <div class="h-1.5 bg-gray-100 rounded w-4/5"></div>
              <div class="h-1.5 bg-blue-200 rounded w-3/5"></div>
            </div>
          </div>
          <div class="text-center">
            <div class="text-xs font-semibold text-gray-900 dark:text-slate-100">Light</div>
          </div>
          <div v-if="themeStore.mode === 'light'" class="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center">
            <span class="material-icons text-white" style="font-size:11px">check</span>
          </div>
          <div v-else class="w-4 h-4 rounded-full border-2 border-gray-300 dark:border-slate-600"></div>
        </button>

        <!-- Dark -->
        <button @click="themeStore.setMode('dark')"
          class="flex-1 flex flex-col items-center gap-2.5 p-4 rounded-xl border-2 transition-all"
          :class="themeStore.mode === 'dark'
            ? 'border-blue-600 bg-blue-50 dark:bg-blue-600/10'
            : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'">
          <!-- Dark mockup -->
          <div class="w-16 h-10 rounded-lg bg-slate-900 border border-slate-700 shadow-sm overflow-hidden flex">
            <div class="w-4 bg-slate-800 h-full shrink-0"></div>
            <div class="flex-1 p-1 space-y-1">
              <div class="h-1.5 bg-slate-700 rounded w-full"></div>
              <div class="h-1.5 bg-slate-800 rounded w-4/5"></div>
              <div class="h-1.5 bg-blue-600/60 rounded w-3/5"></div>
            </div>
          </div>
          <div class="text-center">
            <div class="text-xs font-semibold text-gray-900 dark:text-slate-100">Dark</div>
          </div>
          <div v-if="themeStore.mode === 'dark'" class="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center">
            <span class="material-icons text-white" style="font-size:11px">check</span>
          </div>
          <div v-else class="w-4 h-4 rounded-full border-2 border-gray-300 dark:border-slate-600"></div>
        </button>
      </div>
    </div>

    <!-- Company Info -->
    <div class="card mb-5">
      <h2 class="section-label mb-5 pb-2 border-b border-gray-100 dark:border-slate-700">Company Information</h2>
      <div class="space-y-5">
        <div class="input-group"><label class="input-label">Company Name *</label><input v-model="form.companyName" class="input-field" placeholder="e.g. AKB Transport Pte Ltd"/></div>
        <div class="grid grid-cols-2 gap-5">
          <div class="input-group"><label class="input-label">Registration / UEN</label><input v-model="form.registrationNo" class="input-field" placeholder="202300001Z"/></div>
          <div class="input-group">
            <label class="input-label">Logo Initials <span class="normal-case font-normal text-gray-400 dark:text-slate-500 text-xs">(3 letters)</span></label>
            <input v-model="form.logoText" class="input-field" maxlength="3" placeholder="AKB"/>
          </div>
        </div>
        <div class="input-group"><label class="input-label">Address</label><textarea v-model="form.address" class="input-field" rows="3"></textarea></div>
        <div class="grid grid-cols-2 gap-5">
          <div class="input-group"><label class="input-label">Phone</label><input v-model="form.phone" class="input-field" placeholder="+65 8888 0000"/></div>
          <div class="input-group"><label class="input-label">Email</label><input v-model="form.email" type="email" class="input-field" placeholder="info@company.com"/></div>
        </div>
        <div class="input-group"><label class="input-label">Website</label><input v-model="form.website" class="input-field" placeholder="www.company.com"/></div>
      </div>
    </div>

    <!-- Bank -->
    <div class="card mb-5">
      <h2 class="section-label mb-5 pb-2 border-b border-gray-100 dark:border-slate-700">Bank & Payment Details</h2>
      <div class="space-y-5">
        <div class="input-group"><label class="input-label">Bank Name</label><input v-model="form.bankName" class="input-field" placeholder="DBS Bank, OCBC…"/></div>
        <div class="grid grid-cols-2 gap-5">
          <div class="input-group"><label class="input-label">Account Number</label><input v-model="form.bankAccountNo" class="input-field" placeholder="123-456789-0"/></div>
          <div class="input-group"><label class="input-label">Account Name</label><input v-model="form.bankAccountName" class="input-field"/></div>
        </div>
        <div class="input-group">
          <label class="input-label">Default Payment Terms (days)</label>
          <input v-model.number="form.paymentTermsDays" type="number" min="1" class="input-field w-28"/>
        </div>
      </div>
    </div>

    <!-- Document -->
    <div class="card mb-6">
      <h2 class="section-label mb-5 pb-2 border-b border-gray-100 dark:border-slate-700">Document Settings</h2>
      <div class="space-y-5">
        <div class="grid grid-cols-2 gap-5">
          <div class="input-group"><label class="input-label">Currency Code</label><input v-model="form.currency" class="input-field" placeholder="SGD" maxlength="5"/></div>
          <div class="input-group"><label class="input-label">Currency Symbol</label><input v-model="form.currencySymbol" class="input-field" placeholder="S$" maxlength="5"/></div>
        </div>
        <div class="input-group"><label class="input-label">Signatory Name</label><input v-model="form.signatoryName" class="input-field" placeholder="Name on PDF signature line"/></div>
      </div>
    </div>

    <div class="flex justify-end">
      <button @click="save" :disabled="saving" class="btn-primary px-8">{{ saving ? 'Saving…' : 'Save Changes' }}</button>
    </div>
  </div>
</template>
