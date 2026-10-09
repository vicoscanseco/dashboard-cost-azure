<script setup>
import { computed } from 'vue';
import { fmtUSD, cssVar, CAT_COLORS } from '../lib/format.js';
import { buildRankedRows } from '../lib/calc.js';

const props = defineProps({
  items: { type: Array, default: () => [] },
  shownCount: { type: Number, required: true },
  labelField: { type: String, required: true },
  withDelta: { type: Boolean, default: false },
  emptyMsg: { type: String, default: 'Sin datos.' }
});

const rows = computed(() => (props.items.length ? buildRankedRows(props.items, props.shownCount, props.labelField, props.withDelta) : []));

function swatchColor(row) {
  if (row._isOther) return cssVar('--text-muted');
  return cssVar(CAT_COLORS[row._colorIndex % CAT_COLORS.length]);
}
</script>

<template>
  <div v-if="!rows.length" class="empty">{{ emptyMsg }}</div>
  <div v-else class="bar-list">
    <div v-for="row in rows" :key="row[labelField]" :class="['bar-row', { 'is-other': row._isOther }]">
      <span class="bar-label">
        <span class="bar-swatch" :style="{ background: swatchColor(row) }"></span>
        {{ row[labelField] }}
      </span>
      <span class="bar-value">
        {{ fmtUSD(row.cost) }}
        <span v-if="withDelta && row.deltaPct !== null && row.deltaPct !== undefined" :class="row.deltaPct > 0.05 ? 'delta-up' : 'delta-down'">
          {{ row.deltaPct >= 0 ? '+' : '' }}{{ row.deltaPct }}%
        </span>
      </span>
      <div class="bar-track"><div class="bar-fill" :class="{ muted: row._isOther }" :style="{ width: row._pct + '%' }"></div></div>
    </div>
  </div>
</template>

<style scoped>
.bar-list { display: flex; flex-direction: column; }
.bar-row { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: var(--space-3); margin-bottom: var(--space-3); font-size: var(--fs-sm); }
.bar-row:last-child { margin-bottom: 0; }
.bar-row.is-other .bar-label, .bar-row.is-other .bar-value { color: var(--text-muted); }
.bar-label { display: flex; align-items: center; gap: var(--space-2); color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bar-swatch { width: 9px; height: 9px; border-radius: 3px; flex: none; }
.bar-track { grid-column: 1 / -1; height: 6px; border-radius: 999px; background: var(--surface-2); position: relative; margin-top: 2px; overflow: hidden; }
.bar-fill { position: absolute; inset: 0; border-radius: 999px; background: var(--series-1); width: 0%; transition: width 1s var(--ease); }
.bar-fill.muted { background: var(--text-muted); opacity: 0.55; }
.bar-value { font-family: var(--mono); color: var(--text-primary); font-variant-numeric: tabular-nums; font-weight: 600; white-space: nowrap; display: flex; gap: var(--space-2); }
.delta-up { color: var(--critical); }
.delta-down { color: var(--good); }
</style>
