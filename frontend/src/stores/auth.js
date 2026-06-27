import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authApi } from '../api/index.js';

export const useAuthStore = defineStore('auth', () => {
  const user = ref(JSON.parse(localStorage.getItem('akb_user') || 'null'));
  const token = ref(localStorage.getItem('akb_token'));

  const isLoggedIn = computed(() => !!token.value);
  const isAdmin = computed(() => user.value?.role === 'admin');
  const isDriver = computed(() => user.value?.role === 'driver');

  async function login(email, password) {
    const { data } = await authApi.login({ email, password });
    token.value = data.token;
    user.value = data.user;
    localStorage.setItem('akb_token', data.token);
    localStorage.setItem('akb_user', JSON.stringify(data.user));
  }

  function logout() {
    token.value = null;
    user.value = null;
    localStorage.removeItem('akb_token');
    localStorage.removeItem('akb_user');
  }

  return { user, token, isLoggedIn, isAdmin, isDriver, login, logout };
});
