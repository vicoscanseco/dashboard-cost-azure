<script setup>
import { ref, onMounted } from 'vue';

const props = defineProps({ generatedAt: { type: String, default: null } });
const emit = defineEmits(['theme-change']);

const theme = ref(null); // null = sigue prefers-color-scheme

function applyTheme(t) {
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  else document.documentElement.removeAttribute('data-theme');
}

onMounted(() => {
  try {
    const saved = localStorage.getItem('azure-dash-theme');
    if (saved) { theme.value = saved; applyTheme(saved); }
  } catch (e) {}
});

function toggle() {
  const next = theme.value === 'dark' ? 'light' : (theme.value === 'light' ? null : 'dark');
  theme.value = next;
  applyTheme(next);
  try { localStorage.setItem('azure-dash-theme', next || ''); } catch (e) {}
  emit('theme-change', next);
}

const updatedLabel = () => (props.generatedAt ? 'Actualizado ' + new Date(props.generatedAt).toLocaleString('es-MX') : '');
</script>

<template>
  <div class="topbar">
    <div class="topbar-brand">
      <div class="topbar-mark">VC</div>
      <h1>Reporte de costos — Azure</h1>
    </div>
    <div class="topbar-right">
      <span class="updated">{{ updatedLabel() }}</span>
      <button class="theme-toggle" type="button" aria-label="Cambiar tema" title="Cambiar tema" @click="toggle">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
          <circle cx="12" cy="12" r="4.5" />
          <path d="M12 2.5v2.5M12 19v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2.5 12H5M19 12h2.5M4.2 19.8l1.8-1.8M18 6l1.8-1.8" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.topbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: var(--space-4);
  padding-bottom: var(--space-5);
  border-bottom: 1px solid var(--border);
}
.topbar-brand { display: flex; align-items: center; gap: var(--space-3); }
.topbar-mark {
  width: 36px; height: 36px; border-radius: var(--radius-sm); flex-shrink: 0;
  background: linear-gradient(145deg, var(--series-1), color-mix(in srgb, var(--series-1) 60%, #10265f));
  display: flex; align-items: center; justify-content: center;
  font-family: var(--mono); font-weight: 700; font-size: 13px; color: #eef2ff;
}
.topbar h1 { font-size: var(--fs-xl); font-weight: 600; margin: 0; letter-spacing: -0.015em; }
.topbar-right { display: flex; align-items: center; gap: var(--space-3); }
.updated { color: var(--text-muted); font-size: var(--fs-xs); font-family: var(--mono); }
.theme-toggle {
  display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border: 1px solid var(--border);
  background: var(--surface-1); color: var(--text-secondary);
  border-radius: var(--radius-sm); cursor: pointer;
}
.theme-toggle:hover { color: var(--text-primary); border-color: var(--series-1); }
</style>
