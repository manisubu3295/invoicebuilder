import { defineStore } from 'pinia';
import { ref } from 'vue';
import { rateUnitsApi } from '../api/index.js';

// Cached full list (active + inactive) — consumers filter to isActive for
// new-entry dropdowns, or use the full list to label historical items whose
// unit has since been deactivated.
export const useRateUnitsStore = defineStore('rateUnits', () => {
  const rateUnits = ref(null);

  async function fetchRateUnits() {
    if (rateUnits.value) return rateUnits.value;
    try {
      const { data } = await rateUnitsApi.list({ includeInactive: true });
      rateUnits.value = data;
    } catch {
      rateUnits.value = [];
    }
    return rateUnits.value;
  }

  function invalidate() {
    rateUnits.value = null;
  }

  return { rateUnits, fetchRateUnits, invalidate };
});
