<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { PhArrowUpRight, PhArrowDownRight, PhArrowRight } from '@phosphor-icons/vue';
import { fmtUSD, fmtDate, capitalize } from '../lib/format.js';

const props = defineProps({
  mtd: { type: Object, default: null },
  history: { type: Array, default: () => [] },
  monthlyBudget: { type: Number, default: null },
  forecast: { type: Number, default: null },
  fallbackSnapshotDate: { type: String, default: null },
  fallbackTotal: { type: Number, default: null }
});

const total = computed(() => (props.mtd ? props.mtd.currentSoFar : props.fallbackTotal || 0));

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
const TrendIcon = computed(() => ({ up: PhArrowUpRight, down: PhArrowDownRight, flat: PhArrowRight }[trend.value]));

const usedPct = computed(() => (props.monthlyBudget ? Math.min(100, (total.value / props.monthlyBudget) * 100) : 0));
const forecastPct = computed(() => (props.monthlyBudget && props.forecast ? (props.forecast / props.monthlyBudget) * 100 : 0));
const budgetState = computed(() => (forecastPct.value > 100 ? 'over' : forecastPct.value >= 80 ? 'warn' : ''));

// Sparkline con los últimos 30 días reales
const SW = 600, SH = 120;
const spark = computed(() => {
  const pts = props.history.slice(-30);
  if (pts.length < 2) return null;
  const max = Math.max(...pts.map((p) => p.total), 1) * 1.1;
  const x = (i) => (SW * i) / (pts.length - 1);
  const y = (v) => SH - 8 - ((SH - 16) * v) / max;
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.total).toFixed(1)}`).join(' ');
  return { line, area: `${line} L${SW},${SH} L0,${SH} Z` };
});

// Conteo animado escrito directo al DOM (sin estado reactivo por frame)
const valueEl = ref(null);
let raf = 0;
function paint(v) { if (valueEl.value) valueEl.value.textContent = fmtUSD(v); }
function countUp() {
  cancelAnimationFrame(raf);
  const target = total.value;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { paint(target); return; }
  const t0 = performance.now(), dur = 1100;
  const tick = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    paint(target * (1 - Math.pow(1 - k, 4)));
    if (k < 1) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}
onMounted(countUp);
watch(total, countUp);
onBeforeUnmount(() => cancelAnimationFrame(raf));
</script>

<template>
  <div class="card card-hero">
    <svg v-if="spark" class="spark" :viewBox="`0 0 ${SW} ${SH}`" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="var(--series-1)" stop-opacity="0.32" />
          <stop offset="1" stop-color="var(--series-1)" stop-opacity="0" />
        </linearGradient>
      </defs>
      <path :d="spark.area" fill="url(#spark-fill)" />
      <path :d="spark.line" fill="none" stroke="var(--series-1)" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" />
    </svg>

    <div class="hero-content">
      <div class="hero-top">
        <span class="hero-label">
          <template v-if="mtd">{{ capitalize(mtd.monthLabel) }}, al {{ fmtDate(mtd.lastDate) }}</template>
          <template v-else>Corte del {{ fmtDate(fallbackSnapshotDate) }}</template>
        </span>
        <span v-if="pct !== null" :class="['hero-delta', trend]">
          <component :is="TrendIcon" :size="14" weight="bold" />
          {{ pct >= 0 ? '+' : '' }}{{ pct.toFixed(1) }}% vs mes anterior
        </span>
      </div>

      <div ref="valueEl" class="hero-value">{{ fmtUSD(total) }}</div>
      <p class="hero-caption">Gasto acumulado del mes en curso</p>

      <div class="hero-stats">
        <div v-if="forecast">
          <div class="stat-label">Proyección fin de mes</div>
          <div :class="['stat-value', budgetState]">{{ fmtUSD(forecast) }}</div>
        </div>
        <div v-if="monthlyBudget">
          <div class="stat-label">Presupuesto</div>
          <div class="stat-value">{{ fmtUSD(monthlyBudget) }}</div>
        </div>
        <div v-if="mtd && mtd.prevSoFar !== null">
          <div class="stat-label">Mes anterior, mismos días</div>
          <div class="stat-value">{{ fmtUSD(mtd.prevSoFar) }}</div>
        </div>
      </div>

      <div v-if="monthlyBudget" class="budget">
        <div class="budget-track">
          <div :class="['budget-fill', budgetState]" :style="{ width: usedPct + '%' }"></div>
          <div v-if="forecastPct" class="budget-mark" :style="{ left: Math.min(100, forecastPct) + '%' }" title="Proyección"></div>
        </div>
        <div class="budget-note">
          {{ usedPct.toFixed(0) }}% del presupuesto usado<span v-if="forecastPct">, proyección al {{ forecastPct.toFixed(0) }}%</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card-hero {
  overflow: hidden;
  padding: var(--space-6);
  background:
    radial-gradient(40rem 22rem at 0% 0%, rgba(var(--series-1-rgb), 0.10), transparent 60%),
    var(--surface-1);
  border-color: color-mix(in srgb, var(--series-1) 28%, var(--border));
  box-shadow: var(--shadow-lg);
}
.spark { position: absolute; left: 0; right: 0; bottom: 0; width: 100%; height: 46%; pointer-events: none; opacity: 0.9; }
.hero-content { position: relative; display: flex; flex-direction: column; min-height: 100%; }
.hero-top { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-3); }
.hero-label { font-size: var(--fs-sm); color: var(--text-secondary); font-family: var(--mono); }
.hero-delta {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 12px; border-radius: 999px;
  font-size: var(--fs-xs); font-weight: 600; font-family: var(--mono);
  background: var(--surface-2); color: var(--text-secondary);
}
.hero-delta.up { background: var(--critical-bg); color: var(--critical); }
.hero-delta.down { background: var(--good-bg); color: var(--good); }
.hero-value {
  font-family: var(--mono);
  font-size: clamp(3.4rem, 9vw, 6.6rem);
  font-weight: 500;
  line-height: 1;
  letter-spacing: -0.05em;
  font-variant-numeric: tabular-nums;
  margin-top: var(--space-6);
  color: var(--text-primary);
}
.hero-caption { margin: var(--space-3) 0 0; font-size: var(--fs-sm); color: var(--text-muted); max-width: 40ch; }
.hero-stats { display: flex; flex-wrap: wrap; gap: var(--space-4) var(--space-7); margin-top: var(--space-6); }
.stat-label { font-size: var(--fs-xs); color: var(--text-muted); margin-bottom: 4px; }
.stat-value { font-family: var(--mono); font-size: var(--fs-xl); font-weight: 500; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.stat-value.warn { color: var(--warning); }
.stat-value.over { color: var(--critical); }
.budget { margin-top: var(--space-5); max-width: 560px; }
.budget-track { position: relative; height: 8px; border-radius: 999px; background: var(--surface-2); overflow: visible; }
.budget-fill { height: 100%; border-radius: 999px; background: var(--series-1); transition: width 1s var(--ease); }
.budget-fill.warn { background: var(--warning); }
.budget-fill.over { background: var(--critical); }
.budget-mark { position: absolute; top: -4px; width: 2px; height: 16px; background: var(--text-primary); border-radius: 2px; transform: translateX(-1px); }
.budget-note { margin-top: var(--space-2); font-size: var(--fs-xs); color: var(--text-muted); font-family: var(--mono); }
</style>
