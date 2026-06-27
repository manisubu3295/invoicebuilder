<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth.js';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const titles = {
  '/dashboard':    'Dashboard',
  '/clients':      'Clients',
  '/quotations':   'Quotations',
  '/invoices':     'Invoices',
  '/jobs':         'Jobs',
  '/drivers':      'Drivers',
  '/vehicles':     'Fleet',
  '/reports':      'Reports',
  '/settings':     'Settings',
  '/users':        'User Management',
  '/item-catalog': 'Item Catalog',
  '/delivery-log': 'Delivery Log',
};

const pageTitle = computed(() => {
  for (const [prefix, label] of Object.entries(titles)) {
    if (route.path === prefix || route.path.startsWith(prefix + '/')) return label;
  }
  return '';
});

function logout() {
  auth.logout();
  router.push('/login');
}
</script>

<template>
  <header class="h-14 flex items-center justify-between px-6 shrink-0 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700/60">
    <h1 class="text-sm font-semibold text-gray-900 dark:text-slate-100">{{ pageTitle }}</h1>
    <div class="flex items-center gap-3">
      <span class="text-xs text-gray-500 dark:text-slate-400 hidden sm:block">{{ auth.user?.name }}</span>
      <button @click="logout"
        class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-slate-300 rounded-md border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-100 transition-colors">
        <span class="material-icons" style="font-size:14px">logout</span>
        Sign out
      </button>
    </div>
  </header>
</template>
