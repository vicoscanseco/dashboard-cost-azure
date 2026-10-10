# Azure Cost Dashboard

Dashboard de costos de Azure hecho con Vue 3, Vite y Chart.js. Lee `data.json` y
`analysis.txt`, que n8n publica por SSH en vcubnt01. Es una migración de
`dashboard-template.html` a una base modular, con la lógica de cálculo ya validada y un
sistema visual nuevo.

El pipeline de publicación no cambia: en vez de subir un HTML escrito a mano, se sube el
contenido de `dist/` (HTML, CSS y JS compilados con rutas relativas). No hay build en el
servidor.

## Comandos
```bash
npm install
npm run dev       # desarrollo con recarga en caliente, usa public/data.json
npm run build     # genera dist/ listo para publicar
npm test          # pruebas de la lógica de cálculo (Vitest)
```

Para publicar: cada push a `main` corre pruebas y build en GitHub Actions y un runner
self-hosted en vcubnt01 copia `dist/` a `/var/www/azure-dashboard/` (ver
[docs/DEPLOY.md](docs/DEPLOY.md)). `data.json` y `analysis.txt` los sigue publicando n8n y
el deploy nunca los toca.

## Estructura
```
src/
  App.vue                  layout, estados de carga/error/vacío
  style.css                tokens de diseño y estilos globales
  lib/
    calc.js                lógica de cálculo (proyección, mes a la fecha, anomalías...)
    calc.test.js           pruebas de calc.js
    history.js             histórico mensual: cascada, proyectos (RG), explorador
    health.js              chequeos de "Salud del pipeline"
    useDashboard.js        carga de datos, error, refresco automático
    chart.js               carga diferida de Chart.js
    format.js, md.js       formato de números/fechas y Markdown del análisis
  components/              una tarjeta por archivo
public/
  data.json, analysis.txt  datos de ejemplo para desarrollo
  favicon.svg
```

## Datos que publica n8n (data.json)
Además de lo de siempre, el workflow agrega:

- `monthlyDetail`: `{ cols, rows: [[mes, resource_group, recurso, servicio, costo]] }` de los
  últimos 12 meses, desde `cost_raw_daily`. Lo usan "¿Qué movió el costo?", "Costo por
  proyecto" (cada resource group es un proyecto) y el explorador histórico.
- `pipeline`: versión del workflow, día hasta el que hay datos, resultado del sync con
  Azure (filas, intentos, región) y si Hermes respondió. Lo usa "Salud del pipeline". Si
  falta, el dashboard avisa que la versión publicada en n8n es anterior.

`calc.js` encapsula bugs reales ya resueltos (rezago de reconciliación de Azure, meses
cerrados, duplicados por re-ejecución). No lo simplifiques sin entender cada rama; las
pruebas documentan el comportamiento esperado.

## Sistema visual
Oscuro por defecto, claro con `[data-theme="light"]`. El tema inicial sale de la
preferencia guardada o del sistema, y se aplica antes del primer pintado (script en
`index.html`).

- **Color**: un solo acento (`--series-1`, cian). Verde, rojo y ámbar (`--good`,
  `--critical`, `--warning`) solo indican estado. `--cat-1..8` son los colores
  categóricos de los gráficos.
- **Tipografía**: Geist y Geist Mono, auto-hospedadas con `@fontsource-variable`.
  Los números usan `font-variant-numeric: tabular-nums`.
- **Forma**: tarjetas 20px (`--radius-lg`), bloques internos y controles 12px
  (`--radius-md`), chips en pastilla.
- **Espaciado**: escala `--space-1..7`.
- **Iconos**: `@phosphor-icons/vue`. No se dibujan iconos a mano.
- **Capas z-index**: 0 fondo decorativo, 1 contenido, 10 barra superior.

Los gráficos de Chart.js leen los colores con `cssVar()` al dibujarse. Por eso los
componentes que los usan reciben `themeTick` y se redibujan al cambiar el tema.

## Comportamiento
- **Refresco automático**: cada 15 minutos y al volver a la pestaña. Si una recarga
  posterior falla, se conserva lo que ya se veía.
- **Datos viejos**: si `generatedAt` tiene más de 24 h, aparece un aviso en la barra
  superior.
- **Error de carga**: si `data.json` no responde, se muestra un botón para reintentar.
  Un JSON vacío se trata aparte como "sin datos todavía".
- **Sin análisis**: si `analysis.txt` está vacío, la tarjeta de análisis se oculta y el
  hero ocupa todo el ancho.
- **Alertas**: cada alerta de la franja superior lleva a la tarjeta relacionada.
- **Movimiento**: las animaciones se desactivan con `prefers-reduced-motion`.
- **Impresión**: `@media print` fuerza tema claro y oculta controles.

## Accesibilidad
Los gráficos tienen `role="img"` y `aria-label` con un resumen. La tabla de recursos usa
`aria-sort` y el buscador tiene etiqueta para lectores de pantalla.

## Formato de data.json
Campos que usa el dashboard: `generatedAt`, `snapshotDate`, `total`, `monthlyBudget`,
`monthToDate`, `dailyHistory`, `monthlyFinals`, `monthByResource`, `byResourceGroup`,
`byService`, `byResource`, `resourceComparisons`, `historyByGroup`, `historyByService`.
Hay un ejemplo en `public/data.json`.
