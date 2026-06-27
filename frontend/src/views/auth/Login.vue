<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth.js';

const router = useRouter();
const auth = useAuthStore();

const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function submit() {
  error.value = '';
  loading.value = true;
  try {
    await auth.login(email.value, password.value);
    router.push('/dashboard');
  } catch (e) {
    error.value = e.response?.data?.message || 'Invalid email or password.';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen flex bg-slate-50 dark:bg-slate-950">

    <!-- Left brand panel -->
    <div class="hidden lg:flex flex-col justify-between w-80 shrink-0 bg-blue-600 p-10">
      <div>
        <div class="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-bold text-white text-sm mb-10">
          AKB
        </div>
        <h2 class="text-3xl font-semibold text-white leading-snug mb-4">
          Transport &<br/>Logistics
        </h2>
        <p class="text-sm text-blue-100 leading-relaxed">
          Manage quotations, invoices, delivery logs and fleet operations from one place.
        </p>
      </div>
      <div class="space-y-1.5">
        <div class="flex items-center gap-2 text-xs text-blue-200">
          <span class="material-icons" style="font-size:14px">check_circle</span>
          Quotations & Invoices
        </div>
        <div class="flex items-center gap-2 text-xs text-blue-200">
          <span class="material-icons" style="font-size:14px">check_circle</span>
          Delivery Log & Fleet
        </div>
        <div class="flex items-center gap-2 text-xs text-blue-200">
          <span class="material-icons" style="font-size:14px">check_circle</span>
          Reports & PDF Export
        </div>
      </div>
    </div>

    <!-- Right login panel -->
    <div class="flex-1 flex items-center justify-center p-6">
      <div class="w-full max-w-sm">

        <!-- Mobile logo -->
        <div class="lg:hidden flex items-center gap-2.5 mb-8">
          <div class="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-xs">AKB</div>
          <span class="text-sm font-semibold text-gray-900 dark:text-slate-100">AKB Transport & Logistics</span>
        </div>

        <div class="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-8" style="box-shadow:var(--shadow-lg)">
          <h1 class="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-1">Welcome back</h1>
          <p class="text-sm text-gray-500 dark:text-slate-400 mb-7">Sign in to your account</p>

          <form @submit.prevent="submit" class="space-y-4">
            <div class="input-group">
              <label class="input-label">Email address</label>
              <input v-model="email" type="email" required class="input-field" placeholder="you@akbtransport.com" autocomplete="email"/>
            </div>
            <div class="input-group">
              <label class="input-label">Password</label>
              <input v-model="password" type="password" required class="input-field" placeholder="••••••••" autocomplete="current-password"/>
            </div>

            <div v-if="error" class="alert-error">{{ error }}</div>

            <button type="submit" :disabled="loading" class="btn-primary w-full py-2.5 mt-1">
              {{ loading ? 'Signing in…' : 'Sign in' }}
            </button>
          </form>
        </div>

        <p class="text-center text-xs text-gray-400 dark:text-slate-500 mt-6">AKB Transport & Logistics · Singapore</p>
      </div>
    </div>

  </div>
</template>
