<script setup>
import { onMounted, ref } from 'vue';
import { useDashboard } from './lib/useDashboard.js';
import TopBar from './components/TopBar.vue';
import AnomalyStrip from './components/AnomalyStrip.vue';
import HeroCard from './components/HeroCard.vue';
import AnalysisCard from './components/AnalysisCard.vue';
import TrendCard from './components/TrendCard.vue';
import MonthByResourceCard from './components/MonthByResourceCard.vue';
import DonutCard from './components/DonutCard.vue';
import GroupsCard from './components/GroupsCard.vue';
import HeatmapCard from './components/HeatmapCard.vue';
import ServicesCard from './components/ServicesCard.vue';
import MonthsCard from './components/MonthsCard.vue';
import ResourcesTableCard from './components/ResourcesTableCard.vue';
import ZeroResourcesCard from './components/ZeroResourcesCard.vue';

const { state, load, monthHistory, mtd, monthToDateSoFar, monthlyFinals } = useDashboard();
const themeTick = ref(0);

onMounted(load);
</script>

<template>
  <div class="wrap">
    <TopBar :generated-at="state.generatedAt" @theme-change="themeTick++" />

    <div v-if="!state.loaded" class="empty">Cargando…</div>
    <div v-else-if="!state.data" class="empty">Sin datos todavía</div>

    <template v-else>
      <AnomalyStrip
        :groups="state.data.byResourceGroup || []"
        :resources="state.data.resourceComparisons || []"
        :history="monthHistory"
        :monthly-budget="state.data.monthlyBudget"
        :month-to-date-so-far="monthToDateSoFar"
        :monthly-finals="monthlyFinals"
      />

      <div class="grid">
        <HeroCard class="col-4" :mtd="mtd" :fallback-snapshot-date="state.data.snapshotDate" :fallback-total="state.data.total" />
        <AnalysisCard class="col-8" :text="state.analysisText" />

        <TrendCard class="col-12" :history="monthHistory" />

        <MonthByResourceCard class="col-12" :month-by-resource="state.data.monthByResource" :monthly-budget="state.data.monthlyBudget" :theme-tick="themeTick" />

        <DonutCard class="col-4" :groups="state.data.byResourceGroup || []" :theme-tick="themeTick" />
        <GroupsCard class="col-8" :groups="state.data.byResourceGroup || []" />

        <HeatmapCard
          class="col-12"
          title="Mapa de calor diario"
          :rows="state.data.historyByGroup || []"
          key-field="resource_group"
          row-head-label="Grupo"
          empty-msg="Aún no hay historial por grupo disponible. Se necesitan al menos 2 días registrados."
        />

        <ServicesCard class="col-6" :services="state.data.byService || []" />
        <ResourcesTableCard class="col-6" :resources="state.data.byResource || []" :resource-comparisons="state.data.resourceComparisons || []" />

        <HeatmapCard
          class="col-12"
          title="Tendencia por tipo de servicio"
          :rows="state.data.historyByService || []"
          key-field="service_name"
          row-head-label="Servicio"
          empty-msg="Aún no hay historial por tipo de servicio disponible."
        />

        <MonthsCard
          class="col-12"
          :history="monthHistory"
          :monthly-budget="state.data.monthlyBudget"
          :month-to-date-so-far="monthToDateSoFar"
          :monthly-finals="monthlyFinals"
          :theme-tick="themeTick"
        />

        <ZeroResourcesCard class="col-12" :resources="state.data.byResource || []" />
      </div>
    </template>
  </div>
</template>
