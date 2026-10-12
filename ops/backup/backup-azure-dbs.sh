#!/usr/bin/env bash
# Respaldo diario de las bases SQLite del pipeline de Azure (y de n8n) en vcubnt01.
# - Usa ".backup" de sqlite3 (seguro con la base en uso) y verifica PRAGMA integrity_check.
# - Lee cada base COMO SU DUENO (setpriv), para no dejar archivos -journal/-wal de root que
#   despues impidan escribir a hermes-svc o a n8n.
# - Guarda 14 diarios + 1 por mes durante 12 meses (ajustable con variables de entorno).
# - Al terminar registra una fila 'respaldo' en pipeline_runs (azure-costs.db), que revisa el
#   workflow "Azure - Vigilante del pipeline".
set -Euo pipefail

DEST="${BACKUP_DIR:-/mnt/datos/backups/azure-pipeline}"
KEEP_DAILY="${KEEP_DAILY:-14}"
KEEP_MONTHLY="${KEEP_MONTHLY:-12}"
COSTS_DB="${COSTS_DB:-/var/lib/azure-costs/azure-costs.db}"
DBS=(
  "$COSTS_DB"
  "${RESOURCES_DB:-/var/lib/azure-resource-usage/azure-resource-usage.db}"
  "${N8N_DB:-/mnt/datos/n8n-data/database.sqlite}"
)
# llave de cifrado de credenciales de n8n: sin ella el respaldo de n8n no sirve
EXTRA_FILES=( "${N8N_CONFIG:-/mnt/datos/n8n-data/config}" )

log() { echo "[$(date '+%F %T')] $*"; }
as_owner() { local f="$1"; shift; setpriv --reuid="$(stat -c %u "$f")" --regid="$(stat -c %g "$f")" --clear-groups -- "$@"; }

command -v sqlite3 >/dev/null || { log "ERROR: falta sqlite3 (apt install sqlite3)"; exit 2; }
umask 077
stamp="$(date +%F)"
day="$DEST/daily/$stamp"
mkdir -p "$day" "$DEST/monthly"
chmod 700 "$DEST"
work="$(mktemp -d)"; chmod 777 "$work"; trap 'rm -rf "$work"' EXIT

fail=0; done_list=()
for db in "${DBS[@]}"; do
  if [ ! -f "$db" ]; then log "AVISO: no existe $db (se omite)"; continue; fi
  name="$(basename "$db")"
  if as_owner "$db" sqlite3 "$db" ".timeout 60000" ".backup '$work/$name'" \
     && [ "$(sqlite3 "$work/$name" 'PRAGMA integrity_check;')" = "ok" ]; then
    gzip -c "$work/$name" > "$day/$name.gz" && rm -f "$work/$name"
    log "OK  $name -> $day/$name.gz ($(du -h "$day/$name.gz" | cut -f1))"
    done_list+=("$name")
  else
    log "ERROR respaldando $db"; fail=1
  fi
done
for f in "${EXTRA_FILES[@]}"; do
  [ -f "$f" ] && install -m 600 "$f" "$day/n8n-$(basename "$f")" && log "OK  $(basename "$f") (llave de n8n)"
done

# el primer respaldo de cada mes se conserva aparte
month="$DEST/monthly/$(date +%Y-%m)"
[ -d "$month" ] || cp -a "$day" "$month"

# rotacion
ls -1d "$DEST"/daily/*/   2>/dev/null | sort | head -n -"$KEEP_DAILY"   | xargs -r rm -rf
ls -1d "$DEST"/monthly/*/ 2>/dev/null | sort | head -n -"$KEEP_MONTHLY" | xargs -r rm -rf

# latido para el vigilante (como el dueno de la base de costos)
if [ -f "$COSTS_DB" ]; then
  detail="$(printf '{"files":"%s","dest":"%s","size":"%s"}' "${done_list[*]}" "$day" "$(du -sh "$day" | cut -f1)")"
  as_owner "$COSTS_DB" sqlite3 "$COSTS_DB" ".timeout 60000" \
    "CREATE TABLE IF NOT EXISTS pipeline_runs (run_at TEXT NOT NULL, workflow TEXT NOT NULL, data_through TEXT, sync_ok INTEGER, hermes_ok INTEGER, detail TEXT, PRIMARY KEY (workflow, run_at));" \
    "INSERT OR REPLACE INTO pipeline_runs (run_at, workflow, data_through, sync_ok, hermes_ok, detail) VALUES (strftime('%Y-%m-%dT%H:%M:%SZ','now'), 'respaldo', '$stamp', $((1 - fail)), NULL, '${detail//\'/\'\'}');" \
    || log "AVISO: no pude registrar el latido en pipeline_runs"
fi
log "Fin (estado $fail)"
exit "$fail"
