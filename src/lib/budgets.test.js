import { describe, it, expect } from 'vitest';
import { buildBudgetRows, summarizeBudgets, referenceLabel } from './budgets.js';

const list = [
  { resource_group: 'rg-ok', mtd: 10, projection: 30, budget: 40, source: 'propio', status: 'ok' },
  { resource_group: 'rg-riesgo', mtd: 16.61, projection: 38.14, budget: 25.55, source: 'referencia', status: 'en_riesgo' },
  { resource_group: 'rg-nuevo', mtd: 3, projection: 9, budget: null, source: null, status: 'sin_presupuesto' },
  { resource_group: 'rg-pasado', mtd: 50, projection: 80, budget: 45, source: 'propio', status: 'excedido' }
];

describe('presupuesto por proyecto', () => {
  it('ordena por gravedad y escala cada fila a su máximo', () => {
    const rows = buildBudgetRows(list);
    expect(rows.map((r) => r.resource_group)).toEqual(['rg-pasado', 'rg-riesgo', 'rg-ok', 'rg-nuevo']);
    const riesgo = rows[1];
    expect(riesgo.projPct).toBe(100);
    expect(riesgo.budgetPct).toBeCloseTo((25.55 / 38.14) * 100, 6);
    expect(riesgo.overBy).toBe(12.59);
    const ok = rows[2];
    expect(ok.budgetPct).toBe(100);
    expect(ok.mtdPct).toBe(25);
    expect(rows[3].budgetPct).toBeNull();
  });
  it('la proyección nunca queda por debajo de lo ya gastado', () => {
    const [r] = buildBudgetRows([{ resource_group: 'x', mtd: 20, projection: 12, budget: 30, status: 'ok' }]);
    expect(r.projection).toBe(20);
  });
  it('resume cuántos se pasan y por cuánto', () => {
    const s = summarizeBudgets(buildBudgetRows(list));
    expect(s.atRisk).toBe(2);
    expect(s.counts.ok).toBe(1);
    expect(s.overTotal).toBeCloseTo(12.59 + 35, 6);
  });
  it('etiqueta de meses de referencia', () => {
    expect(referenceLabel(['2026-07', '2026-08', '2026-09'])).toMatch(/^jul–sep/);
    expect(referenceLabel([])).toBe('');
  });
});
