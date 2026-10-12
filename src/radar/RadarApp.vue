<script setup>
import { ref, computed } from 'vue';
import { PhArrowClockwise, PhCloudSlash, PhWarning, PhXCircle } from '@phosphor-icons/vue';
import { useRadar } from './useRadar.js';
import { buildSummary, buildRadarHealth } from '../lib/radar.js';
import TopBar from '../components/TopBar.vue';
import AnalysisCard from '../components/AnalysisCard.vue';
import PipelineHealthCard from '../components/PipelineHealthCard.vue';
import RadarHero from '../components/radar/RadarHero.vue';
import DormantProjectsCard from '../components/radar/DormantProjectsCard.vue';
import RadarTable from '../components/radar/RadarTable.vue';
import UnmonitoredCard from '../components/radar/UnmonitoredCard.vue';
import ProgressCard from '../components/radar/ProgressCard.vue';
import AdvisorCard from '../components/radar/AdvisorCard.vue';

const { state, reload } = useRadar();
const data = computed(() => state.data);
const summary = computed(() => buildSummary(data.value));
const health = computed(() => buildRadarHealth(data.value, new Date()));
const hasAnalysis = computed(() => !!(data.value && data.value.analysisText && data.value.analysisText.trim()));
const navLink = computed(() => (data.value && data.value.links && data.value.links.costDashboard ? { label: 'Costos →', href: data.value.links.costDashboard } : null));

const preset = ref(null);
const themeTick = ref(0);
const hasAdvisor = computed(() => !!(data.value && ((data.value.advisorTotal || 0) > 0 || (data.value.advisorOther || []).length || (data.value.resources || []).some((r) => r.advisor && r.advisor.length))));
const filterStatus = (status) => { preset.value = { status, q: '', t: Date.now() }; };
const filterRg = (rg) => { preset.value = { status: 'all', q: rg, t: Date.now() }; };
const goHealth = () => document.getElementById('card-health')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
</script>

<template>
  <div class="wrap">
    <TopBar title="Radar de recursos" :generated-at="data ? data.generatedAt : null" :stale-after-hours="8 * 24" :nav-link="navLink" @theme-change="themeTick++" />

    <div v-if="!state.loaded" class="grid" aria-busy="true" aria-label="Cargando">
      <div class="skeleton col-12" style="min-height: 320px"></div>
      <div class="skeleton col-12" style="min-height: 420px"></div>
    </div>
    <div v-else-if="state.error" class="status card rise" role="alert">
      <PhCloudSlash :size="32" weight="duotone" />
      <h2>No se pudieron cargar los datos</h2>
      <p>No hubo respuesta de resource-data.json. Revisa que el workflow del radar haya publicado su corrida.</p>
      <button type="button" class="retry" :disabled="state.refreshing" @click="reload"><PhArrowClockwise :size="16" weight="bold" /> Reintentar</button>
    </div>
    <div v-else-if="!data || !(data.resources || []).length" class="status card rise">
      <h2>Sin datos todavía</h2>
      <p>El radar aparecerá después de la primera corrida del workflow (lunes 8:00).</p>
    </div>

    <template v-else>
      <button v-if="health.issues.length" type="button" :class="['health-banner', health.level]" @click="goHealth">
        <component :is="health.level === 'crit' ? PhXCircle : PhWarning" :size="18" weight="fill" />
        <span><strong>Radar:</strong> {{ health.issues.map((c) => c.label + ' (' + c.value + ')').join(' · ') }}</span>
        <span class="go">Ver detalle</span>
      </button>

      <div class="grid">
        <div class="section-label">Semana del {{ data.snapshotDate }}</div>
        <RadarHero class="col-12" :summary="summary" :snapshot-date="data.snapshotDate" @filter="filterStatus" />

        <DormantProjectsCard :class="hasAnalysis ? 'col-6' : 'col-12'" :projects="data.dormantProjects || []" @select="filterRg" />
        <AnalysisCard v-if="hasAnalysis" class="col-6" :text="data.analysisText" />

        <ProgressCard :class="hasAdvisor ? 'col-7' : 'col-12'" :achieved="data.achieved || undefined" :trend="data.trend || []" :theme-tick="themeTick" />
        <AdvisorCard v-if="hasAdvisor" class="col-5" :resources="data.resources || []" :other="data.advisorOther || []" :total="data.advisorTotal || 0" />

        <div class="section-label">Recursos</div>
        <RadarTable class="col-12" :resources="data.resources || []" :history="data.history || []" :weeks="data.weeks || []" :preset="preset" />

        <UnmonitoredCard class="col-12" :items="data.unmonitored || []" :total="data.unmonitoredTotal || 0" />

        <div class="section-label">Operación</div>
        <PipelineHealthCard class="col-12" :health="health" />
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
}
</style>
