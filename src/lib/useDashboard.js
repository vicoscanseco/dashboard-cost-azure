import { reactive, computed, readonly } from 'vue';
import { dedupeByDate, applyFreshMonthByResource, resolveMonthToDate, computeMonthForecast } from './calc.js';

// Orquesta el mismo flujo que el render() monolítico de dashboard-template.html, pero
// expuesto como estado reactivo que cada componente de tarjeta consume por su cuenta
// (en vez de que una sola función gigante haga innerHTML de todo). La fuente de datos
// sigue siendo exactamente la misma: data.json + analysis.txt, publicados por n8n vía
// SSH sin ningún cambio en el pipeline existente.
export function useDashboard() {
  const state = reactive({
    loaded: false,
    data: null,
    analysisText: '',
    generatedAt: null
  });

  async function load() {
    const [dataRes, analysisRes] = await Promise.all([
      fetch('data.json?_=' + Date.now()).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch('analysis.txt?_=' + Date.now()).then((r) => (r.ok ? r.text() : '')).catch(() => '')
    ]);
    state.data = dataRes;
    state.analysisText = analysisRes || '';
    state.generatedAt = dataRes ? dataRes.generatedAt : null;
    state.loaded = true;
  }

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
    load,
    monthHistory,
    mtd,
    monthToDateSoFar,
    monthlyFinals,
    forecast
  };
}
