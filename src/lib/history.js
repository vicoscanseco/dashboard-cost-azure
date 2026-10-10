// Análisis histórico mensual a partir de data.monthlyDetail, que n8n arma desde
// cost_raw_daily (mes × proyecto/resource group × recurso × servicio, últimos 12 meses).
// En esta suscripción cada resource group es un proyecto, así que "proyecto" y
// "resource group" son la misma dimensión.

export const DIMENSIONS = {
  project: { field: 'resource_group', label: 'Proyecto', plural: 'Proyectos' },
  service: { field: 'service_name', label: 'Servicio', plural: 'Servicios' },
  resource: { field: 'resource', label: 'Recurso', plural: 'Recursos' }
};

// { cols, rows: [[month, rg, recurso, servicio, costo]] } -> objetos planos
export function parseMonthlyDetail(md) {
  if (!md || !Array.isArray(md.rows)) return [];
  const cols = md.cols || ['month', 'resource_group', 'resource_name', 'service_name', 'cost'];
  const idx = (name) => cols.indexOf(name);
  const iM = idx('month'), iG = idx('resource_group'), iR = idx('resource_name'), iS = idx('service_name'), iC = idx('cost');
  return md.rows
    .map((r) => ({
      month: r[iM],
      resource_group: r[iG] || '(sin grupo)',
      resource_name: r[iR] || '(sin recurso)',
      service_name: r[iS] || '(sin categoría)',
      cost: Number(r[iC]) || 0
    }))
    .filter((r) => r.month);
}

const keyOf = (row, dim) => (dim === 'resource' ? row.resource_group + ' / ' + row.resource_name : row[DIMENSIONS[dim].field]);

export function listMonths(rows) {
  return Array.from(new Set(rows.map((r) => r.month))).sort();
}

export function monthTotals(rows) {
  const out = {};
  rows.forEach((r) => { out[r.month] = (out[r.month] || 0) + r.cost; });
  return out;
}

export function aggregate(rows, month, dim) {
  const out = {};
  rows.forEach((r) => {
    if (r.month !== month) return;
    const k = keyOf(r, dim);
    out[k] = (out[k] || 0) + r.cost;
  });
  return out;
}

export function prevMonthKey(month) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
}

export function monthLabel(month, opts = { month: 'long', year: 'numeric' }) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('es-MX', { ...opts, timeZone: 'UTC' });
}

// Cascada "qué movió el costo": total de A, aportes por elemento (ordenados por impacto),
// el resto agrupado en "Otros", y total de B. La suma de pasos cuadra exacto con B - A.
export function buildWaterfall(rows, monthA, monthB, dim, topN = 7) {
  const a = aggregate(rows, monthA, dim);
  const b = aggregate(rows, monthB, dim);
  const totalA = Object.values(a).reduce((s, v) => s + v, 0);
  const totalB = Object.values(b).reduce((s, v) => s + v, 0);
  const deltas = Array.from(new Set([...Object.keys(a), ...Object.keys(b)]))
    .map((k) => ({ key: k, from: a[k] || 0, to: b[k] || 0, delta: (b[k] || 0) - (a[k] || 0) }))
    .filter((d) => Math.abs(d.delta) >= 0.005)
    .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
  const shown = deltas.slice(0, topN);
  const rest = deltas.slice(topN);
  const steps = [...shown];
  if (rest.length) {
    const delta = rest.reduce((s, d) => s + d.delta, 0);
    if (Math.abs(delta) >= 0.005) steps.push({ key: `Otros (${rest.length})`, delta, _isOther: true, count: rest.length });
  }
  let running = totalA;
  const bars = steps.map((s) => {
    const start = running;
    running += s.delta;
    return { ...s, start, end: running };
  });
  return {
    monthA, monthB, totalA, totalB,
    delta: totalB - totalA,
    deltaPct: totalA > 0 ? ((totalB - totalA) / totalA) * 100 : null,
    steps: bars,
    topUp: shown.filter((s) => s.delta > 0)[0] || null,
    topDown: shown.filter((s) => s.delta < 0)[0] || null
  };
}

// Serie mensual por proyecto (top N + "Otros") para la gráfica apilada, más resumen por
// proyecto: mes en curso, mes anterior, promedio de los 3 meses cerrados previos y serie 12m.
export function buildProjectsView(rows, months, currentMonth, topN = 6) {
  const byProject = {};
  rows.forEach((r) => {
    const p = r.resource_group;
    (byProject[p] = byProject[p] || {})[r.month] = (byProject[p][r.month] || 0) + r.cost;
  });
  const lastFull = months.filter((m) => m < currentMonth);
  const rankBase = lastFull.slice(-3);
  const rankScore = (p) => rankBase.reduce((s, m) => s + (byProject[p][m] || 0), 0) + (byProject[p][currentMonth] || 0);
  const projects = Object.keys(byProject).sort((x, y) => rankScore(y) - rankScore(x));
  const top = projects.slice(0, topN);
  const others = projects.slice(topN);

  const series = top.map((p) => ({ key: p, values: months.map((m) => byProject[p][m] || 0) }));
  if (others.length) {
    series.push({ key: `Otros (${others.length})`, _isOther: true, values: months.map((m) => others.reduce((s, p) => s + (byProject[p][m] || 0), 0)) });
  }

  // "Cambio" compara los dos últimos meses CERRADOS: comparar el mes en curso (parcial)
  // contra uno completo siempre sale como una caída engañosa.
  const lastClosed = lastFull[lastFull.length - 1] || null;
  const beforeClosed = lastFull[lastFull.length - 2] || null;
  const avgMonths = lastFull.slice(-3);
  const table = projects.map((p) => {
    const vals = byProject[p];
    const avg3 = avgMonths.length ? avgMonths.reduce((s, m) => s + (vals[m] || 0), 0) / avgMonths.length : null;
    const last = lastClosed ? vals[lastClosed] || 0 : null;
    const before = beforeClosed ? vals[beforeClosed] || 0 : null;
    return {
      key: p,
      current: vals[currentMonth] || 0,
      last,
      before,
      changePct: last !== null && before > 0 ? ((last - before) / before) * 100 : null,
      avg3,
      spark: months.map((m) => vals[m] || 0)
    };
  }).filter((r) => r.current >= 0.005 || (r.last || 0) >= 0.005 || (r.avg3 || 0) >= 0.005);

  return { months, series, table, lastClosed, beforeClosed };
}

// Árbol del explorador para un mes: proyecto -> recurso -> servicio, cada nivel con su costo,
// el del mes anterior, la diferencia y el peso sobre el total del mes.
export function buildExplorerTree(rows, month) {
  const prev = prevMonthKey(month);
  const tree = {};
  let total = 0, prevTotal = 0;
  rows.forEach((r) => {
    if (r.month !== month && r.month !== prev) return;
    const isCur = r.month === month;
    if (isCur) total += r.cost; else prevTotal += r.cost;
    const g = (tree[r.resource_group] = tree[r.resource_group] || { key: r.resource_group, cost: 0, prev: 0, children: {} });
    const res = (g.children[r.resource_name] = g.children[r.resource_name] || { key: r.resource_name, cost: 0, prev: 0, children: {} });
    const s = (res.children[r.service_name] = res.children[r.service_name] || { key: r.service_name, cost: 0, prev: 0 });
    if (isCur) { g.cost += r.cost; res.cost += r.cost; s.cost += r.cost; } else { g.prev += r.cost; res.prev += r.cost; s.prev += r.cost; }
  });
  const finish = (node) => {
    const out = { key: node.key, cost: node.cost, prev: node.prev, delta: node.cost - node.prev, share: total > 0 ? (node.cost / total) * 100 : 0 };
    if (node.children) {
      out.children = Object.values(node.children).map(finish)
        .filter((c) => c.cost >= 0.005 || c.prev >= 0.005)
        .sort((a, b) => b.cost - a.cost || b.prev - a.prev);
    }
    return out;
  };
  const groups = Object.values(tree).map(finish)
    .filter((g) => g.cost >= 0.005 || g.prev >= 0.005)
    .sort((a, b) => b.cost - a.cost || b.prev - a.prev);
  return { month, prev, total, prevTotal, groups };
}
