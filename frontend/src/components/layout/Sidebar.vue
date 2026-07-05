<script setup>
import { computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../../stores/auth.js';
import { useSettingsStore } from '../../stores/settings.js';

defineProps({ open: Boolean });
const emit = defineEmits(['close']);

const auth = useAuthStore();
const settingsStore = useSettingsStore();
const route = useRoute();

onMounted(() => settingsStore.fetchSettings());

const logoText = computed(() => {
  const text = settingsStore.settings?.logoText || settingsStore.settings?.companyName || 'AKB';
  return text.substring(0, 3).toUpperCase();
});
const companyName = computed(() => settingsStore.settings?.companyName || 'AKB Transport');

const navItems = computed(() => {
  if (auth.isDriver) {
    return [
      { path: '/dashboard',    label: 'Dashboard',    icon: 'dashboard' },
      { path: '/jobs',         label: 'My Jobs',       icon: 'local_shipping' },
      { path: '/delivery-log', label: 'Delivery Log',  icon: 'inventory_2' },
      { path: '/expenses',     label: 'Expenses',      icon: 'payments' },
    ];
  }
  return [
    { path: '/dashboard',    label: 'Dashboard',    icon: 'dashboard' },
    { path: '/quotations',   label: 'Quotations',   icon: 'description' },
    { path: '/invoices',     label: 'Invoices',     icon: 'receipt_long' },
    { path: '/clients',      label: 'Clients',      icon: 'business' },
    { path: '/jobs',         label: 'Jobs',         icon: 'local_shipping' },
    { path: '/delivery-log', label: 'Delivery Log', icon: 'inventory_2' },
    { path: '/expenses',     label: 'Expenses',     icon: 'payments' },
    { path: '/drivers',      label: 'Drivers',      icon: 'badge' },
    { path: '/drivers/map',  label: 'Driver Map',   icon: 'map' },
    { path: '/vehicles',     label: 'Fleet',        icon: 'directions_car' },
    { path: '/reports',      label: 'Reports',      icon: 'bar_chart' },
    ...(auth.user?.role === 'admin' ? [
      { path: '/users',        label: 'Users',        icon: 'group' },
      { path: '/item-catalog', label: 'Item Catalog',  icon: 'category' },
      { path: '/settings',     label: 'Settings',     icon: 'settings' },
    ] : []),
    { path: '/guide', label: 'Help / Guide', icon: 'help_outline', divider: true },
  ];
});

function isActive(path) {
  if (path === '/dashboard') return route.path === '/dashboard';
  if (path === '/drivers') return route.path === '/drivers';
  return route.path.startsWith(path);
}

function onNavClick() {
  // Close drawer on mobile after navigating
  if (window.innerWidth < 768) emit('close');
}
</script>

<template>
  <aside
    :class="[
      'flex flex-col shrink-0 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-700/60',
      // Mobile: fixed overlay drawer
      'fixed inset-y-0 left-0 z-30 w-64 transition-transform duration-300 ease-in-out',
      // Desktop: static sidebar
      'md:static md:inset-auto md:z-auto md:w-56 md:translate-x-0',
      // Mobile open/closed state
      open ? 'translate-x-0 shadow-2xl' : '-translate-x-full',
    ]"
  >

    <!-- Logo + close button row -->
    <div class="h-14 px-4 flex items-center gap-3 border-b border-gray-100 dark:border-slate-700/60 shrink-0">
      <div class="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-[11px] shrink-0 tracking-wide">
        {{ logoText }}
      </div>
      <div class="min-w-0 flex-1">
        <div class="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate leading-tight">{{ companyName }}</div>
        <div class="text-[11px] text-gray-400 dark:text-slate-500 leading-tight">Transport & Logistics</div>
      </div>
      <!-- Close button — mobile only -->
      <button
        @click="$emit('close')"
        class="md:hidden -mr-1 w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        aria-label="Close menu"
      >
        <span class="material-icons" style="font-size:20px">close</span>
      </button>
    </div>

    <!-- Nav -->
    <nav class="flex-1 py-3 px-2 overflow-y-auto space-y-0.5">
      <template v-for="item in navItems" :key="item.path">
        <div v-if="item.divider" class="my-2 border-t border-gray-100 dark:border-slate-700/60"></div>
        <RouterLink
          :to="item.path"
          @click="onNavClick"
          class="flex items-center gap-2.5 px-3 py-2.5 md:py-2 rounded-lg text-sm transition-colors"
          :class="isActive(item.path)
            ? 'bg-blue-50 dark:bg-blue-600/20 text-blue-700 dark:text-blue-400 font-medium'
            : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-100'"
        >
          <span class="material-icons shrink-0 select-none" style="font-size:18px">{{ item.icon }}</span>
          <span class="truncate">{{ item.label }}</span>
        </RouterLink>
      </template>
    </nav>

    <!-- User chip -->
    <div class="px-4 py-3.5 border-t border-gray-100 dark:border-slate-700/60 shrink-0">
      <div class="flex items-center gap-2.5">
        <div class="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-600/30 flex items-center justify-center text-[11px] font-semibold text-blue-700 dark:text-blue-400 shrink-0 uppercase">
          {{ auth.user?.name?.charAt(0) }}
        </div>
        <div class="min-w-0 flex-1">
          <div class="text-xs font-medium text-gray-900 dark:text-slate-200 truncate">{{ auth.user?.name }}</div>
          <div class="text-[11px] text-gray-400 dark:text-slate-500 capitalize">{{ auth.user?.role }}</div>
        </div>
      </div>
    </div>

  </aside>
</template>
