<script setup>
import { computed, ref } from 'vue';
import { PhMagnifyingGlass, PhCaretUp, PhCaretDown } from '@phosphor-icons/vue';
import { fmtUSD } from '../lib/format.js';

const props = defineProps({
  resources: { type: Array, default: () => [] },
  resourceComparisons: { type: Array, default: () => [] }
});

const SHOWN = 10;
const query = ref('');
const sortKey = ref('cost');
const sortDir = ref('desc');

const all = computed(() => {
  const deltaByKey = {};
  props.resourceComparisons.forEach((r) => { deltaByKey[r.resource_group + '::' + r.resource_name] = r.deltaPct; });
  return props.resources.map((r) => ({ ...r, deltaPct: deltaByKey[r.resource_group + '::' + r.resource_name] }));
});

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  const list = q ? all.value.filter((r) => (r.resource_group + ' ' + r.resource_name).toLowerCase().includes(q)) : all.value;
  const dir = sortDir.value === 'asc' ? 1 : -1;
  const k = sortKey.value;
  return [...list].sort((a, b) => {
    const av = a[k], bv = b[k];
    // los sin dato de variación siempre al final
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    return typeof av === 'string' ? dir * av.localeCompare(bv) : dir * (av - bv);
  });
});
const rows = computed(() => filtered.value.slice(0, SHOWN));

function sortBy(key) {
  if (sortKey.value === key) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  else { sortKey.value = key; sortDir.value = key === 'resource_group' || key === 'resource_name' ? 'asc' : 'desc'; }
}
const ariaSort = (key) => (sortKey.value === key ? (sortDir.value === 'asc' ? 'ascending' : 'descending') : 'none');

function deltaColor(d) {
  if (d === null || d === undefined) return 'var(--text-muted)';
  if (d > 0.05) return 'var(--critical)';
  if (d < -0.05) return 'var(--good)';
  return 'var(--text-muted)';
}

const cols = [
  { key: 'resource_group', label: 'Grupo' },
  { key: 'resource_name', label: 'Recurso' },
  { key: 'cost', label: 'Costo', num: true },
  { key: 'deltaPct', label: 'Var. semana', num: true }
];
</script>

<template>
  <div class="card card-resources">
    <h2>Top recursos <span v-if="resources.length" class="sub">{{ rows.length }} de {{ filtered.length }}</span></h2>
    <div v-if="!resources.length" class="empty">Sin datos.</div>
    <template v-else>
      <label class="search">
        <span class="sr-only">Buscar recurso o grupo</span>
        <PhMagnifyingGlass :size="16" weight="bold" class="search-icon" />
        <input v-model="query" type="search" placeholder="Buscar recurso o grupo" autocomplete="off" />
      </label>
      <div v-if="!rows.length" class="empty">Ningún recurso coincide con "{{ query }}".</div>
      <div v-else class="table-scroll">
        <table>
          <thead>
            <tr>
              <th v-for="c in cols" :key="c.key" :aria-sort="ariaSort(c.key)" :class="{ num: c.num }">
                <button type="button" class="sort" @click="sortBy(c.key)">
                  {{ c.label }}
                  <component :is="sortDir === 'asc' ? PhCaretUp : PhCaretDown" v-if="sortKey === c.key" :size="12" weight="bold" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in rows" :key="r.resource_group + '::' + r.resource_name">
              <td>{{ r.resource_group }}</td>
              <td>{{ r.resource_name }}</td>
              <td class="num strong">{{ fmtUSD(r.cost) }}</td>
              <td class="num" :style="{ color: deltaColor(r.deltaPct) }">
                {{ r.deltaPct !== null && r.deltaPct !== undefined ? (r.deltaPct >= 0 ? '+' : '') + r.deltaPct + '%' : '-' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<style scoped>
.search { position: relative; display: block; margin-bottom: var(--space-4); }
.search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none; }
.search input {
  width: 100%; height: 40px; padding: 0 12px 0 36px;
  background: var(--surface-2); color: var(--text-primary);
  border: 1px solid var(--border); border-radius: var(--radius-md);
  font: inherit; font-size: var(--fs-sm);
  transition: border-color .2s var(--ease);
}
.search input::placeholder { color: var(--text-muted); }
.search input:focus { outline: none; border-color: var(--series-1); }
.table-scroll { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: var(--fs-sm); }
th, td { text-align: left; padding: 11px 8px; border-bottom: 1px solid var(--grid); }
th { padding: 0 0 4px; }
th.num, td.num { text-align: right; }
td.num { font-family: var(--mono); font-variant-numeric: tabular-nums; color: var(--text-secondary); }
td.strong { color: var(--text-primary); font-weight: 600; }
tbody tr:hover td { background: var(--surface-2); }
tbody tr:last-child td { border-bottom: none; }
.sort {
  display: inline-flex; align-items: center; gap: 4px; width: 100%;
  padding: 8px; background: none; border: 0; cursor: pointer;
  color: var(--text-muted); font: inherit; font-size: 11.5px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.05em;
  transition: color .2s var(--ease);
}
th.num .sort { justify-content: flex-end; }
.sort:hover, th[aria-sort="ascending"] .sort, th[aria-sort="descending"] .sort { color: var(--text-primary); }
</style>
