<script setup>
import { computed } from 'vue';
import { fmtUSD, fmtDate, capitalize } from '../lib/format.js';

const props = defineProps({
  mtd: { type: Object, default: null },
  fallbackSnapshotDate: { type: String, default: null },
  fallbackTotal: { type: Number, default: null }
});

const pct = computed(() => {
  if (!props.mtd || props.mtd.prevSoFar === null || !props.mtd.prevSoFar) return null;
  return ((props.mtd.currentSoFar - props.mtd.prevSoFar) / props.mtd.prevSoFar) * 100;
});
const trend = computed(() => {
  if (pct.value === null) return 'flat';
  if (pct.value > 0.05) return 'up';
  if (pct.value < -0.05) return 'down';
  return 'flat';
});
const arrow = computed(() => ({ up: '↑', down: '↓', flat: '→' }[trend.value]));
</script>

<template>
  <div class="card card-hero">
    <h2>Total del mes en curso</h2>
    <template v-if="mtd">
      <div class="hero-label">{{ capitalize(mtd.monthLabel) }}, al {{ fmtDate(mtd.lastDate) }}</div>
      <div class="hero-value">{{ fmtUSD(mtd.currentSoFar) }}</div>
      <div v-if="mtd.prevSoFar !== null && pct !== null" :class="['hero-delta', trend]">
        {{ arrow }} {{ pct >= 0 ? '+' : '' }}{{ pct.toFixed(1) }}% vs mismos días del mes anterior
      </div>
      <div class="hero-sub">
        {{ mtd.prevSoFar !== null ? 'Mes anterior (mismos días): ' + fmtUSD(mtd.prevSoFar) : 'Sin datos del mes anterior para comparar' }}
      </div>
    </template>
    <template v-else>
      <div class="hero-label">Corte del {{ fmtDate(fallbackSnapshotDate) }}</div>
      <div class="hero-value">{{ fmtUSD(fallbackTotal || 0) }}</div>
      <div class="hero-sub">Aún no hay suficiente historial diario para el mes en curso</div>
    </template>
  </div>
</template>

<style scoped>
.card-hero { display: flex; flex-direction: column; gap: var(--space-1); }
.hero-label { font-size: var(--fs-sm); color: var(--text-muted); font-family: var(--mono); }
.hero-value { font-size: var(--fs-2xl); font-weight: 700; letter-spacing: -0.02em; margin: var(--space-1) 0; }
.hero-delta { font-size: var(--fs-sm); font-weight: 600; }
.hero-delta.up { color: var(--critical); }
.hero-delta.down { color: var(--good); }
.hero-delta.flat { color: var(--text-secondary); }
.hero-sub { font-size: var(--fs-xs); color: var(--text-muted); }
</style>
