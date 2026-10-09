<script setup>
import { computed } from 'vue';
import { buildZeroResources } from '../lib/calc.js';

const props = defineProps({ resources: { type: Array, default: () => [] } });
const zero = computed(() => buildZeroResources(props.resources));
</script>

<template>
  <div class="card card-zero">
    <h2>Recursos en $0 <span class="sub">esta semana</span></h2>
    <div v-if="!zero.length" class="empty">Ningún recurso en $0 esta semana.</div>
    <template v-else>
      <div class="zero-grid">
        <div v-for="r in zero" :key="r.resource_group + '::' + r.resource_name" class="zero-item">
          <span class="zero-group">{{ r.resource_group }}</span>
          <span class="zero-name">{{ r.resource_name }}</span>
        </div>
      </div>
      <div class="zero-count">{{ zero.length }} recurso{{ zero.length === 1 ? '' : 's' }} en $0</div>
    </template>
  </div>
</template>

<style scoped>
.zero-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 0 28px; }
.zero-item { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; padding: 7px 0; border-bottom: 1px solid var(--grid); font-size: var(--fs-sm); overflow: hidden; }
.zero-item .zero-group { font-family: var(--mono); color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.zero-item .zero-name { color: var(--text-secondary); font-weight: 550; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: right; }
.zero-count { margin-top: var(--space-3); font-size: var(--fs-xs); color: var(--text-muted); font-family: var(--mono); }
</style>
