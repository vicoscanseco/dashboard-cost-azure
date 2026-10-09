<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { Chart } from 'chart.js/auto';
import { cssVar, CAT_COLORS, fmtUSD } from '../lib/format.js';
import { DONUT_TOP_N } from '../lib/calc.js';

const props = defineProps({ groups: { type: Array, default: () => [] }, themeTick: { type: Number, default: 0 } });
const canvasEl = ref(null);
const label = computed(() => {
  const top = [...props.groups].sort((a, b) => b.cost - a.cost).slice(0, 3);
  return 'Distribución del gasto por grupo. ' + top.map((g) => `${g.resource_group} ${fmtUSD(g.cost)}`).join(', ');
});
let chartInst = null;

function draw() {
  if (chartInst) { chartInst.destroy(); chartInst = null; }
  if (!props.groups.length || !canvasEl.value) return;

  const sorted = [...props.groups].sort((a, b) => b.cost - a.cost);
  const top = sorted.slice(0, DONUT_TOP_N);
  const rest = sorted.slice(DONUT_TOP_N);
  const labels = top.map((g) => g.resource_group);
  const values = top.map((g) => g.cost);
  const colors = top.map((g, i) => cssVar(CAT_COLORS[i % CAT_COLORS.length]));
  if (rest.length) {
    labels.push(`Otros (${rest.length})`);
    values.push(rest.reduce((s, g) => s + g.cost, 0));
    colors.push(cssVar('--text-muted'));
  }

  const grand = sorted.reduce((s, g) => s + g.cost, 0);
  const centerText = {
    id: 'centerText',
    afterDraw(chart) {
      const { ctx, chartArea: a } = chart;
      const cx = (a.left + a.right) / 2, cy = (a.top + a.bottom) / 2;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = cssVar('--text-muted');
      ctx.font = '12px ' + cssVar('--mono');
      ctx.fillText('Total', cx, cy - 16);
      ctx.fillStyle = cssVar('--text-primary');
      ctx.font = '500 24px ' + cssVar('--mono');
      ctx.fillText(fmtUSD(grand), cx, cy + 8);
      ctx.restore();
    }
  };

  chartInst = new Chart(canvasEl.value, {
    type: 'doughnut',
    plugins: [centerText],
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderColor: cssVar('--surface-1'), borderWidth: 2, hoverOffset: 4 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: { position: 'bottom', labels: { color: cssVar('--text-secondary'), boxWidth: 9, boxHeight: 9, padding: 10, font: { size: 11 } } },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${fmtUSD(ctx.parsed)}` } }
      }
    }
  });
}

onMounted(() => nextTick(draw));
onBeforeUnmount(() => { if (chartInst) chartInst.destroy(); });
watch(() => props.groups, () => nextTick(draw), { deep: true });
// el tema (claro/oscuro) cambia los colores que lee cssVar() al dibujar, así que hay que
// redibujar el chart cuando cambia — igual que el render(lastData, lastAnalysis) completo
// que hacía el dashboard-template.html original al togglear el tema.
watch(() => props.themeTick, () => nextTick(draw));
</script>

<template>
  <div class="card card-donut">
    <h2>Distribución por grupo</h2>
    <div v-if="!groups.length" class="empty">Sin datos de grupos.</div>
    <div v-else class="donut-wrap"><canvas ref="canvasEl" role="img" :aria-label="label">{{ label }}</canvas></div>
  </div>
</template>

<style scoped>
.donut-wrap { height: 260px; position: relative; }
</style>
