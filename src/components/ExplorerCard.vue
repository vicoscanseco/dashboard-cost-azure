<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { PhCaretRight, PhMagnifyingGlass } from '@phosphor-icons/vue';
import { fmtUSD, capitalize } from '../lib/format.js';
import { listMonths, monthTotals, buildExplorerTree, monthLabel } from '../lib/history.js';

// Explorador histórico: elige un mes y baja de proyecto (resource group) a recurso y a
// servicio, con la comparación contra el mes anterior en cada nivel.
const props = defineProps({
  rows: { type: Array, default: () => [] },
  currentMonth: { type: String, default: null },
  focus: { type: Object, default: null }
});

const months = computed(() => listMonths(props.rows));
const totals = computed(() => monthTotals(props.rows));
const maxTotal = computed(() => Math.max(...Object.values(totals.value), 1));
const month = ref(null);
watch(() => months.value.join(','), () => {
  if (!month.value || !months.value.includes(month.value)) {
    const closed = months.value.filter((m) => m !== props.currentMonth);
    month.value = closed[closed.length - 1] || months.value[months.value.length - 1] || null;
  }
}, { immediate: true });

const tree = computed(() => (month.value ? buildExplorerTree(props.rows, month.value) : null));
const open = ref(new Set());
const toggle = (k) => { const s = new Set(open.value); s.has(k) ? s.delete(k) : s.add(k); open.value = s; };
const isOpen = (k) => open.value.has(k);

const q = ref('');
const match = (s) => s.toLowerCase().includes(q.value.trim().toLowerCase());
const groups = computed(() => {
  if (!tree.value) return [];
  if (!q.value.trim()) return tree.value.groups;
  return tree.value.groups
    .map((g) => {
      if (match(g.key)) return g;
      const kids = g.children.filter((r) => match(r.key) || r.children.some((s) => match(s.key)));
      return kids.length ? { ...g, children: kids, _forceOpen: true } : null;
    })
    .filter(Boolean);
});

const signed = (n) => (Math.abs(n) < 0.005 ? '—' : (n > 0 ? '+' : '−') + fmtUSD(Math.abs(n)));
const deltaClass = (n) => (Math.abs(n) < 0.005 ? '' : n > 0 ? 'up' : 'down');
const chip = (m) => capitalize(monthLabel(m, { month: 'short', year: '2-digit' }));

// Clic desde "Costo por proyecto": abre ese proyecto y lo trae a la vista
const rootEl = ref(null);
watch(() => props.focus, async (f) => {
  if (!f || !f.key) return;
  const k = f.key;
  q.value = '';
  open.value = new Set([...open.value, 'g:' + k]);
  await nextTick();
  const row = rootEl.value && rootEl.value.querySelector(`[data-key="${CSS.escape('g:' + k)}"]`);
  if (rootEl.value) rootEl.value.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (row) { row.classList.remove('flash-row'); void row.offsetWidth; row.classList.add('flash-row'); }
});
</script>

<template>
  <div ref="rootEl" id="card-explorer" class="card card-explorer">
    <h2>Explorador histórico <span class="sub">proyecto → recurso → servicio</span></h2>
    <div v-if="!months.length" class="empty">Aún no hay detalle mensual. Aparecerá cuando el workflow publique monthlyDetail.</div>
    <template v-else>
      <div class="months" role="tablist" aria-label="Mes">
        <button
          v-for="m in months" :key="m" type="button" role="tab" :aria-selected="m === month"
          :class="['month', { on: m === month }]" @click="month = m"
        >
          <span class="m-bar"><span :style="{ height: Math.max(6, (totals[m] / maxTotal) * 100) + '%' }"></span></span>
          <span class="m-label">{{ chip(m) }}<template v-if="m === currentMonth">*</template></span>
          <span class="m-value">{{ fmtUSD(totals[m]) }}</span>
        </button>
      </div>

      <div v-if="tree" class="head">
        <div>
          <div class="h-title">{{ capitalize(monthLabel(tree.month)) }}<span v-if="tree.month === currentMonth" class="partial"> · en curso</span></div>
          <div class="h-sub">
            {{ fmtUSD(tree.total) }}
            <span v-if="tree.prevTotal > 0" :class="deltaClass(tree.total - tree.prevTotal)">
              {{ signed(tree.total - tree.prevTotal) }} vs {{ monthLabel(tree.prev, { month: 'long' }) }}
            </span>
          </div>
        </div>
        <label class="search">
          <PhMagnifyingGlass :size="16" />
          <input v-model="q" type="search" placeholder="Buscar proyecto, recurso o servicio" aria-label="Buscar en el explorador" />
        </label>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Nombre</th><th class="num">Costo</th><th class="num">vs mes ant.</th><th class="num hide-sm">Peso</th></tr>
          </thead>
          <tbody>
            <template v-for="g in groups" :key="g.key">
              <tr class="lvl-0" :data-key="'g:' + g.key" @click="toggle('g:' + g.key)">
                <td><div class="cell">
                  <button type="button" class="tg" :aria-expanded="isOpen('g:' + g.key) || !!g._forceOpen" :aria-label="'Expandir ' + g.key" @click.stop="toggle('g:' + g.key)">
                    <PhCaretRight :size="14" weight="bold" :class="{ rot: isOpen('g:' + g.key) || g._forceOpen }" />
                  </button>
                  <strong>{{ g.key }}</strong>
                  <span class="count">{{ g.children.length }}</span>
                </div></td>
                <td class="num">{{ fmtUSD(g.cost) }}</td>
                <td :class="['num', deltaClass(g.delta)]">{{ signed(g.delta) }}</td>
                <td class="num hide-sm"><span class="share"><i :style="{ width: Math.min(100, g.share) + '%' }"></i></span>{{ g.share.toFixed(1) }}%</td>
              </tr>
              <template v-if="isOpen('g:' + g.key) || g._forceOpen">
                <template v-for="r in g.children" :key="g.key + '/' + r.key">
                  <tr class="lvl-1" @click="toggle('r:' + g.key + '/' + r.key)">
                    <td><div class="cell">
                      <button type="button" class="tg" :aria-expanded="isOpen('r:' + g.key + '/' + r.key)" :aria-label="'Expandir ' + r.key" @click.stop="toggle('r:' + g.key + '/' + r.key)">
                        <PhCaretRight :size="13" weight="bold" :class="{ rot: isOpen('r:' + g.key + '/' + r.key) }" />
                      </button>
                      {{ r.key }}
                    </div></td>
                    <td class="num">{{ fmtUSD(r.cost) }}</td>
                    <td :class="['num', deltaClass(r.delta)]">{{ signed(r.delta) }}</td>
                    <td class="num hide-sm">{{ r.share.toFixed(1) }}%</td>
                  </tr>
                  <template v-if="isOpen('r:' + g.key + '/' + r.key)">
                    <tr v-for="s in r.children" :key="g.key + '/' + r.key + '/' + s.key" class="lvl-2">
                      <td>{{ s.key }}</td>
                      <td class="num">{{ fmtUSD(s.cost) }}</td>
                      <td :class="['num', deltaClass(s.delta)]">{{ signed(s.delta) }}</td>
                      <td class="num hide-sm">{{ s.share.toFixed(1) }}%</td>
                    </tr>
                  </template>
                </template>
              </template>
            </template>
            <tr v-if="!groups.length"><td colspan="4" class="empty">Sin resultados.</td></tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<style scoped>
.months { display: flex; gap: var(--space-2); overflow-x: auto; padding-bottom: var(--space-2); scrollbar-width: thin; }
.month {
  flex: 0 0 auto; display: grid; grid-template-rows: 40px auto auto; justify-items: center; gap: 4px;
  min-width: 74px; padding: 8px 8px 10px; border-radius: var(--radius-md);
  background: var(--surface-2); border: 1px solid transparent; color: var(--text-secondary); font: inherit; cursor: pointer;
  transition: border-color .2s var(--ease), background .2s var(--ease);
}
.month:hover { border-color: var(--border-strong); }
.month.on { border-color: var(--series-1); background: color-mix(in srgb, var(--series-1) 10%, var(--surface-2)); color: var(--text-primary); }
.m-bar { width: 14px; height: 40px; display: flex; align-items: flex-end; background: color-mix(in srgb, var(--text-muted) 14%, transparent); border-radius: 4px; overflow: hidden; }
.m-bar span { width: 100%; background: var(--series-1); border-radius: 4px 4px 0 0; opacity: .55; }
.month.on .m-bar span { opacity: 1; }
.m-label { font-size: var(--fs-xs); font-weight: 600; }
.m-value { font-size: 11px; font-family: var(--mono); color: var(--text-muted); }
.head { display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: var(--space-3); margin: var(--space-4) 0 var(--space-3); }
.h-title { font-size: var(--fs-lg); font-weight: 600; }
.partial { color: var(--warning-text); font-size: var(--fs-sm); font-weight: 400; }
.h-sub { font-family: var(--mono); font-size: var(--fs-sm); color: var(--text-secondary); display: flex; gap: var(--space-3); flex-wrap: wrap; }
.search { display: flex; align-items: center; gap: var(--space-2); height: 38px; padding: 0 12px; border: 1px solid var(--border-strong); background: var(--surface-2); border-radius: var(--radius-md); color: var(--text-muted); min-width: min(320px, 100%); }
.search input { border: 0; outline: 0; background: transparent; color: var(--text-primary); font: inherit; font-size: var(--fs-sm); width: 100%; }
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: var(--fs-sm); }
th { text-align: left; font-weight: 500; font-size: var(--fs-xs); color: var(--text-muted); padding: 6px 8px; border-bottom: 1px solid var(--border); }
td { padding: 7px 8px; border-bottom: 1px solid var(--grid); vertical-align: middle; }
.num { text-align: right; font-family: var(--mono); font-variant-numeric: tabular-nums; white-space: nowrap; }
.lvl-0, .lvl-1 { cursor: pointer; }
.lvl-0:hover, .lvl-1:hover { background: var(--surface-2); }
.cell { display: flex; align-items: center; gap: var(--space-2); min-width: 0; }
.lvl-1 td:first-child { padding-left: 34px; color: var(--text-secondary); }
.lvl-2 td:first-child { padding-left: 68px; color: var(--text-muted); font-size: var(--fs-xs); }
.lvl-2 td { font-size: var(--fs-xs); color: var(--text-muted); }
.tg { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border: 0; border-radius: 6px; background: transparent; color: var(--text-muted); cursor: pointer; flex: none; }
.tg:hover { background: var(--surface-1); color: var(--text-primary); }
.tg svg { transition: transform .2s var(--ease); }
.tg svg.rot { transform: rotate(90deg); }
.count { font-family: var(--mono); font-size: 11px; color: var(--text-muted); background: var(--surface-2); padding: 1px 7px; border-radius: 999px; }
.share { display: inline-block; width: 48px; height: 5px; margin-right: 8px; vertical-align: middle; background: var(--surface-2); border-radius: 999px; overflow: hidden; }
.share i { display: block; height: 100%; background: var(--series-1); border-radius: 999px; }
.up { color: var(--critical); }
.down { color: var(--good); }
.flash-row { animation: rowflash 1.6s var(--ease); }
@keyframes rowflash { 0%, 50% { background: color-mix(in srgb, var(--series-1) 20%, transparent); } 100% { background: transparent; } }
@media (max-width: 640px) { .hide-sm { display: none; } .lvl-2 td:first-child { padding-left: 48px; } }
</style>
