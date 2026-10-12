# Operación del pipeline de costos

Qué vigila el pipeline, cómo se respalda y dónde se ajustan los presupuestos.

## 1. Vigilante del pipeline (n8n)

Workflow **`Azure - Vigilante del pipeline`** (`azure-pipeline-watchdog.json`). Tiene dos partes:

| Parte | Cuándo | Qué hace |
|---|---|---|
| Error Trigger | Cuando falla una corrida **automática** de cualquier workflow que lo tenga como *Error workflow* | WhatsApp + correo con workflow, nodo, error y liga a la ejecución |
| Revisión diaria | 11:00 | Revisa la tabla `pipeline_runs` y avisa si: el reporte de costos no completó una corrida en 30 h, Azure lleva más de 3 días sin datos, el último sync vino vacío, el radar no corre desde hace 8 días o no hay respaldo de menos de 30 h |

Instalación:

1. Importa `azure-pipeline-watchdog.json`, revisa las credenciales (`SSH hermes-svc (db)`, `(db-resources)`, `(notify)`, `SMTP account`) y **publícalo** (Shift+P).
2. En el workflow de costos y en el del radar: **Settings → Error workflow → Azure - Vigilante del pipeline** y guarda/publica.
3. Prueba manual: ejecuta la rama de las 11:00 con *Execute workflow*. La primera vez `pipeline_runs` estará vacía hasta que corra el workflow de costos v2026-10-13.

> El Error Trigger no se dispara en ejecuciones manuales ni cuando un nodo tiene *On Error: Continue*. Si n8n completo está caído, nadie avisa: para eso haría falta un latido externo (p. ej. healthchecks.io).

`pipeline_runs` vive en `azure-costs.db`:

```sql
SELECT * FROM pipeline_runs ORDER BY run_at DESC LIMIT 10;   -- workflow = 'costos' | 'respaldo'
```

## 2. Respaldo diario de las bases

Archivos en `ops/backup/`. Respalda `azure-costs.db`, `azure-resource-usage.db`, la base de n8n (`database.sqlite`) y su llave de cifrado (`config`) con `sqlite3 .backup` + `PRAGMA integrity_check`. Guarda 14 diarios y 1 por mes durante 12 meses en `/mnt/datos/backups/azure-pipeline`.

Instalación en vcubnt01:

```bash
sudo apt install -y sqlite3            # si no está
sudo install -m 750 ops/backup/backup-azure-dbs.sh /usr/local/sbin/
sudo install -m 644 ops/backup/backup-azure-dbs.service ops/backup/backup-azure-dbs.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now backup-azure-dbs.timer
sudo systemctl start backup-azure-dbs.service      # primera corrida ya
journalctl -u backup-azure-dbs -n 20 --no-pager
ls -lh /mnt/datos/backups/azure-pipeline/daily/*/
```

Rutas y retención se cambian con variables (`BACKUP_DIR`, `KEEP_DAILY`, `KEEP_MONTHLY`, `COSTS_DB`, `RESOURCES_DB`, `N8N_DB`, `N8N_CONFIG`) en un override: `sudo systemctl edit backup-azure-dbs.service` → `[Service]` + `Environment=BACKUP_DIR=/otra/ruta`.

El script lee cada base **como su dueño** (`setpriv`), así no deja archivos `-journal`/`-wal` de root que luego bloqueen a `hermes-svc` o a n8n.

> Si `/mnt/datos` está en el mismo disco que las bases, esto protege contra borrados y corrupción, no contra que el disco muera. Siguiente paso: copiar `daily/` a un Blob de Azure o a otro equipo (rclone/azcopy).

### Restaurar

```bash
F=/mnt/datos/backups/azure-pipeline/daily/2026-10-12/azure-costs.db.gz
DB=/var/lib/azure-costs/azure-costs.db
gunzip -c "$F" > /tmp/restore.db && sqlite3 /tmp/restore.db 'PRAGMA integrity_check;'   # debe decir ok
sudo cp "$DB" "$DB.antes-de-restaurar"
sudo chown --reference="$DB" /tmp/restore.db && sudo chmod --reference="$DB" /tmp/restore.db
sudo mv /tmp/restore.db "$DB"
```

Para n8n: `docker compose stop n8n`, restaura `database.sqlite` igual (y `config` si cambió) en `/mnt/datos/n8n-data/`, y `docker compose up -d n8n`.

## 3. Fuente única: `cost_raw_daily`

Desde la versión 2026-10-13 todo el workflow lee de `cost_raw_daily` (sincronizada cada día con la API de Azure, ventana de 45 días). `cost_snapshots` ya no se lee ni se escribe. Antes guardaba sumas móviles de 7 días por fecha, así que cada celda del *Mapa de calor diario* era en realidad una semana, y nunca se reconciliaba.

Cuando confirmes que todo se ve bien (una o dos semanas), puedes borrarla:

```sql
DROP TABLE cost_snapshots;   -- con respaldo previo
```

## 4. Picos diarios

Cada día (y el anterior, porque Azure sigue completando el más reciente) se compara contra la **mediana del mismo día de la semana** en las últimas 4 semanas, para el total, cada proyecto y cada servicio. Así un lunes no se compara contra un domingo.

| Qué | Pico si… |
|---|---|
| Total de la suscripción | +25% y al menos $3 arriba |
| Proyecto o servicio | +50% y al menos $2 arriba |
| Gasto nuevo (antes ~$0) | al menos $2 en un día |

Cada pico se avisa **una sola vez** por WhatsApp (se recuerda en los datos estáticos del workflow; las ejecuciones manuales no los guardan y pueden repetir). Aparecen en la franja de alertas del dashboard y en el correo diario.

## 5. Presupuesto por proyecto

Se configura en el nodo **`Configuracion`** del workflow de costos:

```js
projectBudgets: { 'rg-linklyai': 180, 'rg-agentus': 60 },   // USD/mes, resource group en minúsculas
referenceBudget: { months: 3, marginPct: 20, minUsd: 5, alertMinUsd: 3, alertFromDay: 5 },
```

- Los proyectos que no estén en `projectBudgets` usan un **presupuesto de referencia**: el promedio de sus últimos 3 meses cerrados +20% (en el dashboard aparecen con la marca `ref.`). Los de menos de $5 no se vigilan.
- La proyección del cierre es lo que va del mes más el ritmo de entre semana / fin de semana de los últimos 28 días.
- **Excedido** (ya gastó más que el presupuesto) avisa siempre; **se va a pasar** avisa desde el día 5 y solo si se pasa por $3 o más. Cada aviso sale una vez por proyecto y por mes.
- El presupuesto total de la suscripción (`monthlyBudgetUsd`) y la URL del dashboard también viven en ese nodo.
