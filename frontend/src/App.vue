<template>
  <RouterView />
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from './stores/auth.js';

const router = useRouter();
const auth = useAuthStore();

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];

function handleActivity() {
  if (!auth.isLoggedIn) return;
  auth.resetInactivityTimer(() => {
    auth.logout();
    router.push('/login');
  });
}

onMounted(() => {
  // Auto-logout if token already expired from a previous session
  if (auth.isExpired()) {
    auth.logout();
    router.push('/login');
    return;
  }
  ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, handleActivity, { passive: true }));
  handleActivity(); // start the inactivity timer immediately
});

onUnmounted(() => {
  ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, handleActivity));
});
</script>
