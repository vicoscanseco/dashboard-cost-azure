// Lógica de cálculo del dashboard — portada 1:1 desde dashboard-template.html.
// Estas funciones encapsulan varios bugs reales ya resueltos en sesiones anteriores
// (rezago de reconciliación de Azure, meses cerrados, duplicados por re-ejecución),
// documentados en /areas/azure-cost-report.md. NO simplificar ni "limpiar" esta lógica
// sin releer esa nota — cada rama existe por una razón concreta ya validada con datos reales.

// conserva una sola fila por fecha (la última), por si llegan duplicados de la BD
export function dedupeByDate(history) {
  const byDate = {};
  history.forEach((h) => { byDate[h.date] = h; });
  return Object.keys(byDate).sort().map((d) => byDate[d]);
}

// Azure Cost Management no cierra el costo de un día el mismo día — sigue sumando cargos
// a fechas pasadas los días siguientes. data.monthByResource trae, para el mes en curso,
// el costo real recalculado fresco en ESTA corrida; se usa para sustituir los días del mes
// en curso dentro de monthHistory, así "Tendencia diaria" no se ve más bajo que la gráfica
// de costo por recurso para los mismos días.
export function applyFreshMonthByResource(monthHistory, monthByResource) {
  if (!monthByResource || !monthByResource.days || !monthByResource.days.length) return monthHistory;
  const freshDaily = {};
  monthByResource.days.forEach((d, i) => {
    let sum = (monthByResource.othersDaily && monthByResource.othersDaily[i]) ? monthByResource.othersDaily[i] : 0;
    (monthByResource.series || []).forEach((s) => { sum += (s.daily && s.daily[i]) ? s.daily[i] : 0; });
    freshDaily[d] = Math.round(sum * 100) / 100;
  });
  return monthHistory.map((h) => (freshDaily[h.date] !== undefined ? { date: h.date, total: freshDaily[h.date] } : h));
}

// total acumulado del mes en curso (real, sin ventana móvil), con comparativo contra el
// mismo número de días transcurridos del mes anterior
export function computeMonthToDate(history) {
  if (!history.length) return null;
  const byMonth = {};
  history.forEach((h) => {
    const m = h.date.slice(0, 7);
    (byMonth[m] = byMonth[m] || []).push(h);
  });
  const lastEntry = history[history.length - 1];
  const lastD = new Date(lastEntry.date + 'T00:00:00');
  const currentMonthKey = lastEntry.date.slice(0, 7);
  const dayOfMonth = lastD.getDate();
  const currentSoFar = (byMonth[currentMonthKey] || []).reduce((s, h) => s + h.total, 0);

  const prevMonthD = new Date(lastD.getFullYear(), lastD.getMonth() - 1, 1);
  const prevMonthKey = prevMonthD.getFullYear() + '-' + String(prevMonthD.getMonth() + 1).padStart(2, '0');
  const prevRows = (byMonth[prevMonthKey] || []).filter((h) => new Date(h.date + 'T00:00:00').getDate() <= dayOfMonth);
  const prevSoFar = prevRows.length ? prevRows.reduce((s, h) => s + h.total, 0) : null;

  const monthLabel = lastD.toLocaleDateString('es-MX', { month: 'long' });
  return { monthLabel, lastDate: lastEntry.date, currentSoFar, prevSoFar };
}

// preferir data.monthToDate (recalculado fresco cada corrida directo de la API, ver nodo
// "Costo diario por recurso (mes actual)") sobre el historial guardado día a día en la BD,
// que se queda corto por el rezago de reconciliación de Azure.
export function resolveMonthToDate(data, monthHistory) {
  if (data.monthToDate && data.monthToDate.total !== null && data.monthToDate.total !== undefined) {
    const mLastD = new Date(data.monthToDate.lastDate + 'T00:00:00');
    return {
      monthLabel: mLastD.toLocaleDateString('es-MX', { month: 'long' }),
      lastDate: data.monthToDate.lastDate,
      currentSoFar: data.monthToDate.total,
      prevSoFar: (data.monthToDate.prevTotal !== null && data.monthToDate.prevTotal !== undefined) ? data.monthToDate.prevTotal : null
    };
  }
  return computeMonthToDate(monthHistory);
}

// proyección de fin de mes a partir del historial diario (compartida por varias tarjetas)
// overrideCurrentSoFar: el total real recalculado (ver resolveMonthToDate), en vez del
// acumulado del historial en BD. monthlyFinals: {mesKey: total} con el cierre DEFINITIVO
// de meses ya terminados — sin esto, un mes cerrado se queda mostrando para siempre la
// suma rezagada de las fotos diarias guardadas en la BD.
export function computeMonthForecast(history, overrideCurrentSoFar, monthlyFinals) {
  if (!history.length) return null;
  const byMonth = {};
  history.forEach((h) => {
    const month = h.date.slice(0, 7);
    byMonth[month] = (byMonth[month] || 0) + h.total;
  });
  if (monthlyFinals) {
    Object.keys(monthlyFinals).forEach((m) => { byMonth[m] = monthlyFinals[m]; });
  }
  const lastEntry = history[history.length - 1];
  const lastD = new Date(lastEntry.date + 'T00:00:00');
  const currentMonthKey = lastEntry.date.slice(0, 7);
  const daysInMonth = new Date(lastD.getFullYear(), lastD.getMonth() + 1, 0).getDate();
  const dayOfMonth = lastD.getDate();
  const currentSoFar = (overrideCurrentSoFar !== null && overrideCurrentSoFar !== undefined) ? overrideCurrentSoFar : (byMonth[currentMonthKey] || 0);
  byMonth[currentMonthKey] = currentSoFar;
  const forecastLinear = dayOfMonth > 0 ? (currentSoFar / dayOfMonth) * daysInMonth : currentSoFar;
  const smart = projectRemainingDays(history, lastEntry.date, daysInMonth - dayOfMonth);
  const forecast = smart ? currentSoFar + smart.remaining : forecastLinear;
  return {
    byMonth, currentMonthKey, currentSoFar, forecast, forecastLinear,
    method: smart ? 'weekday' : 'linear',
    weekdayRate: smart ? smart.weekdayRate : null,
    weekendRate: smart ? smart.weekendRate : null
  };
}

// Proyección de los días que faltan del mes con el ritmo real reciente, separado entre
// semana y fin de semana (muchos recursos escalan o se apagan en fin de semana). Usa los
// 28 días previos al último, sin contar el último porque Azure lo sigue reconciliando
// y suele venir corto. Con menos de 14 días de muestra devuelve null y se usa la lineal.
export const FORECAST_SAMPLE_DAYS = 28;
export const FORECAST_MIN_SAMPLE = 14;
export function projectRemainingDays(history, lastDate, remainingDays) {
  if (remainingDays <= 0) return { remaining: 0, weekdayRate: null, weekendRate: null };
  const lastT = Date.parse(lastDate + 'T00:00:00Z');
  const fromT = lastT - FORECAST_SAMPLE_DAYS * 864e5;
  const sample = history.filter((h) => {
    const t = Date.parse(h.date + 'T00:00:00Z');
    return t >= fromT && t < lastT;
  });
  if (sample.length < FORECAST_MIN_SAMPLE) return null;
  const isWeekend = (t) => { const d = new Date(t).getUTCDay(); return d === 0 || d === 6; };
  const avg = (arr) => (arr.length ? arr.reduce((s, h) => s + h.total, 0) / arr.length : null);
  const all = avg(sample);
  const weekdayRate = avg(sample.filter((h) => !isWeekend(Date.parse(h.date + 'T00:00:00Z')))) ?? all;
  const weekendRate = avg(sample.filter((h) => isWeekend(Date.parse(h.date + 'T00:00:00Z')))) ?? all;
  let remaining = 0;
  for (let i = 1; i <= remainingDays; i++) remaining += isWeekend(lastT + i * 864e5) ? weekendRate : weekdayRate;
  return { remaining, weekdayRate, weekendRate };
}

// Piso mínimo de la base de comparación para anomalías: sin esto, un grupo/recurso recién
// creado que arranca desde casi $0 dispara porcentajes absurdos (ej. +10525%).
export const MIN_BASELINE_USD = 1;
export const DONUT_TOP_N = 8;
export const GROUPS_SHOWN = 10;
export const SERVICES_SHOWN = 8;
// Tipos de recurso que Azure factura siempre en $0 por diseño: el costo de cómputo de un
// Web App / Function App se le atribuye al App Service Plan (serverfarms) que lo hospeda,
// no al sitio en sí. Mostrarlos como "candidatos a revisar" es ruido, no una señal real.
export const ZERO_COST_BY_DESIGN_TYPES = ['microsoft.web/sites'];

// Arma las filas "Otros (N)" agregadas al final de una lista rankeada (grupos o
// servicios), con su propio deltaPct reconstruido a partir de los deltas individuales
// (solo si TODOS los elementos agrupados tienen deltaPct, si no se deja null).
export function buildRankedRows(items, shownCount, labelField, withDelta) {
  const sorted = [...items].sort((a, b) => b.cost - a.cost);
  let shown = sorted.slice(0, shownCount);
  const rest = sorted.slice(shownCount);
  if (rest.length) {
    const otherCost = rest.reduce((s, g) => s + g.cost, 0);
    let otherDeltaPct = null;
    if (withDelta) {
      const otherDeltas = rest.filter((g) => g.deltaPct !== null && g.deltaPct !== undefined);
      if (otherDeltas.length === rest.length && rest.length) {
        const prevSum = rest.reduce((s, g) => s + g.cost / (1 + g.deltaPct / 100), 0);
        otherDeltaPct = prevSum > 0 ? Math.round(((otherCost - prevSum) / prevSum) * 1000) / 10 : null;
      }
    }
    shown = [...shown, { [labelField]: `Otros (${rest.length})`, cost: otherCost, deltaPct: otherDeltaPct, _isOther: true }];
  }
  const maxCost = sorted[0] ? sorted[0].cost || 1 : 1;
  return shown.map((g, i) => ({ ...g, _pct: Math.max(2, Math.round((g.cost / maxCost) * 100)), _colorIndex: i }));
}

// ---- mapa de calor genérico: top N filas (por resource_group o service_name) x últimos días ----
export function buildHeatmapData(rows, keyField, topN = 8) {
  if (!rows || !rows.length) return null;
  const dates = Array.from(new Set(rows.map((r) => r.date))).sort();
  const days = dates.slice(-7);

  const totalsByKey = {};
  rows.forEach((r) => { totalsByKey[r[keyField]] = (totalsByKey[r[keyField]] || 0) + r.cost; });
  const topKeys = Object.keys(totalsByKey).sort((a, b) => totalsByKey[b] - totalsByKey[a]).slice(0, topN);

  if (!topKeys.length || days.length < 2) return { tooShort: true };

  const lookup = {};
  rows.forEach((r) => { lookup[r.date + '::' + r[keyField]] = r.cost; });

  let maxCost = 0;
  topKeys.forEach((k) => days.forEach((d) => { const c = lookup[d + '::' + k] || 0; if (c > maxCost) maxCost = c; }));
  if (maxCost <= 0) maxCost = 1;

  const rowsOut = topKeys.map((k) => {
    let rowTotal = 0;
    const cells = days.map((d) => {
      const cost = lookup[d + '::' + k] || 0;
      rowTotal += cost;
      return { date: d, cost, t: maxCost ? cost / maxCost : 0 };
    });
    return { key: k, cells, rowTotal };
  });

  return { days, rows: rowsOut, maxCost };
}

// ---- franja de anomalías: presupuesto proyectado + grupos/recursos con subida fuerte ----
// extra.dailyAnomalies / extra.projectBudgets vienen del workflow (versión 2026-10-13+)
export function buildAnomalyBadges(groups, resources, history, monthlyBudget, monthToDateSoFar, monthlyFinals, extra = {}) {
  const badges = [];

  // proyectos que ya se pasaron o se van a pasar de su presupuesto (primero: es dinero seguro)
  (extra.projectBudgets || [])
    .filter((p) => p.status === 'excedido' || p.status === 'en_riesgo')
    .slice(0, 3)
    .forEach((p) => badges.push({ kind: 'project', critical: p.status === 'excedido', name: p.resource_group, status: p.status, mtd: p.mtd, projection: p.projection, budget: p.budget }));

  // picos diarios contra el mismo día de la semana (máx. 3, ya vienen ordenados por impacto)
  (extra.dailyAnomalies || [])
    .slice(0, 3)
    .forEach((a) => badges.push({ kind: 'daily', critical: a.scope === 'total' || (a.deltaPct !== null && a.deltaPct >= 100), scope: a.scope, name: a.key, date: a.date, weekday: a.weekday, cost: a.cost, baseline: a.baseline, deltaPct: a.deltaPct, isNew: a.kind === 'nuevo' }));

  if (monthlyBudget) {
    const fc = computeMonthForecast(history, monthToDateSoFar, monthlyFinals);
    if (fc && fc.forecast > monthlyBudget) {
      const overPct = Math.round(((fc.forecast - monthlyBudget) / monthlyBudget) * 1000) / 10;
      badges.push({
        kind: 'budget',
        critical: overPct >= 30,
        text: `Proyección del mes supera el presupuesto de ${monthlyBudget} (+${overPct}%)`,
        forecast: fc.forecast,
        overPct
      });
    }
  }

  const flaggedGroups = (groups || [])
    .filter((g) => g.deltaPct !== null && g.deltaPct !== undefined && g.deltaPct >= 30 && g.prevCost >= MIN_BASELINE_USD)
    .sort((a, b) => b.deltaPct - a.deltaPct)
    .slice(0, 4)
    .map((g) => ({ kind: 'group', critical: g.deltaPct >= 40, name: g.resource_group, deltaPct: g.deltaPct, prevCost: g.prevCost, cost: g.cost }));

  const flaggedResources = (resources || [])
    .filter((r) => r.deltaPct !== null && r.deltaPct !== undefined && r.deltaPct >= 20 && r.prevCost >= MIN_BASELINE_USD)
    .sort((a, b) => b.deltaPct - a.deltaPct)
    .slice(0, 4)
    .map((r) => ({ kind: 'resource', critical: r.deltaPct >= 40, name: r.resource_name, group: r.resource_group, deltaPct: r.deltaPct, prevCost: r.prevCost, cost: r.cost }));

  const rank = { budget: 0, project: 1, daily: 2 };
  badges.sort((x, y) => rank[x.kind] - rank[y.kind]);
  return [...badges, ...flaggedGroups, ...flaggedResources];
}

// ---- tabla de recursos: delta semana vs semana por (grupo, recurso) ----
export function buildResourceRows(resources, resourceComparisons) {
  const deltaByKey = {};
  (resourceComparisons || []).forEach((r) => { deltaByKey[r.resource_group + '::' + r.resource_name] = r.deltaPct; });
  return resources.slice(0, 10).map((r) => ({
    ...r,
    deltaPct: deltaByKey[r.resource_group + '::' + r.resource_name]
  }));
}

// ---- recursos en $0 esta semana: candidatos a revisar/eliminar ----
export function buildZeroResources(resources) {
  const zero = (resources || []).filter((r) => {
    if (!(!r.cost || r.cost < 0.005)) return false;
    if (r.resource_type && ZERO_COST_BY_DESIGN_TYPES.indexOf(r.resource_type) !== -1) return false;
    return true;
  });
  return zero.sort((a, b) => a.resource_group.localeCompare(b.resource_group) || a.resource_name.localeCompare(b.resource_name));
}
