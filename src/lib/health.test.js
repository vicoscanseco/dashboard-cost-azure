import { describe, it, expect } from 'vitest';
import { buildHealthChecks, findCoverageGaps } from './health.js';

const now = new Date('2026-10-10T15:00:00Z');
const fullSept = Array.from({ length: 30 }, (_, i) => ({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, total: 1 }));

const base = {
  generatedAt: '2026-10-10T08:05:00Z',
  snapshotDate: '2026-10-09',
  dailyHistory: [...fullSept, { date: '2026-10-09', total: 1 }],
  pipeline: { workflowVersion: '2026-10-13', dataThrough: '2026-10-09', sync: { ok: true, rows: 4155, attempts: 1, region: 'MEXICOCENTRAL' }, hermes: { ok: true } }
};

describe('buildHealthChecks', () => {
  it('todo en verde', () => {
    const h = buildHealthChecks(base, now);
    expect(h.level).toBe('ok');
    expect(h.issues).toHaveLength(0);
    expect(h.checks.map((c) => c.id)).toEqual(['fresh', 'through', 'version', 'sync', 'hermes', 'coverage']);
  });
  it('sin objeto pipeline avisa que el workflow publicado es viejo', () => {
    const h = buildHealthChecks({ ...base, pipeline: undefined }, now);
    expect(h.checks.find((c) => c.id === 'version').level).toBe('warn');
    expect(h.level).toBe('warn');
  });
  it('workflow con versión anterior pide actualizar', () => {
    const h = buildHealthChecks({ ...base, pipeline: { ...base.pipeline, workflowVersion: '2026-10-10' } }, now);
    const v = h.checks.find((c) => c.id === 'version');
    expect(v.level).toBe('warn');
    expect(v.hint).toContain('2026-10-13');
  });
  it('Hermes caído y datos viejos son críticos', () => {
    const h = buildHealthChecks({ ...base, generatedAt: '2026-10-07T08:00:00Z', pipeline: { ...base.pipeline, hermes: { ok: false, error: 'No access token' } } }, now);
    expect(h.level).toBe('crit');
    expect(h.issues.map((c) => c.id)).toEqual(expect.arrayContaining(['fresh', 'hermes']));
  });
  it('sync con reintentos es aviso, sin filas es crítico', () => {
    expect(buildHealthChecks({ ...base, pipeline: { ...base.pipeline, sync: { ok: true, rows: 10, attempts: 2 } } }, now).level).toBe('warn');
    expect(buildHealthChecks({ ...base, pipeline: { ...base.pipeline, sync: { ok: false, rows: 0, attempts: 3 } } }, now).level).toBe('crit');
  });
});

describe('findCoverageGaps', () => {
  it('detecta meses cerrados incompletos e ignora el mes en curso', () => {
    const hist = [...fullSept.filter((h) => h.date !== '2026-09-15'), { date: '2026-10-01', total: 1 }];
    const c = findCoverageGaps(hist, '2026-10');
    expect(c.gaps).toEqual([{ month: '2026-09', have: 29, total: 30 }]);
  });
});
