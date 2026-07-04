<script setup>
import { ref, onMounted } from 'vue';
import { settingsApi } from '../../api/index.js';
import { useSettingsStore } from '../../stores/settings.js';
import { useThemeStore } from '../../stores/theme.js';
import { useAuthStore } from '../../stores/auth.js';

const store = useSettingsStore();
const themeStore = useThemeStore();
const authStore = useAuthStore();
const canToggleTestMode = !!authStore.user?.canToggleTestMode;
const saving = ref(false);
const toast = ref(null);
const form = ref({
  companyName: '', registrationNo: '', address: '', phone: '', email: '', website: '',
  bankName: '', bankAccountNo: '', bankAccountName: '',
  currency: 'SGD', currencySymbol: 'S$', paymentTermsDays: 30, signatoryName: '', logoText: '',
  logoImage: null, sealImage: null, signatureImage: null,
  invoicePrefix: 'INV', invoiceStartNumber: 1,
  quotationPrefix: 'QUO', quotationStartNumber: 1,
  testModeEnabled: false,
});

function pickImage(field) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { form.value[field] = ev.target.result; };
    reader.readAsDataURL(file);
  };
  input.click();
}

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
  if (data) {
    Object.keys(form.value).forEach(k => { if (data[k] != null) form.value[k] = data[k]; });
  }
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

        <!-- Logo upload -->
        <div class="flex items-start gap-5 p-4 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700">
          <div class="w-24 h-16 rounded-lg border-2 border-dashed border-gray-300 dark:border-slate-600 flex items-center justify-center bg-white dark:bg-slate-900 overflow-hidden shrink-0">
            <img v-if="form.logoImage" :src="form.logoImage" alt="Logo preview" class="max-w-full max-h-full object-contain p-1"/>
            <span v-else class="material-icons text-gray-300 dark:text-slate-600" style="font-size:28px">image</span>
          </div>
          <div class="flex-1">
            <div class="input-label mb-1">Company Logo</div>
            <p class="text-xs text-gray-400 dark:text-slate-500 mb-2">Appears on all PDF invoices, quotations and reports. PNG or JPG with transparent or white background recommended.</p>
            <div class="flex gap-2">
              <button type="button" @click="pickImage('logoImage')" class="btn-secondary text-xs">{{ form.logoImage ? 'Change Logo' : 'Upload Logo' }}</button>
              <button v-if="form.logoImage" type="button" @click="form.logoImage = null" class="text-xs text-red-500 hover:text-red-700">Remove</button>
            </div>
          </div>
        </div>

        <div class="input-group"><label class="input-label">Company Name *</label><input v-model="form.companyName" class="input-field" placeholder="e.g. AKB Transport Pte Ltd"/></div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div class="input-group"><label class="input-label">Registration / UEN</label><input v-model="form.registrationNo" class="input-field" placeholder="202300001Z"/></div>
          <div class="input-group">
            <label class="input-label">Logo Initials <span class="normal-case font-normal text-gray-400 dark:text-slate-500 text-xs">(3 letters)</span></label>
            <input v-model="form.logoText" class="input-field" maxlength="3" placeholder="AKB"/>
          </div>
        </div>
        <div class="input-group"><label class="input-label">Address</label><textarea v-model="form.address" class="input-field" rows="3"></textarea></div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
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
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div class="input-group"><label class="input-label">Account Number</label><input v-model="form.bankAccountNo" class="input-field" placeholder="123-456789-0"/></div>
          <div class="input-group"><label class="input-label">Account Name</label><input v-model="form.bankAccountName" class="input-field"/></div>
        </div>
        <div class="input-group">
          <label class="input-label">Default Payment Terms (days)</label>
          <input v-model.number="form.paymentTermsDays" type="number" min="1" class="input-field w-28"/>
        </div>
      </div>
    </div>

    <!-- Document Numbering -->
    <div class="card mb-5">
      <h2 class="section-label mb-5 pb-2 border-b border-gray-100 dark:border-slate-700">Document Numbering</h2>
      <p class="text-sm text-gray-500 dark:text-slate-400 mb-5">Configure the prefix and starting number for auto-generated invoice and quotation numbers. Numbers are formatted as <code class="bg-gray-100 dark:bg-slate-700 px-1 rounded text-xs">PREFIX-0001</code>.</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div class="p-4 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 space-y-4">
          <div class="text-sm font-semibold text-gray-700 dark:text-slate-200">Invoices</div>
          <div class="input-group">
            <label class="input-label">Prefix</label>
            <input v-model="form.invoicePrefix" class="input-field" placeholder="INV" maxlength="10"/>
            <p class="text-xs text-gray-400 dark:text-slate-500 mt-1">Preview: <strong>{{ (form.invoicePrefix || 'INV').trim() }}-{{ String(form.invoiceStartNumber || 1).padStart(4,'0') }}</strong></p>
          </div>
          <div class="input-group">
            <label class="input-label">Starting Number</label>
            <input v-model.number="form.invoiceStartNumber" type="number" min="1" class="input-field w-28"/>
          </div>
        </div>
        <div class="p-4 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 space-y-4">
          <div class="text-sm font-semibold text-gray-700 dark:text-slate-200">Quotations</div>
          <div class="input-group">
            <label class="input-label">Prefix</label>
            <input v-model="form.quotationPrefix" class="input-field" placeholder="QUO" maxlength="10"/>
            <p class="text-xs text-gray-400 dark:text-slate-500 mt-1">Preview: <strong>{{ (form.quotationPrefix || 'QUO').trim() }}-{{ String(form.quotationStartNumber || 1).padStart(4,'0') }}</strong></p>
          </div>
          <div class="input-group">
            <label class="input-label">Starting Number</label>
            <input v-model.number="form.quotationStartNumber" type="number" min="1" class="input-field w-28"/>
          </div>
        </div>
      </div>

      <div v-if="canToggleTestMode" class="mt-6 pt-5 border-t border-gray-100 dark:border-slate-700">
        <label class="flex items-start gap-2.5 cursor-pointer">
          <input v-model="form.testModeEnabled" type="checkbox" class="w-4 h-4 mt-0.5 rounded accent-amber-600"/>
          <span>
            <span class="text-sm font-semibold text-gray-700 dark:text-slate-200">Test Mode</span>
            <p class="text-xs text-gray-500 dark:text-slate-400 mt-0.5">While enabled, every new invoice/quotation is a dummy (numbered <code class="bg-gray-100 dark:bg-slate-700 px-1 rounded">TEST-...</code>) and real invoices/quotations are hidden from lists and the dashboard until you turn this back off. Reports always exclude test data.</p>
          </span>
        </label>
      </div>
    </div>

    <!-- Document -->
    <div class="card mb-6">
      <h2 class="section-label mb-5 pb-2 border-b border-gray-100 dark:border-slate-700">Document Settings</h2>
      <div class="space-y-5">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div class="input-group"><label class="input-label">Currency Code</label><input v-model="form.currency" class="input-field" placeholder="SGD" maxlength="5"/></div>
          <div class="input-group"><label class="input-label">Currency Symbol</label><input v-model="form.currencySymbol" class="input-field" placeholder="S$" maxlength="5"/></div>
        </div>
        <div class="input-group"><label class="input-label">Signatory Name</label><input v-model="form.signatoryName" class="input-field" placeholder="Name on PDF signature line"/></div>
      </div>
    </div>

    <!-- Seal & Signature -->
    <div class="card mb-6">
      <h2 class="section-label mb-5 pb-2 border-b border-gray-100 dark:border-slate-700">Seal & Signature</h2>
      <p class="text-sm text-gray-500 dark:text-slate-400 mb-5">These images appear on the signature block of PDF invoices and quotations.</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">

        <!-- Seal -->
        <div>
          <div class="input-label mb-2">Company Seal</div>
          <div v-if="form.sealImage" class="mb-3 flex flex-col items-start gap-2">
            <img :src="form.sealImage" alt="Seal preview" class="max-h-24 max-w-full rounded border border-gray-200 dark:border-slate-600 bg-white p-1"/>
            <button type="button" @click="form.sealImage = null" class="text-xs text-red-500 hover:text-red-700">Remove</button>
          </div>
          <button type="button" @click="pickImage('sealImage')" class="btn-secondary text-sm">
            {{ form.sealImage ? 'Change Image' : 'Upload Seal' }}
          </button>
          <p class="text-xs text-gray-400 dark:text-slate-500 mt-1.5">PNG or JPG, ideally transparent background</p>
        </div>

        <!-- Signature -->
        <div>
          <div class="input-label mb-2">Authorised Signature</div>
          <div v-if="form.signatureImage" class="mb-3 flex flex-col items-start gap-2">
            <img :src="form.signatureImage" alt="Signature preview" class="max-h-24 max-w-full rounded border border-gray-200 dark:border-slate-600 bg-white p-1"/>
            <button type="button" @click="form.signatureImage = null" class="text-xs text-red-500 hover:text-red-700">Remove</button>
          </div>
          <button type="button" @click="pickImage('signatureImage')" class="btn-secondary text-sm">
            {{ form.signatureImage ? 'Change Image' : 'Upload Signature' }}
          </button>
          <p class="text-xs text-gray-400 dark:text-slate-500 mt-1.5">PNG or JPG with white or transparent background</p>
        </div>

      </div>
    </div>

    <div class="flex justify-end">
      <button @click="save" :disabled="saving" class="btn-primary px-8">{{ saving ? 'Saving…' : 'Save Changes' }}</button>
    </div>
  </div>
</template>
