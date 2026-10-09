<script setup>
import { computed } from 'vue';
import { fmtUSD } from '../lib/format.js';
import { buildResourceRows } from '../lib/calc.js';

const props = defineProps({
  resources: { type: Array, default: () => [] },
  resourceComparisons: { type: Array, default: () => [] }
});

const rows = computed(() => buildResourceRows(props.resources, props.resourceComparisons));
function deltaColor(d) {
  if (d === null || d === undefined) return 'var(--text-muted)';
  if (d > 0.05) return 'var(--critical)';
  if (d < -0.05) return 'var(--good)';
  return 'var(--text-muted)';
}
</script>

<template>
  <div class="card card-resources">
    <h2>Top recursos</h2>
    <div v-if="!resources.length" class="empty">Sin datos.</div>
    <table v-else>
      <tr><th>Grupo</th><th>Recurso</th><th style="text-align:right">Costo</th><th style="text-align:right">Var. semana</th></tr>
      <tr v-for="r in rows" :key="r.resource_group + '::' + r.resource_name">
        <td>{{ r.resource_group }}</td>
        <td>{{ r.resource_name }}</td>
        <td class="num">{{ fmtUSD(r.cost) }}</td>
        <td class="num" :style="{ color: deltaColor(r.deltaPct) }">
          {{ r.deltaPct !== null && r.deltaPct !== undefined ? (r.deltaPct >= 0 ? '+' : '') + r.deltaPct + '%' : '-' }}
        </td>
      </tr>
    </table>
  </div>
</template>

<style scoped>
table { width: 100%; border-collapse: collapse; font-size: var(--fs-sm); }
th, td { text-align: left; padding: 11px 8px; border-bottom: 1px solid var(--grid); }
tr:hover td { background: var(--surface-2); }
th { color: var(--text-muted); font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; padding-bottom: 10px; }
td.num { text-align: right; font-family: var(--mono); font-variant-numeric: tabular-nums; color: var(--text-primary); font-weight: 600; }
tr:last-child td { border-bottom: none; }
</style>
