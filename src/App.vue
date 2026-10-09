<script setup>
import { ref, computed } from 'vue';
import { PhArrowClockwise, PhCloudSlash } from '@phosphor-icons/vue';
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
import MoversCard from './components/MoversCard.vue';
import MonthsCard from './components/MonthsCard.vue';
import ResourcesTableCard from './components/ResourcesTableCard.vue';
import ZeroResourcesCard from './components/ZeroResourcesCard.vue';

const { state, reload, monthHistory, mtd, monthToDateSoFar, monthlyFinals, forecast } = useDashboard();
const themeTick = ref(0);
const activeGroup = ref(null);
const hasAnalysis = computed(() => !!(state.analysisText && state.analysisText.trim()));
</script>

<template>
  <div class="wrap">
    <TopBar :generated-at="state.generatedAt" @theme-change="themeTick++" />

    <div v-if="!state.loaded" class="grid" aria-busy="true" aria-label="Cargando">
      <div class="skeleton col-8" style="min-height: 380px"></div>
      <div class="skeleton col-4" style="min-height: 380px"></div>
      <div class="skeleton col-12" style="min-height: 260px"></div>
    </div>
    <div v-else-if="state.error" class="status card rise" role="alert">
      <PhCloudSlash :size="32" weight="duotone" />
      <h2>No se pudieron cargar los datos</h2>
      <p>No hubo respuesta de data.json. Revisa la conexión o que el pipeline haya publicado el reporte.</p>
      <button type="button" class="retry" :disabled="state.refreshing" @click="reload">
        <PhArrowClockwise :size="16" weight="bold" /> Reintentar
      </button>
    </div>
    <div v-else-if="!state.data" class="status card rise">
      <h2>Sin datos todavía</h2>
      <p>El reporte aún no tiene información. Aparecerá cuando el pipeline publique la primera corrida.</p>
    </div>

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
        <HeroCard
          id="card-hero"
          :class="hasAnalysis ? 'col-8' : 'col-12'"
          :mtd="mtd"
          :history="monthHistory"
          :monthly-budget="state.data.monthlyBudget"
          :forecast="forecast ? forecast.forecast : null"
          :fallback-snapshot-date="state.data.snapshotDate" :fallback-total="state.data.total"
        />
        <AnalysisCard v-if="hasAnalysis" class="col-4" :text="state.analysisText" />

        <TrendCard class="col-12" :history="monthHistory" :monthly-budget="state.data.monthlyBudget" />

        <MonthByResourceCard class="col-8" :month-by-resource="state.data.monthByResource" :monthly-budget="state.data.monthlyBudget" :theme-tick="themeTick" />
        <DonutCard class="col-4" :groups="state.data.byResourceGroup || []" :theme-tick="themeTick" :active-group="activeGroup" @hover="activeGroup = $event" />

        <GroupsCard id="card-groups" class="col-6" :groups="state.data.byResourceGroup || []" :active="activeGroup" @hover="activeGroup = $event" />
        <ServicesCard class="col-6" :services="state.data.byService || []" />

        <HeatmapCard
          class="col-12"
          :theme-tick="themeTick"
          title="Mapa de calor diario"
          :rows="state.data.historyByGroup || []"
          key-field="resource_group"
          row-head-label="Grupo"
          empty-msg="Aún no hay historial por grupo disponible. Se necesitan al menos 2 días registrados."
        />

        <MoversCard class="col-12" :resources="state.data.resourceComparisons || []" />

        <ResourcesTableCard id="card-resources" class="col-7" :resources="state.data.byResource || []" :resource-comparisons="state.data.resourceComparisons || []" />
        <MonthsCard
          class="col-5"
          :history="monthHistory"
          :monthly-budget="state.data.monthlyBudget"
          :month-to-date-so-far="monthToDateSoFar"
          :monthly-finals="monthlyFinals"
          :theme-tick="themeTick"
        />

        <HeatmapCard
          class="col-12"
          :theme-tick="themeTick"
          title="Tendencia por tipo de servicio"
          :rows="state.data.historyByService || []"
          key-field="service_name"
          row-head-label="Servicio"
          empty-msg="Aún no hay historial por tipo de servicio disponible."
        />

        <ZeroResourcesCard class="col-12" :resources="state.data.byResource || []" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.status { display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-2); max-width: 560px; margin: var(--space-7) auto; color: var(--text-secondary); }
.status h2 { margin: var(--space-2) 0 0; color: var(--text-primary); }
.status p { margin: 0 0 var(--space-3); font-size: var(--fs-sm); }
.retry {
  display: inline-flex; align-items: center; gap: var(--space-2); height: 40px; padding: 0 16px;
  background: var(--series-1); color: var(--on-series); border: 0; border-radius: var(--radius-md);
  font: inherit; font-size: var(--fs-sm); font-weight: 600; cursor: pointer;
  transition: transform .2s var(--ease), opacity .2s var(--ease);
}
.retry:active { transform: scale(0.97); }
.retry:disabled { opacity: 0.6; cursor: progress; }
</style>
