import { describe, it, expect } from 'vitest';
import {
  dedupeByDate,
  applyFreshMonthByResource,
  computeMonthToDate,
  resolveMonthToDate,
  computeMonthForecast,
  buildRankedRows,
  buildHeatmapData,
  buildAnomalyBadges,
  buildZeroResources
} from './calc.js';

const day = (date, total) => ({ date, total });

describe('dedupeByDate', () => {
  it('conserva la última fila por fecha y ordena', () => {
    const out = dedupeByDate([day('2026-10-02', 5), day('2026-10-01', 3), day('2026-10-02', 7)]);
    expect(out).toEqual([day('2026-10-01', 3), day('2026-10-02', 7)]);
  });
});

describe('applyFreshMonthByResource', () => {
  const base = [day('2026-10-01', 1), day('2026-10-02', 1), day('2026-09-30', 9)];

  it('sin datos frescos devuelve el historial igual', () => {
    expect(applyFreshMonthByResource(base, null)).toBe(base);
    expect(applyFreshMonthByResource(base, { days: [] })).toBe(base);
  });

  it('sustituye solo los días presentes, sumando series y otros', () => {
    const fresh = {
      days: ['2026-10-01', '2026-10-02'],
      series: [{ daily: [2, 3] }, { daily: [1, 0.5] }],
      othersDaily: [0.25, 0]
    };
    const out = applyFreshMonthByResource(base, fresh);
    expect(out.find((h) => h.date === '2026-10-01').total).toBe(3.25);
    expect(out.find((h) => h.date === '2026-10-02').total).toBe(3.5);
    expect(out.find((h) => h.date === '2026-09-30').total).toBe(9);
  });
});

describe('computeMonthToDate', () => {
  it('compara contra los mismos días del mes anterior', () => {
    const h = [day('2026-09-01', 10), day('2026-09-02', 10), day('2026-09-03', 10), day('2026-10-01', 4), day('2026-10-02', 6)];
    const r = computeMonthToDate(h);
    expect(r.currentSoFar).toBe(10);
    expect(r.prevSoFar).toBe(20);
    expect(r.lastDate).toBe('2026-10-02');
  });

  it('prevSoFar es null sin mes anterior', () => {
    expect(computeMonthToDate([day('2026-10-01', 4)]).prevSoFar).toBeNull();
  });

  it('historial vacío devuelve null', () => {
    expect(computeMonthToDate([])).toBeNull();
  });
});

describe('resolveMonthToDate', () => {
  it('prefiere data.monthToDate sobre el historial', () => {
    const data = { monthToDate: { lastDate: '2026-10-08', total: 90.97, prevTotal: 132.22 } };
    const r = resolveMonthToDate(data, [day('2026-10-01', 1)]);
    expect(r.currentSoFar).toBe(90.97);
    expect(r.prevSoFar).toBe(132.22);
  });

  it('cae al historial si monthToDate no trae total', () => {
    const r = resolveMonthToDate({ monthToDate: { total: null } }, [day('2026-10-01', 4)]);
    expect(r.currentSoFar).toBe(4);
  });
});

describe('computeMonthForecast', () => {
  it('proyecta el ritmo diario a los días del mes', () => {
    // 8 de octubre (31 días), $80 acumulados => 10/día => 310
    const h = [day('2026-10-08', 10)];
    const fc = computeMonthForecast(h, 80, {});
    expect(fc.forecast).toBeCloseTo(310, 5);
    expect(fc.currentMonthKey).toBe('2026-10');
  });

  it('usa el cierre definitivo de meses terminados', () => {
    const h = [day('2026-09-30', 1), day('2026-10-01', 1)];
    const fc = computeMonthForecast(h, null, { '2026-09': 420.5 });
    expect(fc.byMonth['2026-09']).toBe(420.5);
  });

  it('historial vacío devuelve null', () => {
    expect(computeMonthForecast([], null, {})).toBeNull();
  });
});

describe('buildRankedRows', () => {
  const items = [
    { name: 'a', cost: 50, deltaPct: 10 },
    { name: 'b', cost: 30, deltaPct: 0 },
    { name: 'c', cost: 10, deltaPct: 50 },
    { name: 'd', cost: 10, deltaPct: 50 }
  ];

  it('agrupa el resto en "Otros (N)" y escala la barra al máximo', () => {
    const rows = buildRankedRows(items, 2, 'name', true);
    expect(rows).toHaveLength(3);
    expect(rows[0]._pct).toBe(100);
    expect(rows[2].name).toBe('Otros (2)');
    expect(rows[2].cost).toBe(20);
    expect(rows[2]._isOther).toBe(true);
  });

  it('el delta de "Otros" sale null si algún elemento no lo tiene', () => {
    const rows = buildRankedRows([...items.slice(0, 3), { name: 'd', cost: 10 }], 2, 'name', true);
    expect(rows[2].deltaPct).toBeNull();
  });

  it('sin resto no agrega fila "Otros"', () => {
    expect(buildRankedRows(items, 10, 'name', false)).toHaveLength(4);
  });
});

describe('buildHeatmapData', () => {
  const rows = (n) =>
    Array.from({ length: n }, (_, i) => ({ date: `2026-10-0${i + 1}`, resource_group: 'rg', cost: i + 1 }));

  it('sin filas devuelve null', () => {
    expect(buildHeatmapData([], 'resource_group')).toBeNull();
  });

  it('con menos de 2 días marca tooShort', () => {
    expect(buildHeatmapData(rows(1), 'resource_group')).toEqual({ tooShort: true });
  });

  it('toma los últimos 7 días y normaliza t contra el máximo', () => {
    const out = buildHeatmapData(rows(9), 'resource_group');
    expect(out.days).toHaveLength(7);
    const last = out.rows[0].cells[out.days.length - 1];
    expect(last.t).toBe(1);
    expect(out.rows[0].rowTotal).toBe(3 + 4 + 5 + 6 + 7 + 8 + 9);
  });
});

describe('buildAnomalyBadges', () => {
  it('ignora subidas con base menor al piso de $1', () => {
    const groups = [{ resource_group: 'nuevo', deltaPct: 5000, prevCost: 0.2, cost: 10 }];
    expect(buildAnomalyBadges(groups, [], [], null, null, {})).toEqual([]);
  });

  it('marca crítico desde +40% y aviso entre 30% y 40%', () => {
    const groups = [
      { resource_group: 'a', deltaPct: 45, prevCost: 10, cost: 14.5 },
      { resource_group: 'b', deltaPct: 32, prevCost: 10, cost: 13.2 }
    ];
    const out = buildAnomalyBadges(groups, [], [], null, null, {});
    expect(out.map((b) => [b.name, b.critical])).toEqual([['a', true], ['b', false]]);
  });

  it('alerta de presupuesto cuando la proyección lo supera', () => {
    // $80 en el día 8 de octubre => proyección 310 > 150
    const out = buildAnomalyBadges([], [], [day('2026-10-08', 10)], 150, 80, {});
    expect(out[0].kind).toBe('budget');
    expect(out[0].overPct).toBeCloseTo(106.7, 1);
    expect(out[0].critical).toBe(true);
  });

  it('sin presupuesto no genera alerta de presupuesto', () => {
    expect(buildAnomalyBadges([], [], [day('2026-10-08', 10)], null, 80, {})).toEqual([]);
  });
});

describe('buildAnomalyBadges: presupuesto por proyecto y picos diarios', () => {
  it('agrega proyectos en riesgo y picos, después del presupuesto global', () => {
    const extra = {
      projectBudgets: [
        { resource_group: 'rg-a', status: 'en_riesgo', mtd: 16, projection: 38, budget: 25 },
        { resource_group: 'rg-b', status: 'ok', mtd: 5, projection: 10, budget: 20 },
        { resource_group: 'rg-c', status: 'excedido', mtd: 50, projection: 80, budget: 45 }
      ],
      dailyAnomalies: [
        { date: '2026-10-09', scope: 'proyecto', key: 'rg-a', kind: 'pico', cost: 16, baseline: 1.63, deltaPct: 882.9, weekday: 'viernes' },
        { date: '2026-10-08', scope: 'servicio', key: 'Azure OpenAI', kind: 'nuevo', cost: 4.2, baseline: 0, deltaPct: null, weekday: 'jueves' }
      ]
    };
    const b = buildAnomalyBadges([], [], [], null, null, {}, extra);
    expect(b.map((x) => x.kind + ':' + x.name)).toEqual(['project:rg-a', 'project:rg-c', 'daily:rg-a', 'daily:Azure OpenAI']);
    expect(b[1].critical).toBe(true);
    expect(b[3].isNew).toBe(true);
    expect(b[3].critical).toBe(false);
  });
  it('sin datos nuevos se comporta como antes', () => {
    expect(buildAnomalyBadges([], [], [], null, null, {})).toEqual([]);
  });
});


describe('buildZeroResources', () => {
  it('excluye los sitios web que Azure factura siempre en $0', () => {
    const out = buildZeroResources([
      { resource_group: 'rg', resource_name: 'web', cost: 0, resource_type: 'microsoft.web/sites' },
      { resource_group: 'rg', resource_name: 'disco', cost: 0, resource_type: 'microsoft.compute/disks' },
      { resource_group: 'rg', resource_name: 'vm', cost: 12 }
    ]);
    expect(out.map((r) => r.resource_name)).toEqual(['disco']);
  });

  it('ordena por grupo y luego por nombre', () => {
    const out = buildZeroResources([
      { resource_group: 'b', resource_name: 'x', cost: 0 },
      { resource_group: 'a', resource_name: 'z', cost: 0 },
      { resource_group: 'a', resource_name: 'y', cost: 0 }
    ]);
    expect(out.map((r) => r.resource_name)).toEqual(['y', 'z', 'x']);
  });
});

describe('proyección por ritmo entre semana / fin de semana', () => {
  // 28 días previos al 2026-10-14 (martes): $10 entre semana, $2 en fin de semana
  const hist = [];
  for (let t = Date.parse('2026-09-16T00:00:00Z'); t <= Date.parse('2026-10-14T00:00:00Z'); t += 864e5) {
    const d = new Date(t);
    const dow = d.getUTCDay();
    hist.push({ date: d.toISOString().slice(0, 10), total: dow === 0 || dow === 6 ? 2 : 10 });
  }

  it('usa tasas separadas y suma solo los días que faltan', async () => {
    const { projectRemainingDays } = await import('./calc.js');
    const r = projectRemainingDays(hist, '2026-10-14', 17); // 15..31 oct
    expect(r.weekdayRate).toBeCloseTo(10, 6);
    expect(r.weekendRate).toBeCloseTo(2, 6);
    // del 15 al 31 de octubre de 2026: 12 días hábiles y 5 de fin de semana
    expect(r.remaining).toBeCloseTo(12 * 10 + 5 * 2, 6);
  });

  it('computeMonthForecast reporta el método y conserva la lineal', () => {
    const fc = computeMonthForecast(hist, 100, {});
    expect(fc.method).toBe('weekday');
    expect(fc.forecast).toBeCloseTo(100 + 130, 6);
    expect(fc.forecastLinear).toBeCloseTo((100 / 14) * 31, 6);
  });

  it('con poca historia cae a la lineal', () => {
    const fc = computeMonthForecast(hist.slice(-5), 100, {});
    expect(fc.method).toBe('linear');
  });
});
