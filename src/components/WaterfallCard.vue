<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { loadChart } from '../lib/chart.js';
import { cssVar, fmtUSD, fmtUSDShort, capitalize } from '../lib/format.js';
import { DIMENSIONS, listMonths, buildWaterfall, monthLabel } from '../lib/history.js';

const props = defineProps({
  rows: { type: Array, default: () => [] },
  currentMonth: { type: String, default: null },
  themeTick: { type: Number, default: 0 }
});

const months = computed(() => listMonths(props.rows));
const closed = computed(() => months.value.filter((m) => m !== props.currentMonth));
const monthA = ref(null);
const monthB = ref(null);
const dim = ref('project');

// Por defecto: los dos últimos meses cerrados (el mes en curso está incompleto)
function resetDefaults() {
  const c = closed.value;
  monthB.value = c[c.length - 1] || months.value[months.value.length - 1] || null;
  monthA.value = c[c.length - 2] || months.value[0] || null;
}
watch(() => months.value.join(','), resetDefaults, { immediate: true });

const wf = computed(() => (monthA.value && monthB.value && monthA.value !== monthB.value
  ? buildWaterfall(props.rows, monthA.value, monthB.value, dim.value, 8) : null));
const optLabel = (m) => capitalize(monthLabel(m)) + (m === props.currentMonth ? ' (en curso)' : '');
const short = (m) => capitalize(monthLabel(m, { month: 'short', year: '2-digit' }));
const signed = (n) => (n >= 0 ? '+' : '−') + fmtUSD(Math.abs(n));
const partial = computed(() => monthA.value === props.currentMonth || monthB.value === props.currentMonth);

const canvasEl = ref(null);
let chartInst = null;
let drawId = 0;
async function draw() {
  const id = ++drawId;
  if (chartInst) { chartInst.destroy(); chartInst = null; }
  const w = wf.value;
  if (!w || !canvasEl.value) return;

  const series = cssVar('--series-1'), up = cssVar('--critical'), down = cssVar('--good');
  const muted = cssVar('--text-muted'), text = cssVar('--text-secondary'), grid = cssVar('--grid'), surface = cssVar('--surface-1'), primary = cssVar('--text-primary');
  const labels = [short(w.monthA), ...w.steps.map((s) => s.key), short(w.monthB)];
  const data = [[0, w.totalA], ...w.steps.map((s) => [s.start, s.end]), [0, w.totalB]];
  const colors = [series, ...w.steps.map((s) => (s._isOther ? muted : s.delta > 0 ? up : down)), series];
  const deltas = [null, ...w.steps.map((s) => s.delta), null];

  // Etiqueta directa al final de cada barra (el color nunca es la única pista)
  const valueLabels = {
    id: 'wfLabels',
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      const meta = chart.getDatasetMeta(0);
      ctx.save();
      ctx.font = '600 11px "Geist Mono Variable", ui-monospace, monospace';
      ctx.fillStyle = text;
      ctx.textBaseline = 'middle';
      meta.data.forEach((bar, i) => {
        const txt = deltas[i] === null ? fmtUSD(data[i][1]) : signed(deltas[i]);
        const right = Math.max(bar.x, bar.base);
        ctx.fillText(txt, right + 6, bar.y);
      });
      ctx.restore();
    }
  };

  const Chart = await loadChart();
  if (id !== drawId || !canvasEl.value) return;
  chartInst = new Chart(canvasEl.value, {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderRadius: 4, borderSkipped: false, barPercentage: 0.72, categoryPercentage: 0.9 }] },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { right: 84 } },
      scales: {
        x: { beginAtZero: true, grid: { color: grid }, border: { display: false }, ticks: { color: muted, font: { size: 10.5 }, callback: (v) => fmtUSDShort(v) } },
        y: { grid: { display: false }, border: { display: false }, ticks: { color: text, font: { size: 11 }, callback(v) { const l = this.getLabelForValue(v); return l.length > 28 ? l.slice(0, 27) + '…' : l; } } }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: primary, titleColor: surface, bodyColor: surface, padding: 8, cornerRadius: 6, displayColors: false,
          callbacks: {
            title: (items) => labels[items[0].dataIndex],
            label: (ctx) => {
              const i = ctx.dataIndex;
              if (deltas[i] === null) return 'Total ' + fmtUSD(data[i][1]);
              const s = w.steps[i - 1];
              return s._isOther ? `${signed(s.delta)} entre ${s.count} elementos` : `${fmtUSD(s.from)} → ${fmtUSD(s.to)} (${signed(s.delta)})`;
            }
          }
        }
      }
    },
    plugins: [valueLabels]
  });
}
onMounted(() => nextTick(draw));
onBeforeUnmount(() => { drawId++; if (chartInst) chartInst.destroy(); });
watch([wf, () => props.themeTick], () => nextTick(draw));
const chartHeight = computed(() => (wf.value ? Math.max(220, (wf.value.steps.length + 2) * 34 + 40) : 220));
</script>

<template>
  <div class="card card-waterfall">
    <h2>¿Qué movió el costo? <span class="sub">diferencia entre dos meses</span></h2>
    <div v-if="months.length < 2" class="empty">Se necesitan al menos dos meses de detalle. Aparecerá cuando el workflow publique monthlyDetail.</div>
    <template v-else>
      <div class="controls">
        <label class="sel"><span>De</span>
          <select v-model="monthA"><option v-for="m in months" :key="m" :value="m">{{ optLabel(m) }}</option></select>
        </label>
        <label class="sel"><span>a</span>
          <select v-model="monthB"><option v-for="m in months" :key="m" :value="m">{{ optLabel(m) }}</option></select>
        </label>
        <div class="seg" role="radiogroup" aria-label="Agrupar por">
          <button v-for="(d, k) in DIMENSIONS" :key="k" type="button" role="radio" :aria-checked="dim === k" :class="{ on: dim === k }" @click="dim = k">{{ d.label }}</button>
        </div>
      </div>

      <div v-if="!wf" class="empty">Elige dos meses distintos.</div>
      <template v-else>
        <p class="summary">
          De {{ monthLabel(wf.monthA) }} a {{ monthLabel(wf.monthB) }} el gasto
          <strong :class="wf.delta > 0 ? 'up' : 'down'">{{ wf.delta > 0 ? 'subió' : 'bajó' }} {{ fmtUSD(Math.abs(wf.delta)) }}<template v-if="wf.deltaPct !== null"> ({{ wf.deltaPct >= 0 ? '+' : '' }}{{ wf.deltaPct.toFixed(1) }}%)</template></strong>.
          <template v-if="wf.topUp"> Lo que más empujó hacia arriba: <strong>{{ wf.topUp.key }}</strong> ({{ signed(wf.topUp.delta) }}).</template>
          <template v-if="wf.topDown"> Lo que más bajó: <strong>{{ wf.topDown.key }}</strong> ({{ signed(wf.topDown.delta) }}).</template>
        </p>
        <p v-if="partial" class="note">El mes en curso está incompleto: compara contra un mes cerrado con cuidado.</p>
        <div class="chart-wrap" :style="{ height: chartHeight + 'px' }">
          <canvas ref="canvasEl" role="img" :aria-label="`Cascada de cambios de ${monthLabel(wf.monthA)} a ${monthLabel(wf.monthB)} por ${DIMENSIONS[dim].label.toLowerCase()}`"></canvas>
        </div>
        <div class="legend">
          <span><i class="sw total"></i>Total del mes</span>
          <span><i class="sw up"></i>Aumento</span>
          <span><i class="sw down"></i>Reducción</span>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.controls { display: flex; flex-wrap: wrap; gap: var(--space-3); align-items: center; margin-bottom: var(--space-4); }
.sel { display: inline-flex; align-items: center; gap: var(--space-2); font-size: var(--fs-xs); color: var(--text-muted); font-family: var(--mono); }
select {
  height: 36px; padding: 0 30px 0 12px; border-radius: var(--radius-md); border: 1px solid var(--border-strong);
  background: var(--surface-2); color: var(--text-primary); font: inherit; font-size: var(--fs-sm); font-family: var(--sans);
  appearance: none; -webkit-appearance: none;
  background-image: linear-gradient(45deg, transparent 50%, var(--text-muted) 50%), linear-gradient(135deg, var(--text-muted) 50%, transparent 50%);
  background-position: calc(100% - 16px) 15px, calc(100% - 11px) 15px; background-size: 5px 5px; background-repeat: no-repeat;
}
.seg { display: inline-flex; padding: 3px; gap: 2px; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-md); margin-left: auto; }
.seg button { height: 30px; padding: 0 12px; border: 0; border-radius: 9px; background: transparent; color: var(--text-secondary); font: inherit; font-size: var(--fs-xs); font-weight: 500; cursor: pointer; }
.seg button.on { background: var(--surface-1); color: var(--text-primary); box-shadow: 0 0 0 1px var(--border-strong); }
@media (max-width: 640px) { .seg { margin-left: 0; } }
.summary { margin: 0 0 var(--space-2); font-size: var(--fs-sm); color: var(--text-secondary); max-width: 80ch; }
.summary strong { color: var(--text-primary); font-weight: 600; }
.summary strong.up { color: var(--critical); }
.summary strong.down { color: var(--good); }
.note { margin: 0 0 var(--space-2); font-size: var(--fs-xs); color: var(--warning-text); font-family: var(--mono); }
.chart-wrap { position: relative; margin-top: var(--space-3); }
.legend { display: flex; flex-wrap: wrap; gap: var(--space-4); margin-top: var(--space-3); font-size: var(--fs-xs); color: var(--text-muted); font-family: var(--mono); }
.legend span { display: inline-flex; align-items: center; gap: 6px; }
.sw { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
.sw.total { background: var(--series-1); }
.sw.up { background: var(--critical); }
.sw.down { background: var(--good); }
</style>
