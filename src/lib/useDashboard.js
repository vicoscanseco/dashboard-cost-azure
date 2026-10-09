import { reactive, computed, readonly, onMounted, onBeforeUnmount } from 'vue';
import { dedupeByDate, applyFreshMonthByResource, resolveMonthToDate, computeMonthForecast } from './calc.js';

// Orquesta el mismo flujo que el render() monolítico de dashboard-template.html, pero
// expuesto como estado reactivo que cada componente de tarjeta consume por su cuenta
// (en vez de que una sola función gigante haga innerHTML de todo). La fuente de datos
// sigue siendo exactamente la misma: data.json + analysis.txt, publicados por n8n vía
// SSH sin ningún cambio en el pipeline existente.
export function useDashboard() {
  const state = reactive({
    loaded: false,
    error: false,
    refreshing: false,
    data: null,
    analysisText: '',
    generatedAt: null
  });

  // Falla de red o HTTP distinto de 200 en data.json = error (con reintento).
  // JSON válido pero vacío = "sin datos". Una recarga silenciosa que falla conserva lo ya visible.
  async function load() {
    const first = !state.loaded;
    state.refreshing = true;
    try {
      const [dataRes, analysisRes] = await Promise.all([
        fetch('data.json?_=' + Date.now()).then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }),
        fetch('analysis.txt?_=' + Date.now()).then((r) => (r.ok ? r.text() : '')).catch(() => '')
      ]);
      state.data = dataRes;
      state.analysisText = analysisRes || '';
      state.generatedAt = dataRes ? dataRes.generatedAt : null;
      state.error = false;
    } catch (e) {
      if (first) state.error = true;
    } finally {
      state.loaded = true;
      state.refreshing = false;
    }
  }

  // El reporte se publica una vez al día: refresco cada 15 min y al volver a la pestaña
  const REFRESH_MS = 15 * 60 * 1000;
  let timer = null;
  let lastLoad = Date.now();
  const reload = async () => { lastLoad = Date.now(); await load(); };
  const onVisible = () => { if (!document.hidden && Date.now() - lastLoad > REFRESH_MS / 3) reload(); };
  onMounted(() => {
    reload();
    timer = setInterval(reload, REFRESH_MS);
    document.addEventListener('visibilitychange', onVisible);
  });
  onBeforeUnmount(() => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
  });

  // monthHistory: costo real de cada día (sin ventana móvil), con los días del mes en
  // curso sustituidos por el valor fresco recalculado en esta corrida (ver calc.js)
  const monthHistory = computed(() => {
    if (!state.data) return [];
    const base = dedupeByDate((state.data.dailyHistory && state.data.dailyHistory.length) ? state.data.dailyHistory : (state.data.history || []));
    return applyFreshMonthByResource(base, state.data.monthByResource);
  });

  const mtd = computed(() => (state.data ? resolveMonthToDate(state.data, monthHistory.value) : null));
  const monthToDateSoFar = computed(() => (mtd.value ? mtd.value.currentSoFar : null));
  const monthlyFinals = computed(() => (state.data && state.data.monthlyFinals) || {});

  const forecast = computed(() => computeMonthForecast(monthHistory.value, monthToDateSoFar.value, monthlyFinals.value));

  return {
    state: readonly(state),
    reload,
    monthHistory,
    mtd,
    monthToDateSoFar,
    monthlyFinals,
    forecast
  };
}
