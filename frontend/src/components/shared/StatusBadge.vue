<script setup>
defineProps({ status: String });
</script>
<template>
  <span :class="`badge-${status}`">{{ status?.replace(/_/g, ' ') }}</span>
</template>
