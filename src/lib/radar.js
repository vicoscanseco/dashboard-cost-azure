// Lógica del Radar de recursos (resource-data.json, publicado cada lunes por el workflow
// "Azure - Monitor de uso de recursos"). Los costos vienen de cost_raw_daily, la misma
// tabla del dashboard de costos, así que los dos reportes cuadran entre sí.

export const STATUS = {
  sin_uso: { label: 'Sin uso', order: 0 },
  bajo_uso: { label: 'Bajo uso', order: 1 },
  sin_datos: { label: 'Sin datos', order: 2 },
  activo: { label: 'Activo', order: 3 }
};

export const TYPE_GROUPS = {
  db: { label: 'Bases de datos', categories: ['sql_database', 'postgresql_flexible', 'mysql_flexible'] },
  app_service_plan: { label: 'App Service', categories: ['app_service_plan'] },
  storage_account: { label: 'Storage', categories: ['storage_account'] }
};

export const CATEGORY_LABEL = {
  sql_database: 'SQL Database',
  postgresql_flexible: 'PostgreSQL',
  mysql_flexible: 'MySQL',
  app_service_plan: 'App Service Plan',
  storage_account: 'Storage Account'
};

export function typeGroup(category) {
  for (const [k, g] of Object.entries(TYPE_GROUPS)) if (g.categories.includes(category)) return k;
  return 'other';
}

// Costo de 30 días aunque el recurso venga de una versión vieja del workflow (solo monthlyCost)
export const cost30 = (r) => (r && r.cost && typeof r.cost.last30 === 'number' ? r.cost.last30 : null);

export function metricSummary(r) {
  const d = r.detalle || {};
  const pct = (v) => (v === null || v === undefined ? null : `${Number(v).toFixed(1)}%`);
  switch (r.category) {
    case 'app_service_plan': {
      const apps = d.apps !== undefined ? `${d.apps} app${d.apps === 1 ? '' : 's'} · ${d.appsCorriendo || 0} corriendo` : null;
      return { label: d.cpuPromedio !== null && d.cpuPromedio !== undefined ? 'CPU promedio' : 'Apps', value: pct(d.cpuPromedio) || (apps ? '' : '—'), extra: apps };
    }
    case 'sql_database': {
      const cpu = d.cpuPromedio !== undefined ? d.cpuPromedio : d.dtuPromedio;
      return { label: d.cpuPromedio !== undefined ? 'CPU promedio' : 'DTU promedio', value: pct(cpu) || '—', extra: d.conexiones !== undefined && d.conexiones !== null ? `${Math.round(d.conexiones)} conexiones` : null };
    }
    case 'postgresql_flexible':
    case 'mysql_flexible':
      return { label: 'CPU promedio', value: pct(d.cpuPromedio) || '—', extra: d.conexionesPromedio !== undefined && d.conexionesPromedio !== null ? `${d.conexionesPromedio.toFixed(1)} conexiones prom.` : null };
    case 'storage_account':
      return { label: 'Transacciones', value: d.transaccionesTotal === null || d.transaccionesTotal === undefined ? '—' : Math.round(d.transaccionesTotal).toLocaleString('es-MX'), extra: null };
    default:
      return { label: '', value: '—', extra: null };
  }
}

export function filterResources(resources, { status = 'all', type = 'all', q = '' } = {}) {
  const needle = q.trim().toLowerCase();
  return resources.filter((r) => {
    if (status !== 'all' && r.status !== status) return false;
    if (type !== 'all' && typeGroup(r.category) !== type) return false;
    if (needle) {
      const hay = [r.name, r.resourceGroup, r.category, r.sku, r.recommendedAction].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}

export function sortResources(resources, mode = 'priority') {
  const c = (r) => cost30(r) ?? (r.monthlyCost || 0);
  const arr = [...resources];
  if (mode === 'cost') return arr.sort((a, b) => c(b) - c(a) || a.name.localeCompare(b.name));
  if (mode === 'name') return arr.sort((a, b) => a.name.localeCompare(b.name));
  return arr.sort((a, b) => (STATUS[a.status]?.order ?? 9) - (STATUS[b.status]?.order ?? 9) || c(b) - c(a) || a.name.localeCompare(b.name));
}

export function historyFor(history, resourceId, n = 12) {
  return (history || []).filter((h) => h.resource_id === resourceId).sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date)).slice(-n);
}

// Resumen del encabezado: cuánto está en juego y qué parte del gasto total representa
export function buildSummary(data) {
  const resources = (data && data.resources) || [];
  const savings = (data && data.savings) || {
    eliminable: resources.filter((r) => r.status === 'sin_uso').reduce((s, r) => s + (cost30(r) || 0), 0),
    optimizable: resources.filter((r) => r.status === 'bajo_uso').reduce((s, r) => s + (cost30(r) || 0), 0)
  };
  const atStake = (data && typeof data.potentialSavings === 'number') ? data.potentialSavings : savings.eliminable + savings.optimizable;
  const total = data && typeof data.totalLast30 === 'number' ? data.totalLast30 : null;
  const counts = { activo: 0, bajo_uso: 0, sin_uso: 0, sin_datos: 0, ...((data && data.counts) || {}) };
  const costlyIdle = resources.filter((r) => r.status === 'sin_uso' && (cost30(r) || 0) >= 1).length;
  const freeIdle = resources.filter((r) => r.status === 'sin_uso' && (cost30(r) || 0) < 0.01).length;
  return {
    atStake, savings, total,
    share: total ? (atStake / total) * 100 : null,
    counts, costlyIdle, freeIdle,
    totalResources: resources.length
  };
}

export function buildCsv(resources) {
  const esc = (v) => '"' + (v === null || v === undefined ? '' : String(v)).replace(/"/g, '""') + '"';
  const header = ['Recurso', 'Tipo', 'SKU', 'Resource Group', 'Estado', 'Semanas así', 'Costo 30 días', 'Mes en curso', 'Mes anterior', 'Acción sugerida', 'Motivo'];
  const rows = resources.map((r) => [
    r.name, CATEGORY_LABEL[r.category] || r.category, r.sku || '', r.resourceGroup, STATUS[r.status]?.label || r.status,
    r.weeksInStatus ?? '', cost30(r)?.toFixed(2) ?? '', r.cost ? r.cost.mtd.toFixed(2) : (r.monthlyCost ?? ''), r.cost ? r.cost.lastMonth.toFixed(2) : '',
    r.recommendedAction || '', r.actionHint || ''
  ]);
  return '﻿' + [header, ...rows].map((row) => row.map(esc).join(',')).join('\r\n');
}

// Salud del radar (misma forma que lib/health.js para reusar PipelineHealthCard)
export function buildRadarHealth(data, now = new Date()) {
  const checks = [];
  if (!data) return { checks, level: 'unknown', issues: [] };
  const p = data.pipeline || null;
  if (data.generatedAt) {
    const days = (now.getTime() - new Date(data.generatedAt).getTime()) / 864e5;
    const level = days <= 8 ? 'ok' : days <= 15 ? 'warn' : 'crit';
    checks.push({ id: 'fresh', label: 'Última corrida', level, value: days < 1 ? 'hoy' : `hace ${Math.floor(days)} días`, hint: level === 'ok' ? 'Corre cada lunes a las 8:00.' : 'No ha corrido esta semana: revisa Executions en n8n y que esté publicado.' });
  }
  checks.push(p
    ? { id: 'version', label: 'Workflow', level: 'ok', value: p.workflowVersion || 'sin versión', hint: 'Versión que generó estos datos.' }
    : { id: 'version', label: 'Workflow', level: 'warn', value: 'versión anterior', hint: 'resource-data.json no trae costos de cost_raw_daily: publica la versión nueva del workflow (Shift+P).' });
  if (p && p.costDataThrough) {
    const lag = Math.round((Date.parse(now.toISOString().slice(0, 10)) - Date.parse(p.costDataThrough)) / 864e5);
    checks.push({ id: 'cost', label: 'Costos hasta', level: lag <= 3 ? 'ok' : lag <= 7 ? 'warn' : 'crit', value: p.costDataThrough, hint: lag <= 3 ? `Del sync diario de costos (${(p.costRows || 0).toLocaleString('es-MX')} recursos con cargo).` : `${lag} días sin datos nuevos de costos: revisa el workflow de costos.` });
  } else if (p) {
    checks.push({ id: 'cost', label: 'Costos', level: 'crit', value: 'sin datos', hint: 'No se pudo leer cost_raw_daily (credencial SSH db del workflow de costos).' });
  }
  const resources = data.resources || [];
  if (resources.length) {
    const sinDatos = resources.filter((r) => r.status === 'sin_datos').length;
    const ratio = sinDatos / resources.length;
    checks.push({ id: 'metrics', label: 'Métricas', level: ratio <= 0.1 ? 'ok' : ratio <= 0.25 ? 'warn' : 'crit', value: `${resources.length - sinDatos}/${resources.length} con datos`, hint: sinDatos ? `${sinDatos} recurso${sinDatos === 1 ? '' : 's'} sin lectura de Azure Monitor esta corrida.` : 'Azure Monitor respondió para todos.' });
  }
  if (p && p.hermes) {
    checks.push(p.hermes.ok
      ? { id: 'hermes', label: 'Análisis IA', level: 'ok', value: 'respondió', hint: 'Hermes generó el análisis de la semana.' }
      : { id: 'hermes', label: 'Análisis IA', level: 'crit', value: 'falló', hint: p.hermes.error || 'Respuesta vacía de Hermes.' });
  }
  const rank = { ok: 0, unknown: 1, warn: 2, crit: 3 };
  const level = checks.reduce((acc, c) => (rank[c.level] > rank[acc] ? c.level : acc), 'ok');
  return { checks, level, issues: checks.filter((c) => c.level === 'warn' || c.level === 'crit') };
}

export function prettyType(t) {
  if (!t) return 'sin tipo';
  const map = {
    'microsoft.compute/virtualmachines': 'Virtual Machine',
    'microsoft.compute/disks': 'Disco',
    'microsoft.network/publicipaddresses': 'IP pública',
    'microsoft.app/containerapps': 'Container App',
    'microsoft.app/managedenvironments': 'Container Apps env.',
    'microsoft.documentdb/databaseaccounts': 'Cosmos DB',
    'microsoft.web/sites': 'Web App',
    'microsoft.web/serverfarms': 'App Service Plan',
    'microsoft.sql/servers': 'SQL Server',
    'microsoft.storage/storageaccounts': 'Storage Account',
    'microsoft.containerregistry/registries': 'Container Registry',
    'microsoft.keyvault/vaults': 'Key Vault',
    'microsoft.operationalinsights/workspaces': 'Log Analytics',
    'microsoft.insights/components': 'App Insights',
    'microsoft.cognitiveservices/accounts': 'Azure AI / OpenAI'
  };
  return map[t] || t.split('/').pop();
}
