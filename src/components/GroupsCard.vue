<script setup>
import { computed } from 'vue';
import { fmtUSD, cssVar, CAT_COLORS } from '../lib/format.js';

const props = defineProps({ groups: { type: Array, default: () => [] } });

const sorted = computed(() => {
  const s = [...props.groups].sort((a, b) => b.cost - a.cost);
  return s.map((g, i) => ({ ...g, color: i < CAT_COLORS.length ? `var(${CAT_COLORS[i]})` : 'var(--text-muted)' }));
});
</script>

<template>
  <div class="card card-groups">
    <h2>Por grupo de recursos</h2>
    <div v-if="!sorted.length" class="empty">Sin datos de grupos.</div>
    <ul v-else class="group-list">
      <li v-for="g in sorted" :key="g.resource_group">
        <span class="dot" :style="{ background: g.color }"></span>
        <span class="name">{{ g.resource_group }}</span>
        <span class="cost">{{ fmtUSD(g.cost) }}</span>
        <span v-if="g.deltaPct !== null && g.deltaPct !== undefined" :class="['delta', g.deltaPct >= 0 ? 'up' : 'down']">
          {{ g.deltaPct >= 0 ? '+' : '' }}{{ g.deltaPct }}%
        </span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.group-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-2); }
.group-list li { display: flex; align-items: center; gap: var(--space-2); font-size: var(--fs-sm); padding: var(--space-1) 0; }
.dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.name { flex: 1; color: var(--text-secondary); }
.cost { font-family: var(--mono); font-weight: 600; }
.delta { font-family: var(--mono); font-size: var(--fs-xs); min-width: 48px; text-align: right; }
.delta.up { color: var(--critical); }
.delta.down { color: var(--good); }
</style>
