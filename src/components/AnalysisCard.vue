<script setup>
import { computed } from 'vue';
import { mdLite } from '../lib/md.js';

const props = defineProps({ text: { type: String, default: '' } });
const html = computed(() => (props.text && props.text.trim() ? mdLite(props.text.trim()) : null));
</script>

<template>
  <div class="card card-analysis">
    <h2>Análisis <span class="sub">Hermes</span></h2>
    <div v-if="!html" class="empty">Sin análisis disponible.</div>
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div v-else class="analysis-body" v-html="html"></div>
  </div>
</template>

<style scoped>
.card-analysis { display: flex; flex-direction: column; min-height: 0; }
.analysis-body { font-size: var(--fs-sm); line-height: 1.7; color: var(--text-secondary); max-height: 420px; overflow-y: auto; padding-right: 8px; flex: 1; }
.analysis-body :deep(p) { margin: 0 0 12px; }
.analysis-body :deep(p:last-child) { margin-bottom: 0; }
.analysis-body :deep(strong) { color: var(--text-primary); font-weight: 600; }
.analysis-body :deep(h4) { font-size: 13.5px; font-weight: 650; margin: 16px 0 8px; color: var(--text-primary); }
.analysis-body :deep(h4:first-child) { margin-top: 0; }
.analysis-body :deep(h5) { font-size: var(--fs-sm); font-weight: 650; margin: 12px 0 6px; color: var(--text-secondary); }
.analysis-body :deep(ul), .analysis-body :deep(ol) { margin: 0 0 12px; padding-left: 20px; }
.analysis-body :deep(li) { margin-bottom: 4px; }
.analysis-body :deep(code) { background: var(--surface-2); padding: 1px 5px; border-radius: 4px; font-size: 12.5px; font-family: var(--mono); color: var(--text-primary); }
</style>
