<script setup>
import { computed } from 'vue';
import { PhTrash, PhArrowsDownUp, PhCheckCircle, PhQuestion } from '@phosphor-icons/vue';
import { fmtUSD } from '../../lib/format.js';

const props = defineProps({ summary: { type: Object, required: true }, snapshotDate: { type: String, default: null } });
const emit = defineEmits(['filter']);

const s = computed(() => props.summary);
const elimPct = computed(() => (s.value.atStake > 0 ? (s.value.savings.eliminable / s.value.atStake) * 100 : 0));
const tiles = computed(() => [
  { status: 'sin_uso', label: 'Sin uso', icon: PhTrash, cls: 'crit', value: s.value.counts.sin_uso, foot: s.value.costlyIdle ? `${s.value.costlyIdle} cuestan ≥ $1 al mes` : 'ninguno con costo relevante' },
  { status: 'bajo_uso', label: 'Bajo uso', icon: PhArrowsDownUp, cls: 'warn', value: s.value.counts.bajo_uso, foot: 'candidatos a bajar de tier' },
  { status: 'activo', label: 'Activos', icon: PhCheckCircle, cls: 'good', value: s.value.counts.activo, foot: 'uso dentro de rango' },
  { status: 'sin_datos', label: 'Sin datos', icon: PhQuestion, cls: 'muted', value: s.value.counts.sin_datos, foot: 'sin lectura de métricas' }
]);
</script>

<template>
  <div class="card card-radar-hero">
    <div class="left">
      <span class="eyebrow">En juego cada mes</span>
      <div class="big">{{ fmtUSD(s.atStake) }}</div>
      <p class="caption">Lo que costaron en los últimos 30 días los recursos sin uso o en bajo uso.</p>

      <div class="split" role="img" :aria-label="`Eliminable ${fmtUSD(s.savings.eliminable)}, optimizable ${fmtUSD(s.savings.optimizable)}`">
        <div class="seg elim" :style="{ width: elimPct + '%' }"></div>
        <div class="seg opt" :style="{ width: 100 - elimPct + '%' }"></div>
      </div>
      <div class="legend">
        <span><i class="sw elim"></i>Eliminable <strong>{{ fmtUSD(s.savings.eliminable) }}</strong></span>
        <span><i class="sw opt"></i>Optimizable <strong>{{ fmtUSD(s.savings.optimizable) }}</strong></span>
      </div>
      <p v-if="s.share !== null" class="share">
        Es el <strong>{{ s.share.toFixed(0) }}%</strong> de tu gasto total de 30 días ({{ fmtUSD(s.total) }}).
      </p>
    </div>

    <div class="tiles">
      <button v-for="t in tiles" :key="t.status" type="button" :class="['tile', t.cls]" @click="emit('filter', t.status)" :title="`Filtrar: ${t.label}`">
        <span class="t-label"><component :is="t.icon" :size="15" weight="bold" />{{ t.label }}</span>
        <span class="t-value">{{ t.value || 0 }}</span>
        <span class="t-foot">{{ t.foot }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.card-radar-hero {
  display: grid; grid-template-columns: 1fr; gap: var(--space-6); padding: var(--space-6);
  background: radial-gradient(40rem 22rem at 0% 0%, rgba(var(--series-1-rgb), 0.10), transparent 60%), var(--surface-1);
  border-color: color-mix(in srgb, var(--series-1) 28%, var(--border));
  box-shadow: var(--shadow-lg);
}
@media (min-width: 960px) { .card-radar-hero { grid-template-columns: 1.1fr 1fr; align-items: center; } }
.eyebrow { font-family: var(--mono); font-size: var(--fs-sm); color: var(--text-secondary); }
.big { font-family: var(--mono); font-size: clamp(3rem, 8vw, 5.6rem); font-weight: 500; letter-spacing: -0.05em; line-height: 1; margin-top: var(--space-4); font-variant-numeric: tabular-nums; }
.caption { margin: var(--space-3) 0 var(--space-5); font-size: var(--fs-sm); color: var(--text-muted); max-width: 46ch; }
.split { display: flex; gap: 2px; height: 10px; border-radius: 999px; overflow: hidden; background: var(--surface-2); max-width: 520px; }
.seg { height: 100%; transition: width 1s var(--ease); }
.seg.elim { background: var(--critical); }
.seg.opt { background: var(--warning); }
.legend { display: flex; flex-wrap: wrap; gap: var(--space-5); margin-top: var(--space-3); font-size: var(--fs-xs); color: var(--text-muted); font-family: var(--mono); }
.legend span { display: inline-flex; align-items: center; gap: 6px; }
.legend strong { color: var(--text-primary); font-weight: 600; }
.sw { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
.sw.elim { background: var(--critical); }
.sw.opt { background: var(--warning); }
.share { margin: var(--space-4) 0 0; font-size: var(--fs-sm); color: var(--text-secondary); }
.share strong { color: var(--text-primary); }
.tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-3); }
.tile {
  display: flex; flex-direction: column; align-items: flex-start; gap: 4px; text-align: left;
  padding: 14px 16px; border-radius: var(--radius-md); border: 1px solid var(--border); background: var(--surface-2);
  color: inherit; font: inherit; cursor: pointer; transition: border-color .2s var(--ease), transform .2s var(--ease);
}
.tile:hover { border-color: var(--border-strong); }
.tile:active { transform: scale(0.98); }
.t-label { display: inline-flex; align-items: center; gap: 6px; font-size: var(--fs-xs); color: var(--text-secondary); }
.t-value { font-family: var(--mono); font-size: var(--fs-2xl); font-weight: 500; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
.t-foot { font-size: var(--fs-xs); color: var(--text-muted); }
.tile.crit .t-value, .tile.crit .t-label { color: var(--critical); }
.tile.warn .t-value, .tile.warn .t-label { color: var(--warning); }
.tile.good .t-value, .tile.good .t-label { color: var(--good); }
</style>
