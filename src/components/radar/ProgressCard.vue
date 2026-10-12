<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { PhTrophy } from '@phosphor-icons/vue';
import { loadChart } from '../../lib/chart.js';
import { cssVar, fmtUSD, fmtUSDShort, fmtDate } from '../../lib/format.js';
import { trendSeries, CATEGORY_LABEL } from '../../lib/radar.js';

// Ahorro logrado (recursos eliminados o con SKU más bajo desde la corrida anterior) y la
// tendencia semanal de lo que sigue "en juego". Datos: radar_savings y radar_weekly.
const props = defineProps({
  achieved: { type: Object, default: () => ({ monthly: 0, yearToDate: 0, items: [], newThisWeek: 0 }) },
  trend: { type: Array, default: () => [] },
  themeTick: { type: Number, default: 0 }
});

const series = computed(() => trendSeries(props.trend));
const KIND = { eliminado: 'Eliminado', bajo_sku: 'SKU más bajo' };

const canvasEl = ref(null);
let chart = null;
let drawId = 0;
async function draw() {
  const id = ++drawId;
  if (chart) { chart.destroy(); chart = null; }
  const s = series.value;
  if (s.labels.length < 2 || !canvasEl.value) return;
  const stake = cssVar('--warning'), good = cssVar('--good'), muted = cssVar('--text-muted'), grid = cssVar('--grid'), text = cssVar('--text-secondary'), surface = cssVar('--surface-1'), primary = cssVar('--text-primary');
  const Chart = await loadChart();
  if (id !== drawId || !canvasEl.value) return;
  chart = new Chart(canvasEl.value, {
    type: 'line',
    data: {
      labels: s.labels.map((d) => fmtDate(d)),
      datasets: [
        { label: 'En juego', data: s.atStake, borderColor: stake, backgroundColor: stake, borderWidth: 2, pointRadius: 3, pointHoverRadius: 5, tension: 0.25 },
        { label: 'Ahorro logrado', data: s.achieved, borderColor: good, backgroundColor: good, borderWidth: 2, pointRadius: 3, pointHoverRadius: 5, tension: 0.25 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { color: muted, font: { size: 10.5 }, maxTicksLimit: 8 } },
        y: { beginAtZero: true, grid: { color: grid }, border: { display: false }, ticks: { color: muted, font: { size: 10.5 }, callback: (v) => fmtUSDShort(v) } }
      },
      plugins: {
        legend: { position: 'bottom', labels: { color: text, boxWidth: 9, boxHeight: 9, font: { size: 11 } } },
        tooltip: { backgroundColor: primary, titleColor: surface, bodyColor: surface, padding: 8, cornerRadius: 6, callbacks: { label: (c) => ` ${c.dataset.label}: ${fmtUSD(c.parsed.y)}/mes` } }
      }
    }
  });
}
onMounted(() => nextTick(draw));
onBeforeUnmount(() => { drawId++; if (chart) chart.destroy(); });
watch([series, () => props.themeTick], () => nextTick(draw));
</script>

<template>
  <div class="card card-progress">
    <h2><span class="title"><PhTrophy :size="18" weight="duotone" /> Ahorro logrado</span> <span class="sub">lo que ya dejaste de pagar</span></h2>
    <div class="kpis">
      <div><div class="k-label">Ritmo mensual</div><div class="k-value good">{{ fmtUSD(achieved.monthly) }}<small>/mes</small></div></div>
      <div><div class="k-label">Acumulado este año</div><div class="k-value">~{{ fmtUSD(achieved.yearToDate) }}</div></div>
      <div v-if="achieved.newThisWeek"><div class="k-label">Nuevos esta semana</div><div class="k-value">{{ achieved.newThisWeek }}</div></div>
    </div>

    <div v-if="series.labels.length >= 2" class="chart-wrap"><canvas ref="canvasEl" role="img" aria-label="Tendencia semanal: costo en juego y ahorro logrado"></canvas></div>
    <p v-else class="empty">La tendencia aparece desde la segunda corrida semanal.</p>

    <ul v-if="achieved.items && achieved.items.length" class="items">
      <li v-for="(it, i) in achieved.items.slice(0, 6)" :key="i">
        <span class="nm"><strong>{{ it.name }}</strong><small>{{ KIND[it.kind] || it.kind }}<template v-if="it.detail"> · {{ it.detail }}</template> · {{ it.resourceGroup }}</small></span>
        <span class="amt">{{ fmtUSD(it.monthlySaving) }}<small>/mes desde {{ fmtDate(it.date) }}</small></span>
      </li>
    </ul>
    <p v-else class="empty">Cuando elimines o bajes de SKU un recurso marcado por el radar, el ahorro aparecerá aquí la semana siguiente.</p>
  </div>
</template>

<style scoped>
.title { display: inline-flex; align-items: center; gap: var(--space-2); }
.kpis { display: flex; flex-wrap: wrap; gap: var(--space-4) var(--space-6); margin-bottom: var(--space-4); }
.k-label { font-size: var(--fs-xs); color: var(--text-muted); margin-bottom: 2px; }
.k-value { font-family: var(--mono); font-size: var(--fs-xl); font-weight: 500; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.k-value small { font-size: var(--fs-xs); color: var(--text-muted); margin-left: 2px; }
.k-value.good { color: var(--good); }
.chart-wrap { height: 200px; position: relative; }
.items { list-style: none; margin: var(--space-4) 0 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-2); }
.items li { display: flex; justify-content: space-between; gap: var(--space-3); padding: 9px 12px; background: var(--surface-2); border-radius: var(--radius-md); }
.nm { display: flex; flex-direction: column; min-width: 0; }
.nm strong { font-size: var(--fs-sm); font-weight: 550; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nm small { font-size: var(--fs-xs); color: var(--text-muted); }
.amt { display: flex; flex-direction: column; align-items: flex-end; font-family: var(--mono); font-weight: 600; font-size: var(--fs-sm); color: var(--good); white-space: nowrap; }
.amt small { color: var(--text-muted); font-weight: 400; font-size: var(--fs-xs); }
</style>
