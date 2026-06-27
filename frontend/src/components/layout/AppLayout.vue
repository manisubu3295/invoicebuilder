<script setup>
import Sidebar from './Sidebar.vue';
import Topbar from './Topbar.vue';
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
    <div class="print:hidden h-full flex"><Sidebar /></div>
    <div class="flex-1 flex flex-col min-w-0">
      <div class="print:hidden"><Topbar /></div>
      <main class="flex-1 overflow-auto p-6 print:p-0 print:overflow-visible">
        <RouterView />
      </main>
    </div>
  </div>
</template>
