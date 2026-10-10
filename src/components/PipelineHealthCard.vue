<script setup>
import { computed } from 'vue';
import { PhCheckCircle, PhWarning, PhXCircle, PhQuestion, PhHeartbeat } from '@phosphor-icons/vue';

const props = defineProps({ health: { type: Object, required: true } });

const ICONS = { ok: PhCheckCircle, warn: PhWarning, crit: PhXCircle, unknown: PhQuestion };
const LABELS = { ok: 'Todo en orden', warn: 'Revisar', crit: 'Requiere atención', unknown: 'Sin información' };
const overall = computed(() => props.health.level || 'unknown');
</script>

<template>
  <div class="card card-health" id="card-health">
    <h2>
      <span class="title"><PhHeartbeat :size="18" weight="duotone" /> Salud del pipeline</span>
      <span :class="['pill', overall]"><component :is="ICONS[overall]" :size="14" weight="fill" /> {{ LABELS[overall] }}</span>
    </h2>
    <ul class="checks">
      <li v-for="c in health.checks" :key="c.id" :class="c.level">
        <component :is="ICONS[c.level]" class="icon" :size="18" weight="fill" :aria-label="LABELS[c.level]" />
        <div class="body">
          <div class="row"><span class="label">{{ c.label }}</span><span class="value">{{ c.value }}</span></div>
          <p class="hint">{{ c.hint }}</p>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.card-health h2 { justify-content: space-between; align-items: center; }
.title { display: inline-flex; align-items: center; gap: var(--space-2); }
.pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; font-size: var(--fs-xs); font-family: var(--mono); font-weight: 500; }
.pill.ok { background: var(--good-bg); color: var(--good); }
.pill.warn { background: var(--warning-bg); color: var(--warning-text); }
.pill.crit { background: var(--critical-bg); color: var(--critical); }
.pill.unknown { background: var(--surface-2); color: var(--text-muted); }
.checks { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr; gap: var(--space-3); }
@media (min-width: 760px) { .checks { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (min-width: 1100px) { .checks { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
li { display: flex; gap: var(--space-3); padding: 12px 14px; background: var(--surface-2); border-radius: var(--radius-md); border: 1px solid transparent; min-width: 0; }
li.warn { border-color: color-mix(in srgb, var(--warning) 40%, transparent); }
li.crit { border-color: color-mix(in srgb, var(--critical) 45%, transparent); }
.icon { flex: none; margin-top: 2px; }
li.ok .icon { color: var(--good); }
li.warn .icon { color: var(--warning); }
li.crit .icon { color: var(--critical); }
li.unknown .icon { color: var(--text-muted); }
.body { min-width: 0; flex: 1; }
.row { display: flex; justify-content: space-between; gap: var(--space-3); align-items: baseline; }
.label { font-size: var(--fs-sm); color: var(--text-secondary); }
.value { font-family: var(--mono); font-size: var(--fs-sm); font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hint { margin: 2px 0 0; font-size: var(--fs-xs); color: var(--text-muted); overflow-wrap: anywhere; }
</style>
