import { describe, it, expect } from 'vitest';
import { typeGroup, metricSummary, filterResources, sortResources, buildSummary, buildCsv, buildRadarHealth, historyFor, cost30 } from './radar.js';

const R = (o) => ({ id: o.name, resourceGroup: 'rg-a', category: 'sql_database', status: 'activo', detalle: {}, cost: { last30: 0, mtd: 0, lastMonth: 0, weekly: [] }, ...o });
const resources = [
  R({ name: 'db-a', status: 'sin_uso', cost: { last30: 15, mtd: 5, lastMonth: 15, weekly: [] }, recommendedAction: 'Revisar' }),
  R({ name: 'plan-d1', category: 'app_service_plan', status: 'sin_uso', sku: 'D1', detalle: { apps: 2, appsCorriendo: 0, cpuPromedio: null }, cost: { last30: 18.6, mtd: 6, lastMonth: 18, weekly: [] } }),
  R({ name: 'plan-b1', category: 'app_service_plan', status: 'bajo_uso', detalle: { cpuPromedio: 6.5, apps: 1, appsCorriendo: 1 }, cost: { last30: 13, mtd: 4, lastMonth: 13, weekly: [] } }),
  R({ name: 'st-a', category: 'storage_account', status: 'activo', resourceGroup: 'rg-b', detalle: { transaccionesTotal: 4571 }, cost: { last30: 0.6, mtd: 0.2, lastMonth: 0.6, weekly: [] } }),
  R({ name: 'st-free', category: 'storage_account', status: 'sin_uso', detalle: { transaccionesTotal: 0 }, cost: { last30: 0, mtd: 0, lastMonth: 0, weekly: [] } }),
  R({ name: 'db-x', status: 'sin_datos' })
];

describe('clasificación y métricas', () => {
  it('agrupa tipos', () => {
    expect(typeGroup('postgresql_flexible')).toBe('db');
    expect(typeGroup('app_service_plan')).toBe('app_service_plan');
    expect(typeGroup('raro')).toBe('other');
  });
  it('resume la métrica clave por tipo', () => {
    expect(metricSummary(resources[1])).toMatchObject({ label: 'Apps', extra: '2 apps · 0 corriendo' });
    expect(metricSummary(resources[2])).toMatchObject({ label: 'CPU promedio', value: '6.5%' });
    expect(metricSummary(resources[3]).value).toBe('4,571');
    // compatibilidad con datos viejos (dtuPromedio)
    expect(metricSummary(R({ name: 'old', detalle: { dtuPromedio: 0.04 } }))).toMatchObject({ label: 'DTU promedio', value: '0.0%' });
  });
  it('cost30 tolera datos viejos sin objeto cost', () => {
    expect(cost30({ monthlyCost: 3 })).toBeNull();
    expect(cost30(resources[0])).toBe(15);
  });
});

describe('filtros y orden', () => {
  it('combina estado, tipo y búsqueda', () => {
    expect(filterResources(resources, { status: 'sin_uso' }).map((r) => r.name)).toEqual(['db-a', 'plan-d1', 'st-free']);
    expect(filterResources(resources, { type: 'app_service_plan' })).toHaveLength(2);
    expect(filterResources(resources, { q: 'd1' }).map((r) => r.name)).toEqual(['plan-d1']);
    expect(filterResources(resources, { q: 'rg-b' }).map((r) => r.name)).toEqual(['st-a']);
  });
  it('prioridad: estado y luego costo', () => {
    expect(sortResources(resources).map((r) => r.name)).toEqual(['plan-d1', 'db-a', 'st-free', 'plan-b1', 'db-x', 'st-a']);
    expect(sortResources(resources, 'cost')[0].name).toBe('plan-d1');
  });
});

describe('resumen', () => {
  it('usa savings del workflow y calcula el peso sobre el gasto total', () => {
    const s = buildSummary({ resources, savings: { eliminable: 33.6, optimizable: 13 }, potentialSavings: 46.6, totalLast30: 233, counts: { sin_uso: 3, bajo_uso: 1, activo: 1, sin_datos: 1 } });
    expect(s.atStake).toBe(46.6);
    expect(s.share).toBeCloseTo(20, 6);
    expect(s.costlyIdle).toBe(2);
    expect(s.freeIdle).toBe(1);
  });
  it('sin savings (workflow viejo) lo deriva de los recursos', () => {
    const s = buildSummary({ resources });
    expect(s.savings.eliminable).toBeCloseTo(33.6, 6);
    expect(s.savings.optimizable).toBe(13);
    expect(s.share).toBeNull();
  });
});

describe('CSV e historial', () => {
  it('CSV con BOM, encabezados y comillas escapadas', () => {
    const csv = buildCsv([R({ name: 'a "b"', cost: { last30: 1.5, mtd: 0.5, lastMonth: 1, weekly: [] }, recommendedAction: 'Eliminar' })]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"Costo 30 días"');
    expect(csv).toContain('"a ""b"""');
    expect(csv).toContain('"1.50"');
  });
  it('historial ordenado y recortado', () => {
    const h = [{ resource_id: 'x', snapshot_date: '2026-10-12', status: 'sin_uso' }, { resource_id: 'x', snapshot_date: '2026-10-05', status: 'activo' }, { resource_id: 'y', snapshot_date: '2026-10-05', status: 'activo' }];
    expect(historyFor(h, 'x').map((e) => e.snapshot_date)).toEqual(['2026-10-05', '2026-10-12']);
  });
});

describe('salud del radar', () => {
  const now = new Date('2026-10-12T15:00:00Z');
  const base = { generatedAt: '2026-10-12T08:10:00Z', resources, pipeline: { workflowVersion: '2026-10-12', costDataThrough: '2026-10-11', costRows: 120, hermes: { ok: true } } };
  it('verde con datos frescos (1 de 6 sin datos = aviso de métricas)', () => {
    const h = buildRadarHealth(base, now);
    expect(h.checks.map((c) => c.id)).toEqual(['fresh', 'version', 'cost', 'metrics', 'hermes']);
    expect(h.checks.find((c) => c.id === 'metrics').level).toBe('warn');
  });
  it('workflow viejo y corrida atrasada', () => {
    const h = buildRadarHealth({ generatedAt: '2026-09-28T08:00:00Z', resources: [] }, now);
    expect(h.checks.find((c) => c.id === 'fresh').level).toBe('warn');
    expect(h.checks.find((c) => c.id === 'version').level).toBe('warn');
  });
});

describe('radar v2: huérfanos, ignorados, recomendaciones', () => {
  const base = [
    R({ name: 'disk-1', category: 'orphan_disk', status: 'sin_uso', detalle: { sizeGB: 128 }, cost: { last30: 19.2, mtd: 7, lastMonth: 19, weekly: [] } }),
    R({ name: 'vm-1', category: 'virtual_machine', status: 'sin_uso', detalle: { energia: 'stopped', cpuPromedio: 0 }, cost: { last30: 72, mtd: 26, lastMonth: 70, weekly: [] } }),
    R({ name: 'backup', category: 'storage_account', status: 'sin_uso', ignored: true, cost: { last30: 3, mtd: 1, lastMonth: 3, weekly: [] } }),
    R({ name: 'plan', category: 'app_service_plan', status: 'bajo_uso', sku: 'S1', skuRecommendation: { from: 'S1', to: 'B1', monthlySavings: 43.77, source: 'estimado' }, advisor: [{ problem: 'Right-size' }], cost: { last30: 54, mtd: 20, lastMonth: 54, weekly: [] } })
  ];
  it('métricas de VM y huérfanos', async () => {
    const { metricSummary } = await import('./radar.js');
    expect(metricSummary(base[0])).toMatchObject({ value: '128 GB' });
    expect(metricSummary(base[1]).extra).toBe('detenida (sin desasignar)');
  });
  it('los ignorados no se ven por defecto ni cuentan en el resumen', async () => {
    const { filterResources, buildSummary } = await import('./radar.js');
    expect(filterResources(base).map((r) => r.name)).toEqual(['disk-1', 'vm-1', 'plan']);
    expect(filterResources(base, { showIgnored: true }).map((r) => r.name)).toEqual(['backup']);
    expect(filterResources(base, { type: 'huerfanos' }).map((r) => r.name)).toEqual(['disk-1']);
    const s = buildSummary({ resources: base, achieved: { monthly: 58.47, yearToDate: 120, items: [], newThisWeek: 2 }, advisorTotal: 62.5 });
    expect(s.savings.eliminable).toBeCloseTo(91.2, 6);
    expect(s.orphans).toBe(1);
    expect(s.withRecommendation).toBe(1);
    expect(s.achieved.monthly).toBe(58.47);
  });
  it('CSV incluye la recomendación y Advisor', async () => {
    const { buildCsv } = await import('./radar.js');
    const csv = buildCsv([base[3]]);
    expect(csv).toContain('"S1 -> B1"');
    expect(csv).toContain('"43.77"');
    expect(csv).toContain('"Right-size"');
  });
  it('serie de tendencia', async () => {
    const { trendSeries } = await import('./radar.js');
    expect(trendSeries([{ date: '2026-10-12', atStake: 154.8, achieved: 0 }, { date: '2026-10-19', atStake: 140.1, achieved: 58.47 }])).toEqual({ labels: ['2026-10-12', '2026-10-19'], atStake: [154.8, 140.1], achieved: [0, 58.47] });
  });
});
