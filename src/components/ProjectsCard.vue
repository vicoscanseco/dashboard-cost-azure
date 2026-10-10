<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { loadChart } from '../lib/chart.js';
import { cssVar, fmtUSD, fmtUSDShort, capitalize, CAT_COLORS } from '../lib/format.js';
import { listMonths, buildProjectsView, monthLabel } from '../lib/history.js';

// Cada resource group es un proyecto. Gráfica apilada por mes (top 6 + Otros) y tabla
// con mes en curso, mes anterior, promedio de los 3 meses cerrados y tendencia 12 meses.
const props = defineProps({
  rows: { type: Array, default: () => [] },
  currentMonth: { type: String, default: null },
  themeTick: { type: Number, default: 0 }
});
const emit = defineEmits(['select']);

const months = computed(() => listMonths(props.rows).slice(-12));
const view = computed(() => (months.value.length && props.currentMonth ? buildProjectsView(props.rows, months.value, props.currentMonth, 6) : null));
// El color sigue al proyecto (su lugar en la serie), nunca a su rango en la tabla
const colorIndex = computed(() => {
  const m = {};
  (view.value ? view.value.series : []).forEach((s, i) => { m[s.key] = s._isOther ? -1 : i; });
  return m;
});
const swatch = (key) => {
  const i = colorIndex.value[key];
  return i === undefined || i < 0 ? 'var(--text-muted)' : `var(${CAT_COLORS[i]})`;
};
const showAll = ref(false);
const tableRows = computed(() => (view.value ? (showAll.value ? view.value.table : view.value.table.slice(0, 8)) : []));
const delta = (r) => r.changePct;
const mShort = (m) => (m ? capitalize(monthLabel(m, { month: 'short' })) : '—');

function sparkPath(vals) {
  const W = 96, H = 26;
  const max = Math.max(...vals, 0.01);
  return vals.map((v, i) => `${i ? 'L' : 'M'}${((W * i) / Math.max(1, vals.length - 1)).toFixed(1)},${(H - 2 - ((H - 4) * v) / max).toFixed(1)}`).join(' ');
}

const canvasEl = ref(null);
let chartInst = null;
let drawId = 0;
async function draw() {
  const id = ++drawId;
  if (chartInst) { chartInst.destroy(); chartInst = null; }
  const v = view.value;
  if (!v || !canvasEl.value) return;
  const surface = cssVar('--surface-1'), muted = cssVar('--text-muted'), text = cssVar('--text-secondary'), grid = cssVar('--grid'), primary = cssVar('--text-primary');
  const labels = v.months.map((m) => capitalize(monthLabel(m, { month: 'short' })) + (m === props.currentMonth ? '*' : ''));
  const datasets = v.series.map((s, i) => ({
    label: s.key,
    data: s.values,
    backgroundColor: s._isOther ? muted : cssVar(CAT_COLORS[i]),
    borderColor: surface,
    borderWidth: { top: 2 },
    borderSkipped: false,
    borderRadius: 3,
    maxBarThickness: 34,
    stack: 'p'
  }));
  const Chart = await loadChart();
  if (id !== drawId || !canvasEl.value) return;
  chartInst = new Chart(canvasEl.value, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { stacked: true, grid: { display: false }, border: { display: false }, ticks: { color: muted, font: { size: 11 } } },
        y: { stacked: true, grid: { color: grid }, border: { display: false }, ticks: { color: muted, font: { size: 10.5 }, callback: (val) => fmtUSDShort(val) } }
      },
      plugins: {
        legend: { position: 'bottom', labels: { color: text, boxWidth: 9, boxHeight: 9, font: { size: 11 } } },
        tooltip: {
          backgroundColor: primary, titleColor: surface, bodyColor: surface, padding: 8, cornerRadius: 6,
          itemSort: (a, b) => b.parsed.y - a.parsed.y,
          filter: (item) => item.parsed.y >= 0.005,
          callbacks: {
            title: (items) => capitalize(monthLabel(v.months[items[0].dataIndex])) + (v.months[items[0].dataIndex] === props.currentMonth ? ' (en curso)' : ''),
            label: (ctx) => ` ${ctx.dataset.label}: ${fmtUSD(ctx.parsed.y)}`,
            footer: (items) => 'Total ' + fmtUSD(items.reduce((s, it) => s + it.parsed.y, 0))
          }
        }
      }
    }
  });
}
onMounted(() => nextTick(draw));
onBeforeUnmount(() => { drawId++; if (chartInst) chartInst.destroy(); });
watch([view, () => props.themeTick], () => nextTick(draw));
</script>

<template>
  <div class="card card-projects">
    <h2>Costo por proyecto <span class="sub">cada resource group es un proyecto</span></h2>
    <div v-if="!view" class="empty">Aún no hay detalle mensual por proyecto. Aparecerá cuando el workflow publique monthlyDetail.</div>
    <template v-else>
      <div class="chart-wrap"><canvas ref="canvasEl" role="img" aria-label="Gasto mensual apilado por proyecto en los últimos meses"></canvas></div>
      <p class="foot">* mes en curso, incompleto</p>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Proyecto</th>
              <th class="num">{{ capitalize(monthLabel(currentMonth, { month: 'short' })) }}*</th>
              <th class="num">{{ mShort(view.lastClosed) }}</th>
              <th class="num" :title="`${mShort(view.lastClosed)} vs ${mShort(view.beforeClosed)}`">vs {{ mShort(view.beforeClosed) }}</th>
              <th class="num hide-sm">Prom. 3m</th>
              <th class="hide-sm">12 meses</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in tableRows" :key="r.key" tabindex="0" @click="emit('select', r.key)" @keydown.enter="emit('select', r.key)" title="Ver en el explorador">
              <td><span class="name"><i class="sw" :style="{ background: swatch(r.key) }"></i>{{ r.key }}</span></td>
              <td class="num">{{ fmtUSD(r.current) }}</td>
              <td class="num">{{ r.last === null ? '—' : fmtUSD(r.last) }}</td>
              <td :class="['num', delta(r) === null ? '' : delta(r) > 0 ? 'up' : 'down']">
                {{ delta(r) === null ? '—' : (delta(r) >= 0 ? '+' : '') + delta(r).toFixed(0) + '%' }}
              </td>
              <td class="num hide-sm">{{ r.avg3 === null ? '—' : fmtUSD(r.avg3) }}</td>
              <td class="hide-sm">
                <svg class="spark" viewBox="0 0 96 26" preserveAspectRatio="none" aria-hidden="true"><path :d="sparkPath(r.spark)" fill="none" stroke="var(--series-1)" stroke-width="1.6" vector-effect="non-scaling-stroke" /></svg>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="foot">
        El cambio compara los dos últimos meses cerrados. Clic en un proyecto para verlo en el explorador.
        <button v-if="view.table.length > 8" type="button" class="more" @click="showAll = !showAll">{{ showAll ? 'Ver menos' : `Ver los ${view.table.length}` }}</button>
      </p>
    </template>
  </div>
</template>

<style scoped>
.chart-wrap { height: 260px; position: relative; }
.foot { margin: var(--space-2) 0 0; font-size: var(--fs-xs); color: var(--text-muted); font-family: var(--mono); }
.table-wrap { margin-top: var(--space-4); overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: var(--fs-sm); }
th { text-align: left; font-weight: 500; font-size: var(--fs-xs); color: var(--text-muted); padding: 6px 8px; border-bottom: 1px solid var(--border); white-space: nowrap; }
td { padding: 7px 8px; border-bottom: 1px solid var(--grid); }
tbody tr { cursor: pointer; transition: background .15s var(--ease); }
tbody tr:hover, tbody tr:focus-visible { background: var(--surface-2); }
.num { text-align: right; font-family: var(--mono); font-variant-numeric: tabular-nums; white-space: nowrap; }
.name { display: flex; align-items: center; gap: var(--space-2); color: var(--text-primary); max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sw { width: 9px; height: 9px; border-radius: 3px; flex: none; display: inline-block; }
.up { color: var(--critical); }
.down { color: var(--good); }
.spark { width: 96px; height: 26px; display: block; }
.more { margin-left: var(--space-2); background: none; border: 0; padding: 0; color: var(--series-1); font: inherit; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
@media (max-width: 640px) { .hide-sm { display: none; } }
</style>
