import { reactive, readonly, onMounted, onBeforeUnmount } from 'vue';

// Carga resource-data.json (lo publica n8n cada lunes) con el mismo manejo de error y
// refresco que useDashboard: falla de red = error con reintento; JSON vacío = "sin datos".
export function useRadar() {
  const state = reactive({ loaded: false, error: false, refreshing: false, data: null });

  async function load() {
    const first = !state.loaded;
    state.refreshing = true;
    try {
      const r = await fetch('resource-data.json?_=' + Date.now());
      if (!r.ok) throw new Error('HTTP ' + r.status);
      state.data = await r.json();
      state.error = false;
    } catch (e) {
      if (first) state.error = true;
    } finally {
      state.loaded = true;
      state.refreshing = false;
    }
  }

  const REFRESH_MS = 30 * 60 * 1000;
  let timer = null;
  onMounted(() => { load(); timer = setInterval(load, REFRESH_MS); });
  onBeforeUnmount(() => clearInterval(timer));

  return { state: readonly(state), reload: load };
}
