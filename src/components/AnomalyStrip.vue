<script setup>
import { computed } from 'vue';
import { fmtUSD } from '../lib/format.js';
import { buildAnomalyBadges } from '../lib/calc.js';
import { PhWarningOctagon, PhWarning } from '@phosphor-icons/vue';

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
  <div v-if="badges.length" class="anomaly-strip rise">
    <div v-for="(b, i) in badges" :key="i" :class="['anomaly-badge', b.critical ? 'sev-critical' : 'sev-warning']">
      <component :is="b.critical ? PhWarningOctagon : PhWarning" class="anomaly-icon" :size="18" weight="bold" />
      <span>{{ badgeText(b) }}</span>
    </div>
  </div>
</template>

<style scoped>
.anomaly-strip { display: flex; flex-wrap: wrap; gap: var(--space-3); }
.anomaly-badge {
  display: flex; align-items: center; gap: var(--space-2);
  background: var(--surface-1); border: 1px solid var(--border); border-radius: var(--radius-md);
  padding: 10px 14px; font-size: var(--fs-sm); color: var(--text-primary);
}
.anomaly-badge.sev-critical { background: var(--critical-bg); border-color: color-mix(in srgb, var(--critical) 40%, var(--border)); }
.anomaly-badge.sev-warning { background: var(--warning-bg); border-color: color-mix(in srgb, var(--warning) 40%, var(--border)); }
.sev-critical .anomaly-icon { color: var(--critical); }
.sev-warning .anomaly-icon { color: var(--warning); }
.anomaly-icon { flex: none; }
</style>
