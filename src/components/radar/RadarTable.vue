<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { PhDownloadSimple, PhMagnifyingGlass } from '@phosphor-icons/vue';
import { fmtUSD } from '../../lib/format.js';
import { STATUS, TYPE_GROUPS, CATEGORY_LABEL, metricSummary, filterResources, sortResources, historyFor, buildCsv, cost30 } from '../../lib/radar.js';

const props = defineProps({
  resources: { type: Array, default: () => [] },
  history: { type: Array, default: () => [] },
  weeks: { type: Array, default: () => [] },
  // filtros que llegan desde otras tarjetas: { status?, q?, t } (t fuerza el cambio)
  preset: { type: Object, default: null }
});

const status = ref('all');
const type = ref('all');
const q = ref('');
const sort = ref('priority');
const showAll = ref(false);
const showIgnored = ref(false);
const ignoredCount = computed(() => props.resources.filter((r) => r.ignored).length);
const PAGE = 25;

const rootEl = ref(null);
watch(() => props.preset, async (p) => {
  if (!p) return;
  if (p.status !== undefined) status.value = p.status;
  if (p.q !== undefined) q.value = p.q;
  type.value = 'all';
  await nextTick();
  rootEl.value && rootEl.value.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

const filtered = computed(() => sortResources(filterResources(props.resources, { status: status.value, type: type.value, q: q.value, showIgnored: showIgnored.value }), sort.value));
const rows = computed(() => (showAll.value ? filtered.value : filtered.value.slice(0, PAGE)));
const countBy = (s) => props.resources.filter((r) => r.status === s && !r.ignored).length;
const liveCount = computed(() => props.resources.filter((r) => !r.ignored).length);
const filteredCost = computed(() => filtered.value.reduce((s, r) => s + (cost30(r) || 0), 0));

function spark(r) {
  const vals = r.cost && Array.isArray(r.cost.weekly) ? r.cost.weekly : [];
  if (vals.length < 2 || !vals.some((v) => v > 0)) return null;
  const W = 84, H = 24, max = Math.max(...vals, 0.01);
  return vals.map((v, i) => `${i ? 'L' : 'M'}${((W * i) / (vals.length - 1)).toFixed(1)},${(H - 2 - ((H - 4) * v) / max).toFixed(1)}`).join(' ');
}

function exportCsv() {
  const blob = new Blob([buildCsv(filtered.value)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `radar-azure-${status.value === 'all' ? 'todos' : status.value}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <div ref="rootEl" class="card card-radar-table" id="card-radar-table">
    <h2>Recursos monitoreados <span class="sub">{{ resources.length }} recursos · costo real de cost_raw_daily</span></h2>

    <div class="toolbar">
      <div class="chips" role="radiogroup" aria-label="Estado">
        <button type="button" role="radio" :aria-checked="status === 'all'" :class="['chip', { on: status === 'all' }]" @click="status = 'all'">Todos <small>{{ liveCount }}</small></button>
        <button v-for="(s, k) in STATUS" :key="k" type="button" role="radio" :aria-checked="status === k" :class="['chip', k, { on: status === k }]" @click="status = k">
          <i class="dot"></i>{{ s.label }} <small>{{ countBy(k) }}</small>
        </button>
      </div>
      <div class="chips" role="radiogroup" aria-label="Tipo">
        <button type="button" role="radio" :aria-checked="type === 'all'" :class="['chip', { on: type === 'all' }]" @click="type = 'all'">Todos los tipos</button>
        <button v-for="(g, k) in TYPE_GROUPS" :key="k" type="button" role="radio" :aria-checked="type === k" :class="['chip', { on: type === k }]" @click="type = k">{{ g.label }}</button>
      </div>
      <div class="row2">
        <label class="search">
          <PhMagnifyingGlass :size="16" />
          <input v-model="q" type="search" placeholder="Buscar recurso, resource group o SKU" aria-label="Buscar recursos" />
        </label>
        <label class="sort">Ordenar
          <select v-model="sort">
            <option value="priority">Prioridad</option>
            <option value="cost">Costo 30 días</option>
            <option value="name">Nombre</option>
          </select>
        </label>
        <label v-if="ignoredCount" class="ign"><input v-model="showIgnored" type="checkbox" /> Ver ignorados ({{ ignoredCount }})</label>
        <button type="button" class="export" @click="exportCsv"><PhDownloadSimple :size="16" weight="bold" /> CSV</button>
      </div>
    </div>

    <p class="meta">{{ filtered.length }} recurso{{ filtered.length === 1 ? '' : 's' }} · {{ fmtUSD(filteredCost) }} en 30 días</p>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Recurso</th><th>Estado</th><th class="hide-md">Métrica clave</th>
            <th class="num">Costo 30 días</th><th class="hide-md">Tendencia</th><th>Acción</th><th class="hide-sm">Historial</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id">
            <td class="res">
              <strong>{{ r.name }}</strong>
              <small>{{ CATEGORY_LABEL[r.category] || r.category }}<template v-if="r.sku"> · {{ r.sku }}</template> · {{ r.resourceGroup }}</small>
            </td>
            <td>
              <span :class="['pill', r.status]">{{ STATUS[r.status]?.label || r.status }}</span>
              <small v-if="r.weeksInStatus > 1" class="weeks">{{ r.weeksInStatus }} sem.</small>
            </td>
            <td class="hide-md metric">
              <template v-if="metricSummary(r).label"><span class="m-label">{{ metricSummary(r).label }}</span></template>
              <strong v-if="metricSummary(r).value">{{ metricSummary(r).value }}</strong>
              <small v-if="metricSummary(r).extra">{{ metricSummary(r).extra }}</small>
            </td>
            <td class="num cost">
              <strong>{{ cost30(r) === null ? (r.monthlyCost != null ? fmtUSD(r.monthlyCost) : '—') : fmtUSD(cost30(r)) }}</strong>
              <small v-if="r.cost">mes {{ fmtUSD(r.cost.mtd) }} · ant. {{ fmtUSD(r.cost.lastMonth) }}</small>
              <small v-if="r.appsCost && r.appsCost.last30 > 0" class="apps">incluye {{ fmtUSD(r.appsCost.last30) }} de sus apps</small>
            </td>
            <td class="hide-md">
              <svg v-if="spark(r)" class="spark" viewBox="0 0 84 24" preserveAspectRatio="none" role="img" :aria-label="`Costo semanal de ${r.name}`"><path :d="spark(r)" fill="none" stroke="var(--series-1)" stroke-width="1.6" vector-effect="non-scaling-stroke" /></svg>
              <span v-else class="na">—</span>
            </td>
            <td class="action">
              <span class="act" :data-action="r.recommendedAction">{{ r.recommendedAction || '—' }}</span>
              <small v-if="r.actionHint">{{ r.actionHint }}</small>
              <span v-if="r.skuRecommendation" class="rec" :title="r.skuRecommendation.note || ''">
                {{ r.skuRecommendation.from }} → {{ r.skuRecommendation.to }}: ahorras ~{{ fmtUSD(r.skuRecommendation.monthlySavings) }}/mes<template v-if="r.skuRecommendation.source === 'estimado'"> (estimado)</template>
              </span>
              <small v-if="r.skuRecommendation && r.skuRecommendation.note" class="note">{{ r.skuRecommendation.note }}</small>
              <small v-if="r.serverlessHint" class="sv">{{ r.serverlessHint }}</small>
              <small v-for="(a, i) in (r.advisor || [])" :key="i" class="adv">Advisor: {{ a.problem }}<template v-if="a.monthlySavings"> (~{{ fmtUSD(a.monthlySavings) }}/mes)</template></small>
            </td>
            <td class="hide-sm">
              <span class="strip">
                <i v-for="h in historyFor(history, r.id)" :key="h.snapshot_date" :class="['sq', h.status]" :title="`${h.snapshot_date}: ${STATUS[h.status]?.label || h.status}`"></i>
              </span>
            </td>
          </tr>
          <tr v-if="!rows.length"><td colspan="7" class="empty">Ningún recurso con esos filtros.</td></tr>
        </tbody>
      </table>
    </div>
    <button v-if="filtered.length > PAGE" type="button" class="more" @click="showAll = !showAll">
      {{ showAll ? 'Ver menos' : `Ver los ${filtered.length}` }}
    </button>
  </div>
</template>

<style scoped>
.toolbar { display: flex; flex-direction: column; gap: var(--space-3); margin-bottom: var(--space-3); }
.chips { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.chip {
  display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border-radius: 999px;
  border: 1px solid var(--border); background: var(--surface-2); color: var(--text-secondary);
  font: inherit; font-size: var(--fs-xs); cursor: pointer; transition: border-color .2s var(--ease), color .2s var(--ease);
}
.chip small { font-family: var(--mono); color: var(--text-muted); }
.chip:hover { border-color: var(--border-strong); color: var(--text-primary); }
.chip.on { border-color: var(--series-1); color: var(--text-primary); background: color-mix(in srgb, var(--series-1) 10%, var(--surface-2)); }
.dot { width: 7px; height: 7px; border-radius: 50%; background: var(--text-muted); display: inline-block; }
.chip.sin_uso .dot { background: var(--critical); }
.chip.bajo_uso .dot { background: var(--warning); }
.chip.activo .dot { background: var(--good); }
.row2 { display: flex; flex-wrap: wrap; gap: var(--space-3); align-items: center; }
.search { flex: 1; min-width: 220px; display: flex; align-items: center; gap: var(--space-2); height: 38px; padding: 0 12px; border: 1px solid var(--border-strong); background: var(--surface-2); border-radius: var(--radius-md); color: var(--text-muted); }
.search input { border: 0; outline: 0; background: transparent; color: var(--text-primary); font: inherit; font-size: var(--fs-sm); width: 100%; }
.sort { display: inline-flex; align-items: center; gap: var(--space-2); font-size: var(--fs-xs); color: var(--text-muted); font-family: var(--mono); }
.sort select { height: 38px; padding: 0 10px; border-radius: var(--radius-md); border: 1px solid var(--border-strong); background: var(--surface-2); color: var(--text-primary); font: inherit; font-size: var(--fs-sm); font-family: var(--sans); }
.export { display: inline-flex; align-items: center; gap: 6px; height: 38px; padding: 0 14px; border-radius: var(--radius-md); border: 1px solid var(--series-1); background: transparent; color: var(--series-1); font: inherit; font-size: var(--fs-sm); font-weight: 600; cursor: pointer; }
.export:hover { background: var(--series-1); color: var(--on-series); }
.meta { margin: 0 0 var(--space-2); font-size: var(--fs-xs); color: var(--text-muted); font-family: var(--mono); }
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: var(--fs-sm); }
th { text-align: left; font-weight: 500; font-size: var(--fs-xs); color: var(--text-muted); padding: 8px; border-bottom: 1px solid var(--border); white-space: nowrap; }
td { padding: 10px 8px; border-bottom: 1px solid var(--grid); vertical-align: middle; }
td small { display: block; font-size: var(--fs-xs); color: var(--text-muted); }
.res strong { font-weight: 600; }
.res small { font-family: var(--mono); }
.num { text-align: right; font-family: var(--mono); font-variant-numeric: tabular-nums; white-space: nowrap; }
.cost strong { font-size: var(--fs-sm); }
.cost .apps { color: var(--warning-text); }
.metric { font-family: var(--mono); font-size: var(--fs-xs); color: var(--text-secondary); }
.metric .m-label { display: block; color: var(--text-muted); font-family: var(--sans); }
.metric strong { font-size: var(--fs-sm); color: var(--text-primary); }
.pill { display: inline-flex; align-items: center; gap: 6px; font-family: var(--mono); font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 999px; white-space: nowrap; background: var(--surface-2); color: var(--text-muted); }
.pill::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.pill.sin_uso { background: var(--critical-bg); color: var(--critical); }
.pill.bajo_uso { background: var(--warning-bg); color: var(--warning-text); }
.pill.activo { background: var(--good-bg); color: var(--good); }
.weeks { margin-top: 4px; font-family: var(--mono); }
.spark { width: 84px; height: 24px; display: block; }
.na { color: var(--text-muted); }
.action { min-width: 180px; max-width: 280px; }
.act { display: inline-block; font-family: var(--mono); font-size: 11px; padding: 2px 9px; border-radius: 999px; border: 1px solid var(--border-strong); color: var(--text-secondary); white-space: nowrap; }
.act[data-action="Eliminar"] { color: var(--critical); border-color: var(--critical); }
.act[data-action="Revisar"], .act[data-action="Bajar de tier"], .act[data-action="Bajar a F1 o eliminar"] { color: var(--warning-text); border-color: var(--warning); }
.act[data-action="Mantener"] { color: var(--good); border-color: var(--good); }
.act[data-action="Desasignar"] { color: var(--critical); border-color: var(--critical); }
.act[data-action="Ignorado"] { color: var(--text-muted); border-style: dashed; }
.action small { margin-top: 4px; line-height: 1.35; }
.rec { display: inline-block; margin-top: 6px; font-family: var(--mono); font-size: 11px; font-weight: 600; color: var(--good); background: var(--good-bg); padding: 2px 8px; border-radius: 6px; }
.action .sv { color: var(--series-1); }
.action .adv { color: var(--text-secondary); }
.ign { display: inline-flex; align-items: center; gap: 6px; font-size: var(--fs-xs); color: var(--text-muted); font-family: var(--mono); cursor: pointer; }
.strip { display: inline-flex; gap: 3px; }
.sq { width: 9px; height: 9px; border-radius: 2px; background: var(--border-strong); display: inline-block; }
.sq.activo { background: var(--good); }
.sq.bajo_uso { background: var(--warning); }
.sq.sin_uso { background: var(--critical); }
.more { margin-top: var(--space-3); background: none; border: 0; padding: 0; color: var(--series-1); font: inherit; font-size: var(--fs-sm); cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
@media (max-width: 1100px) { .hide-md { display: none; } }
@media (max-width: 640px) { .hide-sm { display: none; } .action { min-width: 120px; } }
</style>
