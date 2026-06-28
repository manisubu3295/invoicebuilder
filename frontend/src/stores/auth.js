import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authApi } from '../api/index.js';

const INACTIVITY_MS = 30 * 60 * 1000; // 30 minutes

function tokenExpiry(token) {
  try {
    return JSON.parse(atob(token.split('.')[1])).exp * 1000;
  } catch {
    return 0;
  }
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref(JSON.parse(localStorage.getItem('akb_user') || 'null'));
  const token = ref(localStorage.getItem('akb_token'));
  let inactivityTimer = null;

  function isExpired() {
    if (!token.value) return true;
    return tokenExpiry(token.value) < Date.now();
  }

  const isLoggedIn = computed(() => !!token.value && !isExpired());
  const isAdmin = computed(() => user.value?.role === 'admin');
  const isDriver = computed(() => user.value?.role === 'driver');

  function logout() {
    clearTimeout(inactivityTimer);
    token.value = null;
    user.value = null;
    localStorage.removeItem('akb_token');
    localStorage.removeItem('akb_user');
  }

  function resetInactivityTimer(onExpire) {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(onExpire, INACTIVITY_MS);
  }

  async function login(email, password) {
    const { data } = await authApi.login({ email, password });
    token.value = data.token;
    user.value = data.user;
    localStorage.setItem('akb_token', data.token);
    localStorage.setItem('akb_user', JSON.stringify(data.user));
  }

  return { user, token, isLoggedIn, isAdmin, isDriver, login, logout, isExpired, resetInactivityTimer };
});
