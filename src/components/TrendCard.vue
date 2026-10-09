<script setup>
import { computed, ref } from 'vue';
import { fmtUSD, fmtDate } from '../lib/format.js';

const props = defineProps({
  history: { type: Array, default: () => [] },
  monthlyBudget: { type: Number, default: null }
});

const W = 900, H = 220, padL = 46, padR = 16, padT = 16, padB = 28;
const innerW = W - padL - padR, innerH = H - padT - padB;

// presupuesto diario estimado: presupuesto mensual entre los días de cada mes
const budgetAt = (date) => {
  if (!props.monthlyBudget) return null;
  const d = new Date(date + 'T00:00:00');
  return props.monthlyBudget / new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
};

const niceMax = computed(() => {
  const maxV = Math.max(...props.history.map((h) => Math.max(h.total, budgetAt(h.date) || 0)), 0);
  return maxV <= 0 ? 10 : Math.ceil((maxV * 1.15) / 5) * 5;
});
const x = (i) => padL + (innerW * i) / (props.history.length - 1);
const y = (v) => padT + innerH - (innerH * v) / niceMax.value;

const linePts = computed(() => props.history.map((h, i) => `${x(i)},${y(h.total)}`).join(' '));
const budgetPts = computed(() =>
  props.monthlyBudget ? props.history.map((h, i) => `${x(i)},${y(budgetAt(h.date))}`).join(' ') : ''
);
const areaPath = computed(() => {
  if (!props.history.length) return '';
  const pts = props.history.map((h, i) => `${x(i)},${y(h.total)}`).join(' L');
  return `M${x(0)},${padT + innerH} L${pts} L${x(props.history.length - 1)},${padT + innerH} Z`;
});
const gridLines = computed(() => {
  const ticks = 4, out = [];
  for (let g = 0; g <= ticks; g++) {
    const gv = (niceMax.value / ticks) * g;
    out.push({ y: y(gv), label: '$' + Math.round(gv) });
  }
  return out;
});
const xLabels = computed(() => {
  const labelStep = Math.max(1, Math.ceil(props.history.length / 7));
  return props.history
    .map((h, i) => ({ h, i }))
    .filter(({ i }) => i % labelStep === 0 || i === props.history.length - 1)
    .map(({ h, i }) => ({ x: x(i), label: fmtDate(h.date) }));
});

const summary = computed(() => {
  const hs = props.history;
  if (hs.length < 2) return 'Tendencia diaria';
  const max = hs.reduce((m, h) => (h.total > m.total ? h : m), hs[0]);
  return `Tendencia diaria de ${fmtDate(hs[0].date)} a ${fmtDate(hs[hs.length - 1].date)}. Último día ${fmtUSD(hs[hs.length - 1].total)}. Máximo ${fmtUSD(max.total)} el ${fmtDate(max.date)}.`;
});

// Crosshair: solo cambia el estado cuando cambia el punto más cercano
const hover = ref(null);
const wrapEl = ref(null);
function onMove(evt) {
  const rect = evt.currentTarget.getBoundingClientRect();
  const px = ((evt.clientX - rect.left) / rect.width) * W;
  const i = Math.round(((px - padL) / innerW) * (props.history.length - 1));
  const next = Math.max(0, Math.min(props.history.length - 1, i));
  if (hover.value !== next) hover.value = next;
}
const hoverPoint = computed(() => (hover.value === null ? null : props.history[hover.value]));
const tipStyle = computed(() => {
  if (hover.value === null) return {};
  const h = props.history[hover.value];
  const left = (x(hover.value) / W) * 100;
  return { left: left + '%', top: (y(h.total) / H) * 100 + '%' };
});
</script>

<template>
  <div class="card card-trend">
    <h2>Tendencia diaria <span class="sub">Costo real de cada día</span></h2>
    <div ref="wrapEl" class="trend-wrap">
      <div v-if="!history.length" class="empty">Aún no hay suficiente historial. Vuelve mañana.</div>
      <div v-else-if="history.length === 1" class="empty">
        Solo hay un punto de historial ({{ fmtDate(history[0].date) }}: {{ fmtUSD(history[0].total) }}). Se necesitan al menos 2 días para una tendencia.
      </div>
      <template v-else>
        <svg :viewBox="`0 0 ${W} ${H}`" style="width:100%; height:auto; display:block;" role="img" :aria-label="summary">
          <defs>
            <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="var(--series-1)" stop-opacity="0.28" />
              <stop offset="1" stop-color="var(--series-1)" stop-opacity="0" />
            </linearGradient>
          </defs>
          <g v-for="(g, idx) in gridLines" :key="idx">
            <line :x1="padL" :y1="g.y" :x2="W - padR" :y2="g.y" stroke="var(--grid)" stroke-width="1" stroke-dasharray="2 5" />
            <text :x="padL - 8" :y="g.y + 4" text-anchor="end" font-size="10.5" font-family="var(--mono)" fill="var(--text-muted)">{{ g.label }}</text>
          </g>
          <polyline v-if="budgetPts" :points="budgetPts" fill="none" stroke="var(--critical)" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.8" />
          <path :d="areaPath" fill="url(#trend-fill)" stroke="none" />
          <polyline :points="linePts" fill="none" stroke="var(--series-1)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
          <text v-for="(l, idx) in xLabels" :key="idx" :x="l.x" :y="H - 8" text-anchor="middle" font-size="10.5" font-family="var(--mono)" fill="var(--text-muted)">{{ l.label }}</text>

          <g v-if="hoverPoint" pointer-events="none">
            <line :x1="x(hover)" :x2="x(hover)" :y1="padT" :y2="padT + innerH" stroke="var(--text-muted)" stroke-width="1" stroke-dasharray="3 3" />
            <circle :cx="x(hover)" :cy="y(hoverPoint.total)" r="5" fill="var(--series-1)" stroke="var(--surface-1)" stroke-width="2.5" />
          </g>
          <rect :x="padL" :y="padT" :width="innerW" :height="innerH" fill="transparent" @mousemove="onMove" @mouseleave="hover = null" />
        </svg>
        <div v-if="hoverPoint" class="tooltip" :style="tipStyle">
          <span class="tip-date">{{ fmtDate(hoverPoint.date) }}</span>
          <span class="tip-value">{{ fmtUSD(hoverPoint.total) }}</span>
          <span v-if="monthlyBudget" class="tip-budget">presupuesto {{ fmtUSD(budgetAt(hoverPoint.date)) }}</span>
        </div>
        <div v-if="monthlyBudget" class="legend">
          <span class="swatch line"></span>Costo diario
          <span class="swatch dash"></span>Presupuesto diario estimado
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.trend-wrap { position: relative; }
.tooltip {
  position: absolute;
  transform: translate(-50%, calc(-100% - 14px));
  display: flex; flex-direction: column; gap: 2px;
  background: var(--text-primary);
  color: var(--surface-1);
  font-family: var(--mono);
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  pointer-events: none;
  white-space: nowrap;
}
.tip-date { font-size: 11px; opacity: 0.7; }
.tip-value { font-size: var(--fs-base); font-weight: 600; }
.tip-budget { font-size: 11px; opacity: 0.7; }
.legend { display: flex; align-items: center; gap: var(--space-2); margin-top: var(--space-3); font-size: var(--fs-xs); color: var(--text-muted); font-family: var(--mono); }
.swatch { width: 16px; height: 0; display: inline-block; }
.swatch.line { border-top: 2.5px solid var(--series-1); }
.swatch.dash { border-top: 1.5px dashed var(--critical); margin-left: var(--space-3); }
</style>
