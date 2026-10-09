<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { loadChart } from '../lib/chart.js';
import { cssVar, CAT_COLORS, fmtUSD, fmtUSDShort, fmtDate, colorWithAlpha } from '../lib/format.js';

const props = defineProps({
  monthByResource: { type: Object, default: () => ({ days: [], series: [], othersDaily: [] }) },
  monthlyBudget: { type: Number, default: null },
  themeTick: { type: Number, default: 0 }
});

const canvasEl = ref(null);
let chartInst = null;

let drawId = 0;
async function draw() {
  const id = ++drawId;
  if (chartInst) { chartInst.destroy(); chartInst = null; }
  const { days = [], series = [], othersDaily = [] } = props.monthByResource || {};
  if (!days.length || !series.length || !canvasEl.value) return;

  const labels = days.map(fmtDate);
  const textSecondary = cssVar('--text-secondary');
  const textMuted = cssVar('--text-muted');
  const gridColor = cssVar('--grid');
  const surface = cssVar('--surface-1');
  const textPrimary = cssVar('--text-primary');
  const criticalColor = cssVar('--critical');

  const datasets = series.map((s, i) => {
    const color = cssVar(CAT_COLORS[i % CAT_COLORS.length]);
    return {
      label: `${s.resource_name} (${s.resource_group})`,
      data: s.daily,
      backgroundColor: colorWithAlpha(color, 0.75),
      borderColor: color,
      borderWidth: 1,
      pointRadius: 0,
      fill: true,
      stack: 'costs',
      tension: 0.2
    };
  });

  const hasOthers = othersDaily.some((v) => v > 0.005);
  if (hasOthers) {
    datasets.push({
      label: 'Otros',
      data: othersDaily,
      backgroundColor: colorWithAlpha(textMuted, 0.35),
      borderColor: textMuted,
      borderWidth: 1,
      pointRadius: 0,
      fill: true,
      stack: 'costs',
      tension: 0.2
    });
  }

  if (props.monthlyBudget) {
    const lastD = new Date(days[days.length - 1] + 'T00:00:00');
    const daysInMonth = new Date(lastD.getFullYear(), lastD.getMonth() + 1, 0).getDate();
    const dailyBudget = props.monthlyBudget / daysInMonth;
    datasets.push({
      label: 'Presupuesto diario (est.)',
      data: days.map(() => dailyBudget),
      borderColor: criticalColor,
      borderDash: [6, 4],
      borderWidth: 1.5,
      pointRadius: 0,
      fill: false,
      stack: 'budget-line'
    });
  }

  const Chart = await loadChart();
  if (id !== drawId || !canvasEl.value) return;
  chartInst = new Chart(canvasEl.value, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { color: textMuted, font: { size: 10.5 }, maxTicksLimit: 10 } },
        y: { stacked: true, grid: { color: gridColor }, ticks: { color: textMuted, font: { size: 10.5 }, callback: (v) => fmtUSDShort(v) } }
      },
      plugins: {
        legend: { position: 'bottom', labels: { color: textSecondary, boxWidth: 9, boxHeight: 9, font: { size: 10.5 }, padding: 8 } },
        tooltip: {
          backgroundColor: textPrimary, titleColor: surface, bodyColor: surface, padding: 8, cornerRadius: 6,
          callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${fmtUSD(ctx.parsed.y)}` }
        }
      }
    }
  });
}

onMounted(() => nextTick(draw));
onBeforeUnmount(() => { drawId++; if (chartInst) chartInst.destroy(); });
watch(() => props.monthByResource, () => nextTick(draw), { deep: true });
watch(() => props.themeTick, () => nextTick(draw));
</script>

<template>
  <div class="card card-month-resources">
    <h2>Costo diario por recurso <span class="sub">Mes en curso</span></h2>
    <div v-if="!monthByResource?.days?.length" class="empty">Aún no hay suficiente detalle diario por recurso para este mes.</div>
    <div v-else class="chart-wrap"><canvas ref="canvasEl" role="img" aria-label="Costo diario apilado por recurso del mes en curso, con línea de presupuesto diario estimado.">Costo diario por recurso del mes en curso</canvas></div>
  </div>
</template>

<style scoped>
.chart-wrap { height: 280px; position: relative; }
</style>
