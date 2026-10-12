<script setup>
import { computed } from 'vue';
import { PhLightbulb } from '@phosphor-icons/vue';
import { fmtUSD } from '../../lib/format.js';

// Recomendaciones de costo de Azure Advisor. Las que apuntan a un recurso del radar se ven
// en su fila de la tabla; aquí van el total y las que no están ligadas a esos recursos
// (reservas, planes de ahorro, recursos de otros tipos).
const props = defineProps({
  resources: { type: Array, default: () => [] },
  other: { type: Array, default: () => [] },
  total: { type: Number, default: 0 }
});
const onResources = computed(() => props.resources
  .filter((r) => r.advisor && r.advisor.length)
  .flatMap((r) => r.advisor.map((a) => ({ ...a, resource: r.name, resourceGroup: r.resourceGroup }))));
const rows = computed(() => [...onResources.value, ...props.other].sort((a, b) => (b.monthlySavings || 0) - (a.monthlySavings || 0)).slice(0, 12));
</script>

<template>
  <div class="card card-advisor">
    <h2><span class="title"><PhLightbulb :size="18" weight="duotone" /> Azure Advisor</span> <span class="sub">recomendaciones de costo de Microsoft</span></h2>
    <div v-if="!rows.length" class="empty">Advisor no tiene recomendaciones de costo para tu suscripción esta semana.</div>
    <template v-else>
      <p class="lead">Advisor estima <strong>{{ fmtUSD(total) }}/mes</strong> de ahorro en {{ rows.length }} {{ rows.length === 1 ? 'recomendación' : 'recomendaciones' }}.</p>
      <ul>
        <li v-for="(a, i) in rows" :key="i">
          <div class="txt">
            <strong>{{ a.problem || 'Recomendación de costo' }}</strong>
            <small><template v-if="a.resource">{{ a.resource }} · {{ a.resourceGroup }}</template><template v-else-if="a.impactedValue">{{ a.impactedValue }}</template><template v-if="a.solution"> — {{ a.solution }}</template></small>
          </div>
          <span v-if="a.monthlySavings" class="amt">{{ fmtUSD(a.monthlySavings) }}<small>/mes</small></span>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.title { display: inline-flex; align-items: center; gap: var(--space-2); }
.lead { margin: 0 0 var(--space-3); font-size: var(--fs-sm); color: var(--text-secondary); }
.lead strong { color: var(--good); font-family: var(--mono); }
ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-2); }
li { display: flex; justify-content: space-between; align-items: center; gap: var(--space-3); padding: 10px 12px; background: var(--surface-2); border-radius: var(--radius-md); }
.txt { display: flex; flex-direction: column; min-width: 0; }
.txt strong { font-size: var(--fs-sm); font-weight: 550; }
.txt small { font-size: var(--fs-xs); color: var(--text-muted); }
.amt { font-family: var(--mono); font-weight: 600; font-size: var(--fs-sm); color: var(--good); white-space: nowrap; }
.amt small { color: var(--text-muted); font-weight: 400; }
</style>
