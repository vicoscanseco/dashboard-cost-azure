<script setup>
import { fmtUSD } from '../../lib/format.js';
import { prettyType } from '../../lib/radar.js';

// Gasto real (cost_raw_daily) de recursos que el radar no mide: VMs, Container Apps,
// Cosmos, IPs, etc. Sirve para que ningún cargo se quede fuera de la vista.
defineProps({ items: { type: Array, default: () => [] }, total: { type: Number, default: 0 } });
</script>

<template>
  <div class="card card-unmonitored">
    <h2>Gasto no monitoreado <span class="sub">otros tipos de recurso con cargo</span></h2>
    <div v-if="!items.length" class="empty">Todo lo que cobra en la suscripción está cubierto por el radar.</div>
    <template v-else>
      <p class="lead">{{ fmtUSD(total) }} en 30 días vienen de tipos que el radar no clasifica todavía (no hay métricas de uso para ellos).</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Recurso</th><th class="hide-sm">Tipo</th><th class="num">30 días</th><th class="num hide-sm">Mes en curso</th></tr></thead>
          <tbody>
            <tr v-for="u in items" :key="u.resourceGroup + u.name + u.type">
              <td><span class="nm">{{ u.name }}</span><small>{{ u.resourceGroup }}</small></td>
              <td class="hide-sm"><span class="type">{{ prettyType(u.type) }}</span></td>
              <td class="num">{{ fmtUSD(u.last30) }}</td>
              <td class="num hide-sm">{{ fmtUSD(u.mtd) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<style scoped>
.lead { margin: 0 0 var(--space-3); font-size: var(--fs-sm); color: var(--text-secondary); }
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: var(--fs-sm); }
th { text-align: left; font-weight: 500; font-size: var(--fs-xs); color: var(--text-muted); padding: 6px 8px; border-bottom: 1px solid var(--border); }
td { padding: 7px 8px; border-bottom: 1px solid var(--grid); vertical-align: middle; }
td small { display: block; font-family: var(--mono); font-size: var(--fs-xs); color: var(--text-muted); }
.nm { font-weight: 550; }
.type { font-size: var(--fs-xs); font-family: var(--mono); padding: 2px 8px; border-radius: 999px; background: var(--surface-2); color: var(--text-secondary); white-space: nowrap; }
.num { text-align: right; font-family: var(--mono); font-variant-numeric: tabular-nums; white-space: nowrap; }
@media (max-width: 640px) { .hide-sm { display: none; } }
</style>
