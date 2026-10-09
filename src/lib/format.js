// Helpers de formato — portados 1:1 desde dashboard-template.html (misma semántica,
// mismas unidades, mismo locale es-MX) para que ningún número se vea distinto tras la migración.

export function fmtUSD(n) {
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtUSDShort(n) {
  n = Number(n);
  if (Math.abs(n) >= 1000) return '$' + (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return '$' + Math.round(n);
}

export function fmtDate(iso) {
  try {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  } catch (e) {
    return iso;
  }
}

export function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export const CAT_COLORS = ['--cat-1', '--cat-2', '--cat-3', '--cat-4', '--cat-5', '--cat-6', '--cat-7', '--cat-8'];
