<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { Chart } from 'chart.js/auto';
import { cssVar, fmtUSD, fmtUSDShort } from '../lib/format.js';
import { computeMonthForecast } from '../lib/calc.js';

const props = defineProps({
  history: { type: Array, default: () => [] },
  monthlyBudget: { type: Number, default: null },
  monthToDateSoFar: { type: Number, default: null },
  monthlyFinals: { type: Object, default: () => ({}) },
  themeTick: { type: Number, default: 0 }
});

const canvasEl = ref(null);
let chartInst = null;

const fc = computed(() => (props.history.length ? computeMonthForecast(props.history, props.monthToDateSoFar, props.monthlyFinals) : null));
const lastMonths = computed(() => (fc.value ? Object.keys(fc.value.byMonth).sort().slice(-6) : []));

function draw() {
  if (chartInst) { chartInst.destroy(); chartInst = null; }
  if (!fc.value || lastMonths.value.length < 2 || !canvasEl.value) return;

  const { byMonth, currentMonthKey, currentSoFar, forecast } = fc.value;
  const actuals = lastMonths.value.map((m) => (m === currentMonthKey ? currentSoFar : byMonth[m]));
  const projected = lastMonths.value.map((m) => (m === currentMonthKey ? Math.max(0, forecast - currentSoFar) : 0));
  const labels = lastMonths.value.map((m) => new Date(m + '-01T00:00:00').toLocaleDateString('es-MX', { month: 'short', year: '2-digit' }));

  const seriesColor = cssVar('--series-1');
  const seriesWash = cssVar('--series-1-wash');
  const textSecondary = cssVar('--text-secondary');
  const textMuted = cssVar('--text-muted');
  const gridColor = cssVar('--grid');
  const surface = cssVar('--surface-1');
  const textPrimary = cssVar('--text-primary');

  chartInst = new Chart(canvasEl.value, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Real', data: actuals, backgroundColor: seriesColor, borderRadius: 4, maxBarThickness: 34, stack: 's' },
        { label: 'Proyectado', data: projected, backgroundColor: seriesWash, borderRadius: 4, maxBarThickness: 34, stack: 's' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { color: textMuted, font: { size: 11 } } },
        y: { stacked: true, grid: { color: gridColor }, ticks: { color: textMuted, font: { size: 10.5 }, callback: (v) => fmtUSDShort(v) } }
      },
      plugins: {
        legend: { position: 'bottom', labels: { color: textSecondary, boxWidth: 9, boxHeight: 9, font: { size: 11 } } },
        tooltip: {
          backgroundColor: textPrimary, titleColor: surface, bodyColor: surface, padding: 8, cornerRadius: 6,
          callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${fmtUSD(ctx.parsed.y)}` }
        }
      }
    }
  });
}

onMounted(() => nextTick(draw));
onBeforeUnmount(() => { if (chartInst) chartInst.destroy(); });
watch(() => [props.history, props.monthToDateSoFar, props.monthlyFinals], () => nextTick(draw), { deep: true });
watch(() => props.themeTick, () => nextTick(draw));

const overBudget = computed(() => fc.value && props.monthlyBudget && fc.value.forecast > props.monthlyBudget);
const usedPct = computed(() => (fc.value && props.monthlyBudget ? Math.min(100, Math.round((fc.value.currentSoFar / props.monthlyBudget) * 100)) : 0));
const forecastPct = computed(() => (fc.value && props.monthlyBudget ? Math.round((fc.value.forecast / props.monthlyBudget) * 100) : 0));
const fillClass = computed(() => (forecastPct.value > 100 ? 'over' : forecastPct.value >= 80 ? 'warn' : ''));
const budgetNote = computed(() =>
  forecastPct.value > 100
    ? `La proyección de fin de mes supera el presupuesto en ${forecastPct.value - 100}%.`
    : `La proyección de fin de mes usa el ${forecastPct.value}% del presupuesto.`
);
</script>

<template>
  <div class="card card-months">
    <h2>Comparativa mensual</h2>
    <div v-if="!history.length" class="empty"></div>
    <template v-else>
      <div v-if="lastMonths.length < 2" class="empty">Se necesita más de un mes de historial para comparar.</div>
      <div v-else class="chart-wrap"><canvas ref="canvasEl"></canvas></div>

      <div v-if="fc" class="month-summary">
        <div><div class="stat-label">Mes actual (a la fecha)</div><div class="stat-value">{{ fmtUSD(fc.currentSoFar) }}</div></div>
        <div><div class="stat-label">Proyección fin de mes</div><div :class="['stat-value', 'forecast', { 'over-budget': overBudget }]">{{ fmtUSD(fc.forecast) }}</div></div>
        <div v-if="monthlyBudget"><div class="stat-label">Presupuesto mensual</div><div class="stat-value">{{ fmtUSD(monthlyBudget) }}</div></div>
      </div>

      <div v-if="monthlyBudget && fc" class="budget-block">
        <div class="budget-head"><span>Presupuesto usado (a la fecha)</span><span class="budget-pct">{{ usedPct }}%</span></div>
        <div class="budget-track"><div :class="['budget-fill', fillClass]" :style="{ width: usedPct + '%' }"></div></div>
        <div class="budget-note">{{ budgetNote }}</div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.chart-wrap { height: 240px; position: relative; }
.month-summary { display: flex; gap: var(--space-6); margin-top: var(--space-4); flex-wrap: wrap; }
.month-summary .stat-label { font-size: var(--fs-xs); color: var(--text-muted); margin-bottom: 3px; }
.month-summary .stat-value { font-family: var(--mono); font-size: var(--fs-lg); font-weight: 600; font-variant-numeric: tabular-nums; }
.month-summary .stat-value.forecast { color: var(--series-1); }
.month-summary .stat-value.over-budget { color: var(--critical); }
.budget-block { margin-top: var(--space-5); }
.budget-head { display: flex; justify-content: space-between; align-items: baseline; font-size: var(--fs-sm); color: var(--text-secondary); margin-bottom: 6px; }
.budget-head .budget-pct { font-family: var(--mono); font-weight: 650; font-variant-numeric: tabular-nums; }
.budget-track { height: 10px; border-radius: 999px; background: var(--grid); position: relative; overflow: hidden; }
.budget-fill { position: absolute; inset: 0; border-radius: 999px; width: 0%; background: var(--series-1); transition: width .2s; }
.budget-fill.warn { background: var(--warning); }
.budget-fill.over { background: var(--critical); }
.budget-note { font-size: var(--fs-xs); color: var(--text-muted); margin-top: 6px; }
</style>
