import { createApp } from 'vue';
import { Chart } from 'chart.js/auto';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import App from './App.vue';
import './style.css';

// Chart.js no hereda la fuente del CSS; se fija una vez para todos los gráficos
Chart.defaults.font.family = '"Geist Mono Variable", ui-monospace, monospace';
Chart.defaults.animation.duration = 900;
Chart.defaults.animation.easing = 'easeOutQuart';
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) Chart.defaults.animation = false;

createApp(App).mount('#app');
