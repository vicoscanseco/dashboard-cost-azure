<script setup>
import { computed } from 'vue';
import { PhMoonStars, PhWarning } from '@phosphor-icons/vue';
import { fmtUSD } from '../../lib/format.js';

// Proyectos (resource groups) donde ningún recurso monitoreado está activo ni en bajo uso.
// El costo es TODO lo que cobró el RG en 30 días, incluyendo lo que el radar no mide.
const props = defineProps({ projects: { type: Array, default: () => [] } });
const emit = defineEmits(['select']);
const total = computed(() => props.projects.reduce((s, p) => s + (p.last30 || 0), 0));
const shown = computed(() => props.projects.slice(0, 10));
</script>

<template>
  <div class="card card-dormant">
    <h2><span class="title"><PhMoonStars :size="18" weight="duotone" /> Proyectos dormidos</span> <span class="sub">nada activo en el resource group</span></h2>
    <div v-if="!projects.length" class="empty">Ningún proyecto está completamente sin uso esta semana.</div>
    <template v-else>
      <p class="lead">Borrar estos resource groups completos ahorraría hasta <strong>{{ fmtUSD(total) }}/mes</strong>.</p>
      <ul>
        <li v-for="p in shown" :key="p.resourceGroup">
          <button type="button" @click="emit('select', p.resourceGroup)" :title="`Ver recursos de ${p.resourceGroup}`">
            <span class="name"><strong>{{ p.resourceGroup }}</strong><small>{{ p.resources }} recurso{{ p.resources === 1 ? '' : 's' }} monitoreado{{ p.resources === 1 ? '' : 's' }}</small></span>
            <span class="amt">{{ fmtUSD(p.last30) }}<small>/30 días</small></span>
          </button>
          <p v-if="p.unmonitoredLast30 >= 0.5" class="warn">
            <PhWarning :size="13" weight="fill" /> {{ fmtUSD(p.unmonitoredLast30) }} vienen de recursos que el radar no mide; revísalos antes de borrar.
          </p>
        </li>
      </ul>
      <p v-if="projects.length > shown.length" class="more">y {{ projects.length - shown.length }} más</p>
    </template>
  </div>
</template>

<style scoped>
.title { display: inline-flex; align-items: center; gap: var(--space-2); }
.lead { margin: 0 0 var(--space-4); font-size: var(--fs-sm); color: var(--text-secondary); }
.lead strong { color: var(--critical); font-family: var(--mono); }
ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-2); }
li { background: var(--surface-2); border-radius: var(--radius-md); }
li button { display: flex; justify-content: space-between; align-items: center; gap: var(--space-3); width: 100%; padding: 10px 12px; background: none; border: 0; color: inherit; font: inherit; text-align: left; cursor: pointer; border-radius: var(--radius-md); }
li button:hover { background: color-mix(in srgb, var(--series-1) 6%, transparent); }
.name { display: flex; flex-direction: column; min-width: 0; }
.name strong { font-size: var(--fs-sm); font-weight: 550; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.name small { font-size: var(--fs-xs); color: var(--text-muted); }
.amt { font-family: var(--mono); font-weight: 600; font-size: var(--fs-sm); white-space: nowrap; display: flex; flex-direction: column; align-items: flex-end; }
.amt small { font-weight: 400; color: var(--text-muted); font-size: var(--fs-xs); }
.warn { display: flex; align-items: center; gap: 6px; margin: 0; padding: 0 12px 10px; font-size: var(--fs-xs); color: var(--warning-text); }
.more { margin: var(--space-3) 0 0; font-size: var(--fs-xs); color: var(--text-muted); font-family: var(--mono); }
</style>
