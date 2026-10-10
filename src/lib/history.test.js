import { describe, it, expect } from 'vitest';
import { parseMonthlyDetail, listMonths, monthTotals, aggregate, prevMonthKey, buildWaterfall, buildProjectsView, buildExplorerTree } from './history.js';

const md = {
  cols: ['month', 'resource_group', 'resource_name', 'service_name', 'cost'],
  rows: [
    ['2026-08', 'rg-a', 'app-a', 'App Service', 50],
    ['2026-08', 'rg-a', 'sql-a', 'SQL Database', 30],
    ['2026-08', 'rg-b', 'vm-b', 'Virtual Machines', 20],
    ['2026-09', 'rg-a', 'app-a', 'App Service', 70],
    ['2026-09', 'rg-a', 'sql-a', 'SQL Database', 25],
    ['2026-09', 'rg-c', 'func-c', 'Functions', 5],
    ['2026-10', 'rg-a', 'app-a', 'App Service', 20]
  ]
};
const rows = parseMonthlyDetail(md);

describe('parseMonthlyDetail / básicos', () => {
  it('convierte arreglos a objetos y tolera nulos', () => {
    expect(rows).toHaveLength(7);
    expect(parseMonthlyDetail(null)).toEqual([]);
    expect(parseMonthlyDetail({ rows: [['2026-01', null, null, null, '1.5']] })[0]).toMatchObject({ resource_group: '(sin grupo)', cost: 1.5 });
  });
  it('meses, totales y agregados', () => {
    expect(listMonths(rows)).toEqual(['2026-08', '2026-09', '2026-10']);
    expect(monthTotals(rows)).toEqual({ '2026-08': 100, '2026-09': 100, '2026-10': 20 });
    expect(aggregate(rows, '2026-09', 'project')).toEqual({ 'rg-a': 95, 'rg-c': 5 });
    expect(aggregate(rows, '2026-08', 'resource')['rg-b / vm-b']).toBe(20);
  });
  it('mes anterior cruza de año', () => {
    expect(prevMonthKey('2026-01')).toBe('2025-12');
    expect(prevMonthKey('2026-10')).toBe('2026-09');
  });
});

describe('buildWaterfall', () => {
  it('los pasos cuadran exacto de A a B', () => {
    const w = buildWaterfall(rows, '2026-08', '2026-09', 'project');
    expect(w.totalA).toBe(100);
    expect(w.totalB).toBe(100);
    const sum = w.steps.reduce((s, x) => s + x.delta, 0);
    expect(w.totalA + sum).toBeCloseTo(w.totalB, 6);
    expect(w.steps[w.steps.length - 1].end).toBeCloseTo(w.totalB, 6);
    // rg-b desaparece (-20) y es el de mayor impacto absoluto junto a rg-a (+15)
    expect(w.steps[0]).toMatchObject({ key: 'rg-b', delta: -20 });
    expect(w.topUp.key).toBe('rg-a');
  });
  it('agrupa el resto en Otros manteniendo el cuadre', () => {
    const w = buildWaterfall(rows, '2026-08', '2026-09', 'resource', 1);
    expect(w.steps).toHaveLength(2);
    expect(w.steps[1]._isOther).toBe(true);
    expect(w.steps[1].end).toBeCloseTo(w.totalB, 6);
  });
});

describe('buildProjectsView', () => {
  it('series por proyecto con Otros y tabla resumen', () => {
    const v = buildProjectsView(rows, ['2026-08', '2026-09', '2026-10'], '2026-10', 2);
    expect(v.series.map((s) => s.key)).toEqual(['rg-a', 'rg-b', 'Otros (1)']);
    expect(v.series[0].values).toEqual([80, 95, 20]);
    const a = v.table.find((t) => t.key === 'rg-a');
    expect(v.lastClosed).toBe('2026-09');
    expect(a).toMatchObject({ current: 20, last: 95, before: 80 });
    expect(a.changePct).toBeCloseTo(18.75, 6);
    expect(a.avg3).toBeCloseTo(87.5, 6); // promedio de ago y sep (los meses cerrados disponibles)
  });
});

describe('buildExplorerTree', () => {
  it('arma proyecto > recurso > servicio con comparación al mes anterior', () => {
    const t = buildExplorerTree(rows, '2026-09');
    expect(t.total).toBe(100);
    expect(t.prevTotal).toBe(100);
    expect(t.groups.map((g) => g.key)).toEqual(['rg-a', 'rg-c', 'rg-b']);
    const a = t.groups[0];
    expect(a).toMatchObject({ cost: 95, prev: 80, delta: 15, share: 95 });
    expect(a.children[0]).toMatchObject({ key: 'app-a', cost: 70, prev: 50 });
    expect(a.children[0].children[0]).toMatchObject({ key: 'App Service', cost: 70 });
    // rg-b ya no gasta pero aparece con su costo previo para explicar la baja
    expect(t.groups[2]).toMatchObject({ key: 'rg-b', cost: 0, prev: 20, delta: -20 });
  });
});
