import { defineStore } from 'pinia';
import { ref } from 'vue';
import { settingsApi } from '../api/index.js';

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref(null);

  async function fetchSettings() {
    if (settings.value) return settings.value;
    try {
      const { data } = await settingsApi.get();
      settings.value = data;
    } catch {
      settings.value = { companyName: 'My Company', currencySymbol: 'S$', currency: 'SGD' };
    }
    return settings.value;
  }

  function invalidate() {
    settings.value = null;
  }

  return { settings, fetchSettings, invalidate };
});
