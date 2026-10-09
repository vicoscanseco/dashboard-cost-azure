<script setup>
import { computed } from 'vue';
import { mdLite } from '../lib/md.js';

const props = defineProps({ text: { type: String, default: '' } });
const html = computed(() => (props.text && props.text.trim() ? mdLite(props.text.trim()) : null));
</script>

<template>
  <div class="card card-analysis">
    <h2>Análisis (Hermes)</h2>
    <div v-if="!html" class="empty">Sin análisis disponible.</div>
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div v-else class="analysis-body" v-html="html"></div>
  </div>
</template>

<style scoped>
.card-analysis { border-color: color-mix(in srgb, var(--series-1) 35%, var(--border)); }
.card-analysis :deep(h2)::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--series-1); display: inline-block; margin-right: 2px; }
.analysis-body { font-size: var(--fs-base); line-height: 1.65; color: var(--text-primary); max-height: 300px; overflow-y: auto; padding-right: 4px; }
.analysis-body :deep(p) { margin: 0 0 12px; }
.analysis-body :deep(p:last-child) { margin-bottom: 0; }
.analysis-body :deep(strong) { color: var(--text-primary); }
.analysis-body :deep(h4) { font-size: 13.5px; font-weight: 650; margin: 16px 0 8px; color: var(--text-primary); }
.analysis-body :deep(h4:first-child) { margin-top: 0; }
.analysis-body :deep(h5) { font-size: var(--fs-sm); font-weight: 650; margin: 12px 0 6px; color: var(--text-secondary); }
.analysis-body :deep(ul), .analysis-body :deep(ol) { margin: 0 0 12px; padding-left: 20px; }
.analysis-body :deep(li) { margin-bottom: 4px; }
.analysis-body :deep(code) { background: var(--surface-2); padding: 1px 5px; border-radius: 4px; font-size: 12.5px; font-family: var(--mono); }
</style>
