<script setup>
import { ref } from 'vue';
import Sidebar from './Sidebar.vue';
import Topbar from './Topbar.vue';

const sidebarOpen = ref(false);
</script>

<template>
  <div class="flex h-dvh overflow-hidden bg-slate-50 dark:bg-slate-950">

    <!-- Mobile backdrop -->
    <Transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="sidebarOpen"
        class="fixed inset-0 z-20 bg-black/50 md:hidden"
        @click="sidebarOpen = false"
      />
    </Transition>

    <!-- Sidebar -->
    <Sidebar :open="sidebarOpen" @close="sidebarOpen = false" />

    <!-- Main content -->
    <div class="flex-1 flex flex-col min-w-0">
      <div class="print:hidden">
        <Topbar @toggle-sidebar="sidebarOpen = !sidebarOpen" />
      </div>
      <main class="flex-1 overflow-auto p-4 md:p-6 print:p-0 print:overflow-visible">
        <RouterView />
      </main>
    </div>

  </div>
</template>
