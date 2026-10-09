// Chart.js se descarga solo cuando un gráfico lo necesita (sale del bundle inicial)
let loading = null;

export function loadChart() {
  if (!loading) {
    loading = import('chart.js/auto').then(({ Chart }) => {
      Chart.defaults.font.family = '"Geist Mono Variable", ui-monospace, monospace';
      Chart.defaults.animation.duration = 900;
      Chart.defaults.animation.easing = 'easeOutQuart';
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) Chart.defaults.animation = false;
      return Chart;
    });
  }
  return loading;
}
