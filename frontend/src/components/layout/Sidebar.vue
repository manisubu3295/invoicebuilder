<script setup>
import { computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../../stores/auth.js';
import { useSettingsStore } from '../../stores/settings.js';

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
    ];
  }
  return [
    { path: '/dashboard',    label: 'Dashboard',    icon: 'dashboard' },
    { path: '/quotations',   label: 'Quotations',   icon: 'description' },
    { path: '/invoices',     label: 'Invoices',     icon: 'receipt_long' },
    { path: '/clients',      label: 'Clients',      icon: 'business' },
    { path: '/jobs',         label: 'Jobs',         icon: 'local_shipping' },
    { path: '/delivery-log', label: 'Delivery Log', icon: 'inventory_2' },
    { path: '/drivers',      label: 'Drivers',      icon: 'badge' },
    { path: '/vehicles',     label: 'Fleet',        icon: 'directions_car' },
    { path: '/reports',      label: 'Reports',      icon: 'bar_chart' },
    ...(auth.user?.role === 'admin' ? [
      { path: '/users',        label: 'Users',        icon: 'group' },
      { path: '/item-catalog', label: 'Item Catalog',  icon: 'category' },
      { path: '/settings',     label: 'Settings',     icon: 'settings' },
    ] : []),
  ];
});

function isActive(path) {
  if (path === '/dashboard') return route.path === '/dashboard';
  return route.path.startsWith(path);
}
</script>

<template>
  <aside class="w-56 flex flex-col shrink-0 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-700/60">

    <!-- Logo -->
    <div class="h-14 px-4 flex items-center gap-3 border-b border-gray-100 dark:border-slate-700/60">
      <div class="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-[11px] shrink-0 tracking-wide">
        {{ logoText }}
      </div>
      <div class="min-w-0">
        <div class="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate leading-tight">{{ companyName }}</div>
        <div class="text-[11px] text-gray-400 dark:text-slate-500 leading-tight">Transport & Logistics</div>
      </div>
    </div>

    <!-- Nav -->
    <nav class="flex-1 py-3 px-2 overflow-y-auto space-y-0.5">
      <RouterLink
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors"
        :class="isActive(item.path)
          ? 'bg-blue-50 dark:bg-blue-600/20 text-blue-700 dark:text-blue-400 font-medium'
          : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-100'"
      >
        <span class="material-icons shrink-0 select-none" style="font-size:18px">{{ item.icon }}</span>
        <span class="truncate">{{ item.label }}</span>
      </RouterLink>
    </nav>

    <!-- User chip -->
    <div class="px-4 py-3.5 border-t border-gray-100 dark:border-slate-700/60">
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
