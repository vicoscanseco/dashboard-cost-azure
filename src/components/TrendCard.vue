<script setup>
import { computed, ref } from 'vue';
import { fmtUSD, fmtDate } from '../lib/format.js';

const props = defineProps({ history: { type: Array, default: () => [] } });

const W = 900, H = 220, padL = 46, padR = 16, padT = 16, padB = 28;
const innerW = W - padL - padR, innerH = H - padT - padB;

const niceMax = computed(() => {
  const maxV = Math.max(...props.history.map((h) => h.total), 0);
  return maxV <= 0 ? 10 : Math.ceil((maxV * 1.15) / 5) * 5;
});
const x = (i) => padL + (innerW * i) / (props.history.length - 1);
const y = (v) => padT + innerH - (innerH * v) / niceMax.value;

const linePts = computed(() => props.history.map((h, i) => `${x(i)},${y(h.total)}`).join(' '));
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

const tip = ref({ visible: false, x: 0, y: 0, text: '' });
function showTip(h, i, evt) {
  const svg = evt.target.closest('svg');
  const rect = svg.getBoundingClientRect();
  tip.value = {
    visible: true,
    x: x(i) * (rect.width / W),
    y: y(h.total) * (rect.height / H),
    text: `${fmtDate(h.date)}: ${fmtUSD(h.total)}`
  };
}
function hideTip() { tip.value.visible = false; }
</script>

<template>
  <div class="card card-trend">
    <h2>Tendencia diaria <span class="sub">Costo real de cada día (sin ventana móvil)</span></h2>
    <div class="trend-wrap">
      <div v-if="!history.length" class="empty">Aún no hay suficiente historial. Vuelve mañana.</div>
      <div v-else-if="history.length === 1" class="empty">
        Solo hay un punto de historial ({{ fmtDate(history[0].date) }}: {{ fmtUSD(history[0].total) }}). Se necesitan al menos 2 días para una tendencia.
      </div>
      <template v-else>
        <svg :viewBox="`0 0 ${W} ${H}`" style="width:100%; height:auto; display:block;">
          <g v-for="(g, idx) in gridLines" :key="idx">
            <line :x1="padL" :y1="g.y" :x2="W - padR" :y2="g.y" stroke="var(--grid)" stroke-width="1" />
            <text :x="padL - 8" :y="g.y + 4" text-anchor="end" font-size="10.5" font-family="var(--mono)" fill="var(--text-muted)">{{ g.label }}</text>
          </g>
          <path :d="areaPath" fill="var(--series-1-wash)" stroke="none" />
          <polyline :points="linePts" fill="none" stroke="var(--series-1)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
          <circle
            v-for="(h, i) in history"
            :key="h.date"
            :cx="x(i)" :cy="y(h.total)" r="4"
            fill="var(--series-1)" stroke="var(--surface-1)" stroke-width="2"
            style="cursor:pointer"
            @mouseenter="(e) => showTip(h, i, e)"
            @mouseleave="hideTip"
          />
          <text v-for="(l, idx) in xLabels" :key="idx" :x="l.x" :y="H - 8" text-anchor="middle" font-size="10.5" font-family="var(--mono)" fill="var(--text-muted)">{{ l.label }}</text>
        </svg>
        <div class="tooltip" :style="{ opacity: tip.visible ? 1 : 0, left: tip.x + 'px', top: tip.y + 'px' }">{{ tip.text }}</div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.trend-wrap { position: relative; }
.tooltip {
  position: absolute;
  transform: translate(-50%, -130%);
  background: var(--text-primary);
  color: var(--surface-1);
  font-size: var(--fs-xs);
  font-family: var(--mono);
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  pointer-events: none;
  transition: opacity .1s ease;
  white-space: nowrap;
}
</style>
