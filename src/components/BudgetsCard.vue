<script setup>
import { ref, computed } from 'vue';
import { PhTarget } from '@phosphor-icons/vue';
import { fmtUSD } from '../lib/format.js';
import { buildBudgetRows, summarizeBudgets, referenceLabel, BUDGET_STATUS } from '../lib/budgets.js';

// Presupuesto por proyecto (resource group) con la proyección de cierre del mes.
// Barra tipo bullet: relleno = lo que va del mes, extensión punteada = lo que falta según
// el ritmo de los últimos 28 días, marca vertical = presupuesto.
const props = defineProps({
  projectBudgets: { type: Array, default: () => [] },
  meta: { type: Object, default: null }
});

const rows = computed(() => buildBudgetRows(props.projectBudgets));
const summary = computed(() => summarizeBudgets(rows.value));
const showAll = ref(false);
const shown = computed(() => (showAll.value ? rows.value : rows.value.slice(0, 8)));
const refLabel = computed(() => referenceLabel(props.meta && props.meta.referenceMonths));
const margin = computed(() => (props.meta && props.meta.marginPct) ?? 20);
const monthName = computed(() => (props.meta && props.meta.month
  ? new Date(props.meta.month + '-15T00:00:00Z').toLocaleDateString('es-MX', { month: 'long', timeZone: 'UTC' })
  : 'este mes'));
const hasReference = computed(() => rows.value.some((r) => r.source === 'referencia'));

function aria(r) {
  const b = r.budget ? `, presupuesto ${fmtUSD(r.budget)}` : ', sin presupuesto';
  return `${r.resource_group}: lleva ${fmtUSD(r.mtd)}, proyección ${fmtUSD(r.projection)}${b}`;
}
function verdict(r) {
  if (r.status === 'excedido') return `ya gastó ${fmtUSD(r.mtd - r.budget)} de más`;
  if (r.status === 'en_riesgo') return `+${fmtUSD(r.overBy)} al cierre`;
  if (r.status === 'ok') return r.overBy > 0 ? `al límite (+${fmtUSD(r.overBy)})` : `${fmtUSD(-r.overBy)} de margen`;
  return 'sin referencia todavía';
}
</script>

<template>
  <div class="card card-budgets">
    <h2>
      <span class="title"><PhTarget :size="18" weight="duotone" /> Presupuesto por proyecto</span>
      <span class="sub">proyección al cierre de {{ monthName }}</span>
    </h2>

    <div v-if="!rows.length" class="empty">
      Aún no hay presupuestos por proyecto. Aparecen cuando el workflow de n8n versión 2026-10-13 o posterior publica sus datos.
    </div>
    <template v-else>
      <p :class="['lead', summary.atRisk ? 'risk' : 'calm']">
        <template v-if="summary.atRisk">
          <strong>{{ summary.atRisk }} {{ summary.atRisk === 1 ? 'proyecto va' : 'proyectos van' }}</strong> a cerrar arriba de su presupuesto
          (~{{ fmtUSD(summary.overTotal) }} en total).
        </template>
        <template v-else>Todos los proyectos van dentro de su presupuesto.</template>
        <span v-if="meta && meta.remainingDays !== undefined" class="days"> Faltan {{ meta.remainingDays }} {{ meta.remainingDays === 1 ? 'día' : 'días' }}.</span>
      </p>

      <ul class="rows">
        <li v-for="r in shown" :key="r.resource_group" :class="['row', 'tone-' + BUDGET_STATUS[r.status].tone]">
          <div class="name">
            <strong :title="r.resource_group">{{ r.resource_group }}</strong>
            <span v-if="r.source === 'referencia'" class="src" title="Presupuesto de referencia automático">ref.</span>
          </div>
          <div class="bar" role="img" :aria-label="aria(r)">
            <div class="track">
              <div class="proj" :style="{ width: r.projPct + '%' }"></div>
              <div class="spent" :style="{ width: r.mtdPct + '%' }"></div>
              <div v-if="r.budgetPct !== null" class="tick" :style="{ left: `calc(${r.budgetPct}% - 1px)` }"></div>
            </div>
          </div>
          <div class="nums">
            <span><small>lleva</small> {{ fmtUSD(r.mtd) }}</span>
            <span><small>cierre</small> {{ fmtUSD(r.projection) }}</span>
            <span><small>tope</small> {{ r.budget ? fmtUSD(r.budget) : '—' }}</span>
          </div>
          <div class="state">
            <span :class="['pill', BUDGET_STATUS[r.status].tone]">{{ BUDGET_STATUS[r.status].label }}</span>
            <small>{{ verdict(r) }}</small>
          </div>
        </li>
      </ul>

      <div class="legend" aria-hidden="true">
        <span><i class="lg lg-spent"></i>Lo que va del mes</span>
        <span><i class="lg lg-proj"></i>Proyección al cierre</span>
        <span><i class="lg lg-tick"></i>Presupuesto</span>
      </div>
      <p class="foot">
        <template v-if="hasReference">
          <strong>ref.</strong> = sin presupuesto propio: se usa el promedio de {{ refLabel || 'los meses cerrados' }} +{{ margin }}%.
        </template>
        Los presupuestos propios se fijan en el nodo <em>Configuracion</em> del workflow (<code>projectBudgets</code>).
        <button v-if="rows.length > 8" type="button" class="more" @click="showAll = !showAll">{{ showAll ? 'Ver menos' : `Ver los ${rows.length}` }}</button>
      </p>
    </template>
  </div>
</template>

<style scoped>
.title { display: inline-flex; align-items: center; gap: var(--space-2); }
.lead { margin: 0 0 var(--space-4); font-size: var(--fs-sm); color: var(--text-secondary); }
.lead.risk strong { color: var(--warning-text); }
.lead.calm { color: var(--good); }
.days { color: var(--text-muted); }

.rows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.row {
  display: grid; grid-template-columns: minmax(120px, 190px) minmax(140px, 1fr) 300px 150px;
  align-items: center; gap: var(--space-4); padding: 10px 0; border-bottom: 1px solid var(--grid);
}
.row:last-child { border-bottom: 0; }
.name { display: flex; align-items: center; gap: 6px; min-width: 0; }
.name strong { font-size: var(--fs-sm); font-weight: 550; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.src { font-family: var(--mono); font-size: 10.5px; color: var(--text-muted); border: 1px solid var(--border-strong); border-radius: 5px; padding: 0 4px; flex: none; }

.track { position: relative; height: 12px; border-radius: 999px; background: var(--surface-2); }
.spent, .proj { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 999px; transition: width .8s var(--ease); }
.spent { background: var(--series-1); }
.proj { background: var(--series-1-wash); outline: 1px dashed color-mix(in srgb, var(--series-1) 60%, transparent); outline-offset: -1px; }
.tone-crit .spent { background: var(--critical); }
.tone-crit .proj { background: var(--critical-bg); outline-color: color-mix(in srgb, var(--critical) 60%, transparent); }
.tone-warn .spent { background: var(--warning); }
.tone-warn .proj { background: var(--warning-bg); outline-color: color-mix(in srgb, var(--warning) 60%, transparent); }
.tick { position: absolute; top: -4px; bottom: -4px; width: 2px; border-radius: 2px; background: var(--text-primary); }

.nums { display: flex; gap: var(--space-3); font-family: var(--mono); font-size: var(--fs-xs); font-variant-numeric: tabular-nums; white-space: nowrap; color: var(--text-primary); }
.nums span { flex: 1; text-align: right; }
.nums small { color: var(--text-muted); font-family: var(--sans); margin-right: 2px; }
.state { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
.state small { font-size: var(--fs-xs); color: var(--text-muted); font-family: var(--mono); white-space: nowrap; }
.pill { font-size: 11.5px; font-weight: 600; padding: 2px 8px; border-radius: 999px; white-space: nowrap; }
.pill.crit { color: var(--critical); background: var(--critical-bg); }
.pill.warn { color: var(--warning-text); background: var(--warning-bg); }
.pill.good { color: var(--good); background: var(--good-bg); }
.pill.muted { color: var(--text-muted); background: var(--surface-2); }

.legend { display: flex; flex-wrap: wrap; gap: var(--space-4); margin-top: var(--space-3); font-size: var(--fs-xs); color: var(--text-muted); }
.legend span { display: inline-flex; align-items: center; gap: 6px; }
.lg { display: inline-block; width: 14px; height: 8px; border-radius: 999px; }
.lg-spent { background: var(--series-1); }
.lg-proj { background: var(--series-1-wash); outline: 1px dashed var(--series-1); outline-offset: -1px; }
.lg-tick { width: 2px; height: 12px; border-radius: 2px; background: var(--text-primary); }
.foot { margin: var(--space-3) 0 0; font-size: var(--fs-xs); color: var(--text-muted); }
.foot code { font-family: var(--mono); }
.more { margin-left: var(--space-2); background: none; border: 0; padding: 0; color: var(--series-1); font: inherit; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }

@media (max-width: 960px) {
  .row { grid-template-columns: minmax(110px, 160px) minmax(120px, 1fr) 150px; grid-template-areas: 'name bar state' 'nums nums nums'; row-gap: 4px; }
  .name { grid-area: name; } .bar { grid-area: bar; } .nums { grid-area: nums; justify-content: flex-start; } .state { grid-area: state; }
  .nums span { flex: none; text-align: left; }
}
@media (max-width: 640px) {
  .row { grid-template-columns: 1fr auto; grid-template-areas: 'name state' 'bar bar' 'nums nums'; gap: var(--space-2) var(--space-3); }
  .name { grid-area: name; } .bar { grid-area: bar; } .nums { grid-area: nums; } .state { grid-area: state; }
}
</style>
