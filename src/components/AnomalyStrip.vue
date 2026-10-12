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
  monthlyFinals: { type: Object, default: () => ({}) },
  dailyAnomalies: { type: Array, default: () => [] },
  projectBudgets: { type: Array, default: () => [] }
});

const badges = computed(() =>
  buildAnomalyBadges(props.groups, props.resources, props.history, props.monthlyBudget, props.monthToDateSoFar, props.monthlyFinals, { dailyAnomalies: props.dailyAnomalies, projectBudgets: props.projectBudgets })
);

const TARGETS = { budget: 'card-hero', group: 'card-groups', resource: 'card-resources', project: 'card-budgets' };
const DAILY_TARGETS = { total: 'card-trend', proyecto: 'card-heat-groups', servicio: 'card-heat-services' };

function goTo(b) {
  const el = document.getElementById(b.kind === 'daily' ? DAILY_TARGETS[b.scope] : TARGETS[b.kind]);
  if (!el) return;
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' });
  el.classList.remove('flash');
  void el.offsetWidth; // reinicia la animación si se pulsa dos veces
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 1600);
}

function badgeText(b) {
  if (b.kind === 'budget') return `Proyección del mes ${fmtUSD(b.forecast)} supera el presupuesto (+${b.overPct}%)`;
  if (b.kind === 'project') return b.status === 'excedido'
    ? `${b.name} ya pasó su presupuesto (${fmtUSD(b.mtd)} de ${fmtUSD(b.budget)})`
    : `${b.name} cerraría en ~${fmtUSD(b.projection)} (presupuesto ${fmtUSD(b.budget)})`;
  if (b.kind === 'daily') {
    const who = b.scope === 'total' ? 'Gasto total' : b.name;
    return b.isNew
      ? `${who}: gasto nuevo de ${fmtUSD(b.cost)} el ${b.weekday}`
      : `${who}: ${fmtUSD(b.cost)} el ${b.weekday}, normal ~${fmtUSD(b.baseline)} (+${Math.round(b.deltaPct)}%)`;
  }
  if (b.kind === 'group') return `${b.name} subió +${b.deltaPct}% (${fmtUSD(b.prevCost)} → ${fmtUSD(b.cost)})`;
  return `${b.name} (${b.group}) subió +${b.deltaPct}% (${fmtUSD(b.prevCost)} → ${fmtUSD(b.cost)})`;
}
</script>

<template>
  <div v-if="badges.length" class="anomaly-strip rise">
    <button v-for="(b, i) in badges" :key="i" type="button" :class="['anomaly-badge', b.critical ? 'sev-critical' : 'sev-warning']" @click="goTo(b)">
      <component :is="b.critical ? PhWarningOctagon : PhWarning" class="anomaly-icon" :size="18" weight="bold" />
      <span>{{ badgeText(b) }}</span>
    </button>
  </div>
</template>

<style scoped>
.anomaly-strip { display: flex; flex-wrap: wrap; gap: var(--space-3); }
.anomaly-badge {
  display: flex; align-items: center; gap: var(--space-2);
  background: var(--surface-1); border: 1px solid var(--border); border-radius: var(--radius-md);
  padding: 10px 14px; font-size: var(--fs-sm); color: var(--text-primary);
  font: inherit; font-size: var(--fs-sm); text-align: left; cursor: pointer;
  transition: transform .2s var(--ease), border-color .2s var(--ease);
}
.anomaly-badge:hover { transform: translateY(-1px); }
.anomaly-badge:active { transform: scale(0.98); }
.anomaly-badge.sev-critical { background: var(--critical-bg); border-color: color-mix(in srgb, var(--critical) 40%, var(--border)); }
.anomaly-badge.sev-warning { background: var(--warning-bg); border-color: color-mix(in srgb, var(--warning) 40%, var(--border)); }
.sev-critical .anomaly-icon { color: var(--critical); }
.sev-warning .anomaly-icon { color: var(--warning); }
.anomaly-icon { flex: none; }
</style>
