<script setup>
import { computed } from 'vue';
import { PhTrendUp, PhTrendDown } from '@phosphor-icons/vue';
import { fmtUSD } from '../lib/format.js';

const props = defineProps({ resources: { type: Array, default: () => [] } });

const SHOWN = 5;
// Solo recursos con cambio medible: variación en dólares, no solo en porcentaje
const moves = computed(() =>
  props.resources
    .filter((r) => typeof r.cost === 'number' && typeof r.prevCost === 'number')
    .map((r) => ({ ...r, diff: r.cost - r.prevCost }))
    .filter((r) => Math.abs(r.diff) >= 0.01)
);
const risers = computed(() => moves.value.filter((r) => r.diff > 0).sort((a, b) => b.diff - a.diff).slice(0, SHOWN));
const fallers = computed(() => moves.value.filter((r) => r.diff < 0).sort((a, b) => a.diff - b.diff).slice(0, SHOWN));

const sign = (n) => (n >= 0 ? '+' : '-') + fmtUSD(Math.abs(n));
const pct = (r) => (r.deltaPct === null || r.deltaPct === undefined ? '' : (r.deltaPct >= 0 ? '+' : '') + r.deltaPct + '%');
</script>

<template>
  <div class="card card-movers">
    <h2>Mayores movimientos <span class="sub">vs semana anterior</span></h2>
    <div v-if="!moves.length" class="empty">Aún no hay comparación con la semana anterior.</div>
    <div v-else class="cols">
      <section>
        <h3 class="up"><PhTrendUp :size="16" weight="bold" /> Subieron</h3>
        <p v-if="!risers.length" class="empty">Ningún recurso subió.</p>
        <ul v-else>
          <li v-for="r in risers" :key="r.resource_group + '::' + r.resource_name">
            <span class="name"><strong>{{ r.resource_name }}</strong><small>{{ r.resource_group }}</small></span>
            <span class="amt up">{{ sign(r.diff) }}<small>{{ pct(r) }}</small></span>
          </li>
        </ul>
      </section>
      <section>
        <h3 class="down"><PhTrendDown :size="16" weight="bold" /> Bajaron</h3>
        <p v-if="!fallers.length" class="empty">Ningún recurso bajó.</p>
        <ul v-else>
          <li v-for="r in fallers" :key="r.resource_group + '::' + r.resource_name">
            <span class="name"><strong>{{ r.resource_name }}</strong><small>{{ r.resource_group }}</small></span>
            <span class="amt down">{{ sign(r.diff) }}<small>{{ pct(r) }}</small></span>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.cols { display: grid; grid-template-columns: 1fr; gap: var(--space-5); }
@media (min-width: 760px) { .cols { grid-template-columns: 1fr 1fr; gap: var(--space-6); } }
h3 { display: flex; align-items: center; gap: var(--space-2); margin: 0 0 var(--space-3); font-size: var(--fs-sm); font-weight: 600; }
h3.up { color: var(--critical); }
h3.down { color: var(--good); }
ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-2); }
li { display: flex; justify-content: space-between; align-items: center; gap: var(--space-3); padding: 10px 12px; background: var(--surface-2); border-radius: var(--radius-md); min-width: 0; }
.name { display: flex; flex-direction: column; min-width: 0; }
.name strong { font-weight: 550; font-size: var(--fs-sm); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.name small { font-family: var(--mono); font-size: var(--fs-xs); color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.amt { display: flex; flex-direction: column; align-items: flex-end; font-family: var(--mono); font-variant-numeric: tabular-nums; font-weight: 600; font-size: var(--fs-sm); white-space: nowrap; }
.amt small { font-size: var(--fs-xs); font-weight: 400; opacity: 0.8; }
.amt.up { color: var(--critical); }
.amt.down { color: var(--good); }
</style>
