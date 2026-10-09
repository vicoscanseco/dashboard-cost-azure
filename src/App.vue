<script setup>
import { onMounted, ref } from 'vue';
import { useDashboard } from './lib/useDashboard.js';
import TopBar from './components/TopBar.vue';
import HeroCard from './components/HeroCard.vue';
import TrendCard from './components/TrendCard.vue';
import DonutCard from './components/DonutCard.vue';
import GroupsCard from './components/GroupsCard.vue';

const { state, load, monthHistory, mtd } = useDashboard();
const themeTick = ref(0);

onMounted(load);
</script>

<template>
  <div class="wrap">
    <TopBar :generated-at="state.generatedAt" @theme-change="themeTick++" />

    <div v-if="!state.loaded" class="empty">Cargando…</div>
    <div v-else-if="!state.data" class="empty">Sin datos todavía</div>

    <div v-else class="grid">
      <HeroCard
        class="col-4"
        :mtd="mtd"
        :fallback-snapshot-date="state.data.snapshotDate"
        :fallback-total="state.data.total"
      />
      <!-- Analisis (Hermes) y el resto de tarjetas (heatmaps, servicios, recursos, meses)
           se portan en la siguiente vuelta siguiendo exactamente este mismo patrón. -->
      <TrendCard class="col-8" :history="monthHistory" />
      <DonutCard class="col-4" :groups="state.data.byResourceGroup || []" :theme-tick="themeTick" />
      <GroupsCard class="col-8" :groups="state.data.byResourceGroup || []" />
    </div>
  </div>
</template>
