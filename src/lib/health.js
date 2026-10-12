// Chequeos de salud del pipeline (n8n -> Azure -> SQLite -> Hermes -> data.json).
// Cada chequeo devuelve level: 'ok' | 'warn' | 'crit' | 'unknown' para que la tarjeta y el
// aviso superior se pinten igual. data.pipeline lo escribe el nodo "Armar mensajes y datos";
// si no viene, casi siempre es porque el workflow publicado en n8n es una versión anterior
// (en n8n 2.x guardar no es publicar: el cron corre solo la versión publicada).

const DAY_MS = 864e5;
// Versión del workflow de n8n que corresponde a este dashboard. Si data.json trae una
// anterior, las tarjetas nuevas (presupuesto por proyecto, picos diarios) salen vacías.
export const LATEST_WORKFLOW_VERSION = '2026-10-13';
const isoDay = (d) => d.toISOString().slice(0, 10);

function daysInMonth(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

// Meses cerrados del historial diario que no tienen todos sus días
export function findCoverageGaps(dailyHistory, currentMonth) {
  const days = {};
  (dailyHistory || []).forEach((h) => {
    const m = h.date.slice(0, 7);
    (days[m] = days[m] || new Set()).add(h.date);
  });
  const months = Object.keys(days).sort();
  const gaps = months
    .filter((m) => m < currentMonth)
    .map((m) => ({ month: m, have: days[m].size, total: daysInMonth(m) }))
    .filter((g) => g.have < g.total);
  return { months, gaps };
}

export function buildHealthChecks(data, now = new Date()) {
  const checks = [];
  if (!data) return { checks, level: 'unknown', issues: [] };
  const p = data.pipeline || null;

  // 1. Frescura de la publicación
  if (data.generatedAt) {
    const h = (now.getTime() - new Date(data.generatedAt).getTime()) / 36e5;
    const level = h <= 26 ? 'ok' : h <= 50 ? 'warn' : 'crit';
    checks.push({
      id: 'fresh', label: 'Última publicación', level,
      value: h < 1 ? 'hace minutos' : h < 48 ? `hace ${Math.floor(h)} h` : `hace ${Math.floor(h / 24)} días`,
      hint: level === 'ok' ? 'El cron diario de las 8:00 está corriendo.' : 'El workflow no ha publicado. Revisa Executions en n8n y que esté publicado.'
    });
  }

  // 2. Hasta qué día llegan los datos
  const through = (p && p.dataThrough) || data.snapshotDate || null;
  if (through) {
    const lag = Math.round((Date.parse(isoDay(now)) - Date.parse(through)) / DAY_MS);
    const level = lag <= 2 ? 'ok' : lag <= 4 ? 'warn' : 'crit';
    checks.push({ id: 'through', label: 'Datos hasta', level, value: through, hint: lag <= 1 ? 'Al día (Azure reporta con un día de desfase).' : `${lag} días de retraso.` });
  }

  // 3. Versión del workflow
  const outdated = p && (!p.workflowVersion || p.workflowVersion < LATEST_WORKFLOW_VERSION);
  checks.push(!p
    ? { id: 'version', label: 'Workflow', level: 'warn', value: 'versión anterior', hint: 'data.json no trae datos de salud: la versión publicada en n8n es anterior. Publica el workflow (Shift+P).' }
    : outdated
      ? { id: 'version', label: 'Workflow', level: 'warn', value: p.workflowVersion || 'sin versión', hint: `Hay una versión nueva (${LATEST_WORKFLOW_VERSION}) con presupuesto por proyecto y picos diarios. Importa y publica el workflow (Shift+P).` }
      : { id: 'version', label: 'Workflow', level: 'ok', value: p.workflowVersion, hint: 'Versión que generó estos datos.' });

  // 4. Sync con Azure Cost Management
  if (p && p.sync) {
    const s = p.sync;
    const level = !s.ok ? 'crit' : (s.attempts || 1) > 1 ? 'warn' : 'ok';
    checks.push({
      id: 'sync', label: 'Sync con Azure', level,
      value: s.ok ? `${(s.rows || 0).toLocaleString('es-MX')} filas` : 'sin filas',
      hint: s.ok
        ? `${s.attempts || 1} intento${(s.attempts || 1) === 1 ? '' : 's'}${s.region ? ' · ' + s.region.toLowerCase() : ''}`
        : (s.warning || 'Azure no devolvió datos; los últimos días pueden estar incompletos.')
    });
  }

  // 5. Análisis de Hermes
  if (p && p.hermes) {
    checks.push(p.hermes.ok
      ? { id: 'hermes', label: 'Análisis IA', level: 'ok', value: 'respondió', hint: 'Hermes generó el análisis del día.' }
      : { id: 'hermes', label: 'Análisis IA', level: 'crit', value: 'falló', hint: p.hermes.error || 'Respuesta vacía de Hermes.' });
  }

  // 6. Cobertura del histórico
  const currentMonth = (through || isoDay(now)).slice(0, 7);
  const cov = findCoverageGaps(data.dailyHistory, currentMonth);
  if (cov.months.length) {
    checks.push({
      id: 'coverage', label: 'Histórico', level: cov.gaps.length ? 'warn' : 'ok',
      value: `${cov.months.length} mes${cov.months.length === 1 ? '' : 'es'}`,
      hint: cov.gaps.length
        ? 'Días faltantes en ' + cov.gaps.map((g) => `${g.month} (${g.have}/${g.total})`).join(', ')
        : `Desde ${cov.months[0]} sin huecos.`
    });
  }

  const rank = { ok: 0, unknown: 1, warn: 2, crit: 3 };
  const level = checks.reduce((acc, c) => (rank[c.level] > rank[acc] ? c.level : acc), 'ok');
  return { checks, level, issues: checks.filter((c) => c.level === 'warn' || c.level === 'crit') };
}
