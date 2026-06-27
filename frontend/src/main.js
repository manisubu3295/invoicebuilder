import { createApp } from 'vue';
import { createPinia } from 'pinia';
import './style.css';
import App from './App.vue';
import router from './router/index.js';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
app.use(router);

// Apply saved theme before first render
const saved = localStorage.getItem('theme') || 'light';
if (saved === 'dark') document.documentElement.classList.add('dark');

app.mount('#app');
