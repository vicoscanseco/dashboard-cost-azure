<script setup>
import { ref, onMounted } from 'vue';
import { PhSun, PhMoon } from '@phosphor-icons/vue';

const props = defineProps({ generatedAt: { type: String, default: null } });
const emit = defineEmits(['theme-change']);

const theme = ref('dark');

onMounted(() => {
  theme.value = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
});

function toggle() {
  const next = theme.value === 'dark' ? 'light' : 'dark';
  theme.value = next;
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('azure-dash-theme', next); } catch (e) {}
  emit('theme-change', next);
}

const updatedLabel = () => (props.generatedAt ? 'Actualizado ' + new Date(props.generatedAt).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : '');
</script>

<template>
  <header class="topbar">
    <div class="topbar-brand">
      <div class="topbar-mark">VC</div>
      <h1>Costos Azure</h1>
    </div>
    <div class="topbar-right">
      <span class="updated">{{ updatedLabel() }}</span>
      <button class="theme-toggle" type="button" :aria-label="theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'" @click="toggle">
        <PhSun v-if="theme === 'dark'" :size="18" weight="bold" />
        <PhMoon v-else :size="18" weight="bold" />
      </button>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  position: sticky; top: var(--space-3); z-index: 10;
  display: flex; justify-content: space-between; align-items: center;
  gap: var(--space-4);
  height: 64px; padding: 0 var(--space-4) 0 var(--space-4);
  background: color-mix(in srgb, var(--surface-1) 72%, transparent);
  -webkit-backdrop-filter: blur(18px) saturate(160%);
  backdrop-filter: blur(18px) saturate(160%);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
}
@media (prefers-reduced-transparency: reduce) {
  .topbar { background: var(--surface-1); -webkit-backdrop-filter: none; backdrop-filter: none; }
}
.topbar-brand { display: flex; align-items: center; gap: var(--space-3); min-width: 0; }
.topbar-mark {
  width: 36px; height: 36px; border-radius: var(--radius-md); flex-shrink: 0;
  background: var(--series-1); color: var(--on-series);
  display: flex; align-items: center; justify-content: center;
  font-family: var(--mono); font-weight: 600; font-size: 13px; letter-spacing: -0.02em;
}
.topbar h1 { font-size: var(--fs-lg); font-weight: 600; margin: 0; letter-spacing: -0.02em; white-space: nowrap; }
.topbar-right { display: flex; align-items: center; gap: var(--space-3); }
.updated { color: var(--text-muted); font-size: var(--fs-xs); font-family: var(--mono); }
@media (max-width: 640px) { .updated { display: none; } }
.theme-toggle {
  display: inline-flex; align-items: center; justify-content: center;
  width: 38px; height: 38px; border: 1px solid var(--border);
  background: var(--surface-2); color: var(--text-secondary);
  border-radius: var(--radius-md); cursor: pointer;
  transition: color .2s var(--ease), border-color .2s var(--ease), transform .2s var(--ease);
}
.theme-toggle:hover { color: var(--text-primary); border-color: var(--series-1); }
.theme-toggle:active { transform: scale(0.96); }
</style>
