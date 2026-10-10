# Deploy automático con GitHub Actions

Cada push a `main` corre las pruebas y el build en GitHub, y un runner self-hosted
instalado en **vcubnt01** copia `dist/` a `/var/www/azure-dashboard/`. Los pull requests
solo corren build y pruebas: nunca tocan el servidor.

```
push a main ──► build (ubuntu-latest): npm ci · npm test · npm run build · artefacto dist
                   │
                   ▼
            deploy (self-hosted, vcubnt01): respaldo · rsync · prueba de humo
```

`data.json` y `analysis.txt` **no se tocan**: los sigue publicando n8n cada mañana. El
build borra los de ejemplo antes de subir el artefacto y `rsync` los excluye.

## Seguridad antes de empezar

- Un runner self-hosted ejecuta el código del repo **en tu servidor**. Este workflow solo
  despliega en `push` a `main` y en ejecución manual, nunca en `pull_request`, así que un
  fork no puede correr código en vcubnt01.
- Aun así, lo más seguro es que el repo sea **privado**. Si es público, en
  *Settings → Actions → General* deja "Require approval for all outside collaborators".
- El runner corre con un usuario propio sin `sudo` y solo con escritura en la carpeta del
  dashboard.

## 1. Usuario y permisos en vcubnt01

```bash
# usuario dedicado para el runner, sin sudo
sudo adduser --disabled-password --gecos "" gh-runner

# grupo compartido para la carpeta del dashboard: el runner publica HTML/JS/CSS y
# hermes-svc (n8n) publica data.json / analysis.txt
sudo groupadd -f dashdeploy
sudo usermod -aG dashdeploy gh-runner
sudo usermod -aG dashdeploy hermes-svc

sudo chgrp -R dashdeploy /var/www/azure-dashboard
sudo chmod -R g+rwX /var/www/azure-dashboard
# setgid: lo que se cree adentro hereda el grupo
sudo find /var/www/azure-dashboard -type d -exec chmod g+s {} +

# que los archivos nuevos de cualquiera de los dos queden escribibles por el grupo
sudo apt-get install -y acl rsync
sudo setfacl -R -d -m g:dashdeploy:rwX /var/www/azure-dashboard
```

Comprueba:

```bash
sudo -u gh-runner test -w /var/www/azure-dashboard && echo "gh-runner puede escribir"
sudo -u hermes-svc test -w /var/www/azure-dashboard && echo "hermes-svc puede escribir"
```

> Si el wrapper de n8n (publish) escribe con otro usuario, agrégalo también al grupo.
> Corre una ejecución del workflow de n8n después de este paso para confirmar que
> `data.json` se sigue publicando.

## 2. Instalar el runner

En GitHub: **Settings → Actions → Runners → New self-hosted runner → Linux x64**. Copia el
token que te muestra (dura una hora) y en vcubnt01:

```bash
sudo -iu gh-runner
mkdir -p ~/actions-runner && cd ~/actions-runner
# usa la versión y el checksum exactos que te muestra GitHub en esa pantalla
curl -o actions-runner.tar.gz -L https://github.com/actions/runner/releases/download/vX.Y.Z/actions-runner-linux-x64-X.Y.Z.tar.gz
tar xzf actions-runner.tar.gz

./config.sh --url https://github.com/vicoscanseco/dashboard-cost-azure \
  --token AAATRNVZJ34XAJ6NTGO5NVLKZKU5M --name vcubnt01 --labels vcubnt01 --unattended
exit
```

Instálalo como servicio (arranca solo con el servidor):

```bash
cd /home/gh-runner/actions-runner
sudo ./svc.sh install gh-runner
sudo ./svc.sh start
sudo ./svc.sh status
```

En GitHub el runner debe aparecer como **Idle** con las etiquetas
`self-hosted, Linux, X64, vcubnt01`.

## 3. Ajustes en GitHub

- **Settings → Environments → New environment → `production`**. Opcional: "Required
  reviewers" con tu usuario si quieres aprobar cada deploy a mano.
- **Settings → Secrets and variables → Actions → Variables → `DASHBOARD_LOCAL_URL`** con la
  URL local del nginx del dashboard (ej. `http://127.0.0.1:8088`). Con esto la prueba de
  humo valida que la página y `data.json` respondan. Sin la variable solo revisa archivos.

## 4. Primer deploy

1. Haz push a `main` (o **Actions → CI y deploy del dashboard → Run workflow**).
2. Revisa que `build` y `deploy` terminen en verde.
3. Abre el dashboard: la tarjeta **Salud del pipeline** (sección Operación) te dice si los
   datos están al día.

## Rollback

Cada deploy deja un respaldo de la versión anterior en
`/home/gh-runner/dashboard-backups/<fecha>` (se guardan los 5 más recientes):

```bash
sudo -u gh-runner rsync -rlt --delete --exclude data.json --exclude analysis.txt \
  /home/gh-runner/dashboard-backups/<fecha>/ /var/www/azure-dashboard/
```

O vuelve a correr el workflow sobre un commit anterior (**Run workflow** desde esa rama o
tag).

## Problemas comunes

| Síntoma | Causa probable |
|---|---|
| `deploy` se queda en "Waiting for a runner" | El servicio del runner está detenido: `sudo ./svc.sh status` |
| "El runner no puede escribir en /var/www/azure-dashboard" | Falta el paso 1 o el runner arrancó antes de agregarlo al grupo: `sudo ./svc.sh stop && sudo ./svc.sh start` |
| El dashboard muestra datos de ejemplo | Se publicó un build sin el paso que borra `data.json`; vuelve a correr n8n o restaura el respaldo |
| `npm ci` falla en `build` | `package-lock.json` desactualizado: corre `npm install` local y haz commit del lock |
