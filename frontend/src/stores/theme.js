import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useThemeStore = defineStore('theme', () => {
  const mode = ref(localStorage.getItem('theme') || 'light');

  function apply() {
    if (mode.value === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  function setMode(m) {
    mode.value = m;
    localStorage.setItem('theme', m);
    apply();
  }

  apply();

  return { mode, setMode };
});
