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
  const forecast = dayOfMonth > 0 ? (currentSoFar / dayOfMonth) * daysInMonth : currentSoFar;
  return { byMonth, currentMonthKey, currentSoFar, forecast };
}

// Piso mínimo de la base de comparación para anomalías: sin esto, un grupo/recurso recién
// creado que arranca desde casi $0 dispara porcentajes absurdos (ej. +10525%).
export const MIN_BASELINE_USD = 1;
export const DONUT_TOP_N = 8;
