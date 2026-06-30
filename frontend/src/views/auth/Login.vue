<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth.js';

const router = useRouter();
const auth = useAuthStore();

const username = ref('');
const password = ref('');
const showPwd = ref(false);
const error = ref('');
const loading = ref(false);

async function submit() {
  error.value = '';
  loading.value = true;
  try {
    await auth.login(username.value, password.value);
    router.push('/dashboard');
  } catch (e) {
    error.value = e.response?.data?.message || 'Invalid username or password.';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen flex">

    <!-- ── Left brand panel ── -->
    <div class="hidden lg:flex flex-col w-[52%] shrink-0 relative overflow-hidden bg-[#0f172a]">

      <!-- gradient orbs -->
      <div class="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-blue-600/20 blur-3xl pointer-events-none"></div>
      <div class="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-indigo-600/20 blur-3xl pointer-events-none"></div>
      <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-sky-500/10 blur-2xl pointer-events-none"></div>

      <!-- content -->
      <div class="relative z-10 flex flex-col h-full px-14 py-12">

        <!-- Logo -->
        <div class="flex items-center gap-3 mb-auto">
          <div class="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center font-bold text-white text-sm tracking-wide shadow-lg">
            AKB
          </div>
          <div>
            <div class="text-white font-semibold text-sm leading-tight">AKB Transport Pte Ltd</div>
            <div class="text-blue-300/70 text-xs">Transport &amp; Logistics</div>
          </div>
        </div>

        <!-- Main headline -->
        <div class="my-auto">
          <!-- Truck SVG illustration -->
          <div class="mb-10">
            <svg viewBox="0 0 420 220" class="w-full max-w-sm opacity-90" fill="none" xmlns="http://www.w3.org/2000/svg">
              <!-- Road -->
              <rect x="0" y="185" width="420" height="6" rx="3" fill="#1e3a5f" opacity="0.6"/>
              <!-- Road dashes -->
              <rect x="30" y="186" width="40" height="3" rx="1.5" fill="#3b82f6" opacity="0.4"/>
              <rect x="110" y="186" width="40" height="3" rx="1.5" fill="#3b82f6" opacity="0.4"/>
              <rect x="190" y="186" width="40" height="3" rx="1.5" fill="#3b82f6" opacity="0.4"/>
              <rect x="270" y="186" width="40" height="3" rx="1.5" fill="#3b82f6" opacity="0.4"/>
              <rect x="350" y="186" width="40" height="3" rx="1.5" fill="#3b82f6" opacity="0.4"/>
              <!-- Truck body (cargo) -->
              <rect x="60" y="110" width="200" height="72" rx="6" fill="#1e40af"/>
              <rect x="62" y="112" width="196" height="68" rx="5" fill="#1d4ed8" opacity="0.6"/>
              <!-- Truck cabin -->
              <rect x="260" y="128" width="90" height="54" rx="6" fill="#2563eb"/>
              <!-- Cabin window -->
              <rect x="274" y="136" width="50" height="28" rx="4" fill="#93c5fd" opacity="0.5"/>
              <!-- Windshield glare -->
              <rect x="278" y="138" width="16" height="8" rx="2" fill="white" opacity="0.2"/>
              <!-- AKB logo on cargo -->
              <rect x="120" y="133" width="64" height="24" rx="4" fill="#1e3a8a"/>
              <text x="152" y="150" text-anchor="middle" fill="#93c5fd" font-size="11" font-weight="bold" font-family="sans-serif">AKB</text>
              <!-- Wheels -->
              <circle cx="110" cy="186" r="18" fill="#0f172a"/>
              <circle cx="110" cy="186" r="11" fill="#1e293b"/>
              <circle cx="110" cy="186" r="5" fill="#3b82f6"/>
              <circle cx="220" cy="186" r="18" fill="#0f172a"/>
              <circle cx="220" cy="186" r="11" fill="#1e293b"/>
              <circle cx="220" cy="186" r="5" fill="#3b82f6"/>
              <circle cx="310" cy="186" r="18" fill="#0f172a"/>
              <circle cx="310" cy="186" r="11" fill="#1e293b"/>
              <circle cx="310" cy="186" r="5" fill="#3b82f6"/>
              <!-- Speed lines -->
              <line x1="20" y1="145" x2="55" y2="145" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" opacity="0.5"/>
              <line x1="8" y1="155" x2="55" y2="155" stroke="#3b82f6" stroke-width="1.5" stroke-linecap="round" opacity="0.35"/>
              <line x1="18" y1="165" x2="55" y2="165" stroke="#3b82f6" stroke-width="1" stroke-linecap="round" opacity="0.25"/>
            </svg>
          </div>

          <h1 class="text-4xl font-bold text-white leading-tight mb-4">
            Move faster.<br/>
            <span class="text-blue-400">Invoice smarter.</span>
          </h1>
          <p class="text-slate-400 text-sm leading-relaxed max-w-xs">
            Complete transport management — quotations, invoices, delivery logs and fleet, all in one place.
          </p>

          <!-- Feature pills -->
          <div class="flex flex-wrap gap-2 mt-8">
            <span v-for="feat in ['Quotations','Invoices','Delivery Log','Fleet','Reports']" :key="feat"
              class="px-3 py-1.5 rounded-full text-xs font-medium bg-white/8 text-blue-200 border border-white/10">
              {{ feat }}
            </span>
          </div>
        </div>

        <!-- Footer -->
        <div class="text-xs text-slate-600 mt-auto">
          © {{ new Date().getFullYear() }} AKB Transport Pte Ltd · Singapore
        </div>
      </div>
    </div>

    <!-- ── Right form panel ── -->
    <div class="flex-1 flex flex-col items-center justify-center bg-slate-50 px-6 py-12">

      <!-- Mobile logo -->
      <div class="lg:hidden flex items-center gap-2.5 mb-10">
        <div class="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white text-xs">AKB</div>
        <span class="text-sm font-semibold text-gray-900">AKB Transport &amp; Logistics</span>
      </div>

      <div class="w-full max-w-[360px]">

        <!-- Heading -->
        <div class="mb-8">
          <h2 class="text-2xl font-bold text-gray-900 mb-1">Sign in</h2>
          <p class="text-sm text-gray-500">Enter your credentials to continue</p>
        </div>

        <!-- Form -->
        <form @submit.prevent="submit" class="space-y-5">

          <!-- Username -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Username</label>
            <div class="relative">
              <span class="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-400">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                </svg>
              </span>
              <input
                v-model="username"
                type="text"
                required
                autocomplete="username"
                placeholder="e.g. admin"
                class="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>
          </div>

          <!-- Password -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
            <div class="relative">
              <span class="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-400">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                </svg>
              </span>
              <input
                v-model="password"
                :type="showPwd ? 'text' : 'password'"
                required
                autocomplete="current-password"
                placeholder="••••••••"
                class="w-full pl-9 pr-10 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
              <button
                type="button"
                @click="showPwd = !showPwd"
                class="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                <svg v-if="!showPwd" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                </svg>
                <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Error -->
          <div v-if="error" class="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
            <svg class="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
            </svg>
            {{ error }}
          </div>

          <!-- Submit -->
          <button
            type="submit"
            :disabled="loading"
            class="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold shadow-sm shadow-blue-200 transition disabled:opacity-60 disabled:cursor-not-allowed mt-1"
          >
            <svg v-if="loading" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            {{ loading ? 'Signing in…' : 'Sign in' }}
          </button>

        </form>

        <!-- Role hint -->
        <div class="mt-8 p-4 rounded-xl bg-blue-50 border border-blue-100">
          <p class="text-xs font-medium text-blue-700 mb-2">Role access</p>
          <div class="space-y-1.5 text-xs text-blue-600/80">
            <div class="flex items-center gap-2">
              <span class="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
              <span><strong>Admin</strong> — full access to all modules</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0"></span>
              <span><strong>Staff</strong> — quotations, invoices &amp; deliveries</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0"></span>
              <span><strong>Driver</strong> — jobs &amp; delivery log only</span>
            </div>
          </div>
        </div>

        <p class="text-center text-xs text-gray-400 mt-6">
          AKB Transport &amp; Logistics · Singapore
        </p>
      </div>
    </div>

  </div>
</template>
