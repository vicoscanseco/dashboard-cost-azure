<script setup>
import { computed } from 'vue';
import { fmtDate, fmtUSD, fmtUSDShort, cssVar } from '../lib/format.js';
import { buildHeatmapData } from '../lib/calc.js';

const props = defineProps({
  title: { type: String, required: true },
  rows: { type: Array, default: () => [] },
  keyField: { type: String, required: true },
  rowHeadLabel: { type: String, required: true },
  emptyMsg: { type: String, required: true }
});

const data = computed(() => buildHeatmapData(props.rows, props.keyField));

function cellStyle(cost, t) {
  if (!cost) return { background: 'transparent', color: cssVar('--text-primary') };
  const rgb = cssVar('--series-1-rgb');
  const alpha = 0.08 + t * 0.82;
  return { background: `rgba(${rgb},${alpha.toFixed(2)})`, color: t > 0.55 ? '#ffffff' : cssVar('--text-primary') };
}
const legendSteps = [0.1, 0.3, 0.5, 0.7, 0.9];
function legendStyle(t) {
  return { background: `rgba(${cssVar('--series-1-rgb')},${t.toFixed(2)})` };
}
</script>

<template>
  <div class="card card-heatmap">
    <h2>{{ title }}<span class="sub">últimos 7 días con datos</span></h2>
    <div v-if="!data" class="empty">{{ emptyMsg }}</div>
    <div v-else-if="data.tooShort" class="empty">Se necesitan al menos 2 días de historial para el mapa de calor.</div>
    <template v-else>
      <div class="heatmap-scroll">
        <table class="heatmap">
          <tr>
            <th class="row-head">{{ rowHeadLabel }}</th>
            <th v-for="d in data.days" :key="d">{{ fmtDate(d) }}</th>
            <th class="total-head">Total</th>
          </tr>
          <tr v-for="row in data.rows" :key="row.key">
            <td class="row-label">{{ row.key }}</td>
            <td v-for="cell in row.cells" :key="cell.date">
              <div class="heat-cell" :style="cellStyle(cell.cost, cell.t)" :title="`${row.key} · ${fmtDate(cell.date)}: ${fmtUSD(cell.cost)}`">
                {{ cell.cost ? fmtUSDShort(cell.cost) : '–' }}
              </div>
            </td>
            <td class="heat-total">{{ fmtUSDShort(row.rowTotal) }}</td>
          </tr>
        </table>
      </div>
      <div class="heat-legend">
        Menor
        <div class="heat-ramp"><span v-for="(t, i) in legendSteps" :key="i" :style="legendStyle(t)"></span></div>
        Mayor
      </div>
    </template>
  </div>
</template>

<style scoped>
.heatmap-scroll { overflow-x: auto; }
.heatmap { border-collapse: separate; border-spacing: 3px; font-size: var(--fs-xs); min-width: 100%; }
.heatmap th { padding: 0 4px 6px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; color: var(--text-muted); text-align: center; border: none; }
.heatmap th.row-head { text-align: left; padding: 4px 10px 4px 0; text-transform: none; letter-spacing: 0; }
.heatmap td { border: none; padding: 0; }
.heatmap td.row-label { text-align: left; padding: 4px 10px 4px 0; color: var(--text-secondary); white-space: nowrap; font-size: var(--fs-sm); }
.heat-cell {
  width: 52px; height: 30px; border-radius: var(--radius-sm);
  display: flex; align-items: center; justify-content: center;
  font-family: var(--mono); font-variant-numeric: tabular-nums; font-size: 10.5px; font-weight: 600;
}
.heatmap th.total-head { text-align: right; padding: 0 6px 6px 14px; border-left: 1px solid var(--border); }
.heatmap td.heat-total {
  text-align: right; padding: 4px 6px 4px 14px; border-left: 1px solid var(--border);
  font-family: var(--mono); font-weight: 650; font-variant-numeric: tabular-nums; color: var(--text-primary); white-space: nowrap;
}
.heat-legend { display: flex; align-items: center; gap: 6px; margin-top: var(--space-4); font-size: var(--fs-xs); color: var(--text-muted); }
.heat-legend .heat-ramp { display: flex; gap: 2px; }
.heat-legend .heat-ramp span { width: 16px; height: 8px; border-radius: 2px; }
</style>
