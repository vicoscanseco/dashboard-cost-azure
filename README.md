# Azure Cost Dashboard — Vite + Vue 3 (en migración)

## Qué es esto
Prueba de concepto funcional de la migración del dashboard (`dashboard-template.html`) a
una base modular con Vue 3 + Vite, manteniendo el 100% de los tokens de marca (colores,
tipografía, dark/light) y la lógica de cálculo ya validada en producción.

**El pipeline de publicación NO cambia**: n8n sigue publicando `data.json` y
`analysis.txt` por SSH al mismo lugar en vcubnt01. Lo único que cambia es que, en vez de
subir un `dashboard-template.html` de 310KB escrito a mano, subes la carpeta `dist/` que
genera `npm run build` (HTML + CSS + JS compilados, rutas relativas, nada de build en el
servidor).

## Cómo correrlo
```bash
npm install
npm run dev      # servidor de desarrollo con recarga en caliente, usa public/data.json
npm run build    # genera dist/ listo para publicar
```

Para publicar: copia el contenido de `dist/` a la misma carpeta donde hoy vive
`dashboard-template.html` en vcubnt01 (vía el mismo nodo SSH "Publicar dashboard" que ya
existe — solo cambia qué archivos sube, no el mecanismo), y deja `data.json`/`analysis.txt`
publicándose exactamente igual que hoy.

## Qué ya está migrado (validado con Playwright, luz y oscuro)
- `src/lib/calc.js` — toda la lógica de cálculo (dedupeByDate, computeMonthToDate,
  computeMonthForecast, el ajuste por rezago de reconciliación de Azure) portada 1:1 desde
  el `render()` original, con los mismos comentarios explicando cada bug ya resuelto.
- `src/lib/useDashboard.js` — el equivalente reactivo del `render()` monolítico.
- `TopBar.vue` — toggle de tema (persistido en localStorage, igual que antes).
- `HeroCard.vue` — total del mes en curso + comparativo.
- `TrendCard.vue` — gráfica de tendencia diaria (SVG a mano, con tooltip).
- `DonutCard.vue` + `GroupsCard.vue` — distribución y lista por grupo de recursos.

## Qué falta portar (mismo patrón, pendiente de confirmar que se continúe)
Cada uno es una tarjeta independiente en el `dashboard-template.html` original — se porta
igual que las de arriba: la lógica de `/tmp/app.js` (extraída de las líneas 440-1293 del
original) a un composable o directo al componente, con su propio `.vue`:

- Tarjeta de Análisis (Hermes) — requiere portar el renderer de Markdown hecho a mano
  (mdInline/mdLite).
- "Costo diario por recurso — mes en curso" (stacked area + Chart.js).
- Mapa de calor diario (genérico, se reusa para grupo y servicio).
- Tendencia por tipo de servicio (mismo heatmap genérico).
- Servicios (lista, igual que Grupos).
- Tabla de recursos (con columna "Var. semana").
- Recursos en $0 (grid minimalista).
- Comparativa mensual (bar chart + proyección fin de mes).
- Franja de anomalías (badges de alerta — ya con la lógica en calc.js, falta el componente).

Con el patrón ya probado (lib puro + componente delgado), cada tarjeta restante es
mecánica — no hay piezas de arquitectura nuevas por resolver.

## Restyle aplicado
Se mantuvieron los valores exactos de los tokens de color (`--series-1`, `--cat-1..8`,
`--good`/`--critical`/`--warning`, etc. — ya validados en producción). Se añadió una
escala de espaciado y tipografía consistente (`--space-*`, `--fs-*`, `--radius-*`,
sombras en dos niveles) para que cada tarjeta deje de tener valores sueltos a mano,
dándole más aire y jerarquía sin cambiar la paleta de marca.
