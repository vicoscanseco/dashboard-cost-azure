<script setup>
import { computed } from 'vue';
import { fmtUSD } from '../lib/format.js';
import { buildAnomalyBadges } from '../lib/calc.js';

const props = defineProps({
  groups: { type: Array, default: () => [] },
  resources: { type: Array, default: () => [] },
  history: { type: Array, default: () => [] },
  monthlyBudget: { type: Number, default: null },
  monthToDateSoFar: { type: Number, default: null },
  monthlyFinals: { type: Object, default: () => ({}) }
});

const badges = computed(() =>
  buildAnomalyBadges(props.groups, props.resources, props.history, props.monthlyBudget, props.monthToDateSoFar, props.monthlyFinals)
);

function badgeText(b) {
  if (b.kind === 'budget') return `Proyección del mes ${fmtUSD(b.forecast)} supera el presupuesto (+${b.overPct}%)`;
  if (b.kind === 'group') return `${b.name} subió +${b.deltaPct}% (${fmtUSD(b.prevCost)} → ${fmtUSD(b.cost)})`;
  return `${b.name} (${b.group}) subió +${b.deltaPct}% (${fmtUSD(b.prevCost)} → ${fmtUSD(b.cost)})`;
}
</script>

<template>
  <div v-if="badges.length" class="anomaly-strip">
    <div v-for="(b, i) in badges" :key="i" :class="['anomaly-badge', b.critical ? 'sev-critical' : 'sev-warning']">
      <span class="anomaly-dot" :style="{ background: b.critical ? 'var(--critical)' : 'var(--warning)' }"></span>
      <span>{{ badgeText(b) }}</span>
    </div>
  </div>
</template>

<style scoped>
.anomaly-strip { display: flex; flex-wrap: wrap; gap: 10px; }
.anomaly-badge {
  display: flex; align-items: center; gap: 8px;
  background: var(--surface-1); border: 1px solid var(--border); border-radius: 999px;
  padding: 8px 14px; font-size: 12.5px; color: var(--text-primary); box-shadow: var(--shadow-sm);
}
.anomaly-badge.sev-critical { background: var(--critical-bg); border-color: color-mix(in srgb, var(--critical) 45%, var(--border)); }
.anomaly-badge.sev-warning { background: var(--warning-bg); border-color: color-mix(in srgb, var(--warning) 45%, var(--border)); }
.anomaly-dot { width: 7px; height: 7px; border-radius: 50%; flex: none; }
</style>
