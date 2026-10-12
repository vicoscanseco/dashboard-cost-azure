// Presupuesto por proyecto (resource group). El workflow calcula la proyección de cierre
// (lo que va del mes + ritmo de entre semana / fin de semana de los últimos 28 días) y el
// estado; aquí solo se ordena y se prepara para dibujar.

export const BUDGET_STATUS = {
  excedido: { label: 'Excedido', tone: 'crit' },
  en_riesgo: { label: 'Se va a pasar', tone: 'warn' },
  ok: { label: 'En rango', tone: 'good' },
  sin_presupuesto: { label: 'Sin presupuesto', tone: 'muted' }
};
const ORDER = { excedido: 0, en_riesgo: 1, ok: 2, sin_presupuesto: 3 };

const pct = (v, max) => (max > 0 ? Math.max(0, Math.min(100, (v / max) * 100)) : 0);

// Cada fila trae porcentajes sobre una escala común a la fila: el mayor entre presupuesto,
// proyección y gasto. Así la marca del presupuesto y la proyección se comparan a simple vista.
export function buildBudgetRows(projectBudgets) {
  return (projectBudgets || [])
    .filter((p) => p && p.resource_group)
    .map((p) => {
      const mtd = Number(p.mtd) || 0;
      const projection = Math.max(Number(p.projection) || 0, mtd);
      const budget = p.budget === null || p.budget === undefined ? null : Number(p.budget);
      const scale = Math.max(budget || 0, projection, mtd, 0.01);
      return {
        ...p,
        mtd,
        projection,
        budget,
        status: BUDGET_STATUS[p.status] ? p.status : 'sin_presupuesto',
        mtdPct: pct(mtd, scale),
        projPct: pct(projection, scale),
        budgetPct: budget ? pct(budget, scale) : null,
        overBy: budget ? Math.round((projection - budget) * 100) / 100 : null
      };
    })
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || (b.projection / (b.budget || Infinity)) - (a.projection / (a.budget || Infinity)) || b.mtd - a.mtd);
}

export function summarizeBudgets(rows) {
  const counts = { excedido: 0, en_riesgo: 0, ok: 0, sin_presupuesto: 0 };
  let overTotal = 0;
  for (const r of rows || []) {
    counts[r.status] = (counts[r.status] || 0) + 1;
    if ((r.status === 'excedido' || r.status === 'en_riesgo') && r.overBy > 0) overTotal += r.overBy;
  }
  const atRisk = counts.excedido + counts.en_riesgo;
  return { counts, atRisk, overTotal: Math.round(overTotal * 100) / 100 };
}

// "jul–sep" a partir de ['2026-07', '2026-08', '2026-09']
export function referenceLabel(months) {
  if (!months || !months.length) return '';
  const short = (m) => new Date(m + '-15T00:00:00Z').toLocaleDateString('es-MX', { month: 'short', timeZone: 'UTC' }).replace('.', '');
  return months.length === 1 ? short(months[0]) : `${short(months[0])}–${short(months[months.length - 1])}`;
}
