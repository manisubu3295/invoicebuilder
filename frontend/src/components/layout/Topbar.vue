<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth.js';

const emit = defineEmits(['toggle-sidebar']);

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
  '/expenses':     'Expenses',
  '/guide':        'Help / Guide',
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
  <header class="h-14 flex items-center justify-between px-4 md:px-6 shrink-0 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700/60">
    <div class="flex items-center gap-2">
      <!-- Hamburger — mobile only -->
      <button
        @click="$emit('toggle-sidebar')"
        class="md:hidden -ml-1 w-9 h-9 flex items-center justify-center rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 transition-colors"
        aria-label="Open menu"
      >
        <span class="material-icons" style="font-size:22px">menu</span>
      </button>
      <h1 class="text-sm font-semibold text-gray-900 dark:text-slate-100">{{ pageTitle }}</h1>
    </div>

    <div class="flex items-center gap-3">
      <span class="text-xs text-gray-500 dark:text-slate-400 hidden sm:block">{{ auth.user?.name }}</span>
      <button @click="logout"
        class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-slate-300 rounded-md border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-100 transition-colors">
        <span class="material-icons" style="font-size:14px">logout</span>
        <span class="hidden xs:inline">Sign out</span>
      </button>
    </div>
  </header>
</template>
