#!/usr/bin/env bash
#
# Despliegue sin romper la aplicación mientras compila.
#
# El problema que resuelve: `next build` reescribe el directorio de salida
# mientras `next start` sirve desde él, y como Next carga sus trozos de código
# a medida que los necesita, durante los ~40 s de compilación cualquiera que
# estuviera navegando recibía ChunkLoadError y un 500. Aquí se compila SIEMPRE
# en el directorio que no está en uso y solo al final se reinicia apuntando al
# nuevo, así que la versión vieja sigue entera hasta el último segundo.
#
#   ./scripts/desplegar.sh              despliegue normal
#   ./scripts/desplegar.sh --migrar     además aplica migraciones de Prisma
#
set -euo pipefail

APP=redsalud-campus
RAIZ=/opt/redsalud/current
ESTADO=/opt/redsalud/.dist-activo

cd "$RAIZ"

activo=$(cat "$ESTADO" 2>/dev/null || echo ".next")
if [ "$activo" = ".next-a" ]; then nuevo=".next-b"; else nuevo=".next-a"; fi
echo "▸ sirviendo desde: $activo   ·   se compilará en: $nuevo"

echo "▸ trayendo cambios"
# next build reescribe tsconfig.json para registrar los tipos de su distDir.
# Los dos directorios ya vienen declarados en el repositorio, así que no
# debería tocarlo; si aun así lo hace, se descarta ese cambio para que el
# pull no encuentre el árbol sucio y aborte el despliegue.
git checkout -- tsconfig.json 2>/dev/null || true
git pull --ff-only

# Dependencias nuevas: sin esto, un paquete añadido en el commit rompe el
# build en el servidor con "module not found" (pasó con sanitize-html).
echo "▸ dependencias"
npm install --no-audit --no-fund --loglevel=error

if [ "${1:-}" = "--migrar" ]; then
  echo "▸ migraciones"
  npx prisma migrate deploy
fi

echo "▸ cliente de Prisma"
npx prisma generate >/dev/null

# Pestañas abiertas de ANTES del despliegue. Sin lo de abajo, quien tenía el
# login o un formulario abierto recibía "This page couldn't load": cada build
# generaba una clave nueva, y con ella identificadores nuevos para todas las
# acciones de servidor, así que el servidor recién subido no reconocía las que
# enviaba la pestaña vieja (el log de errores era casi todo "Failed to find
# Server Action").
#
#  1. Clave de acciones FIJA, guardada fuera del repositorio: los
#     identificadores dejan de cambiar en cada build.
#  2. Identificador de despliegue: cuando una pestaña vieja navega, Next nota
#     el desfase y recarga la página completa en vez de mezclar versiones.
CLAVE=/opt/redsalud/.clave-acciones
if [ ! -s "$CLAVE" ]; then
  (umask 077 && openssl rand -base64 32 > "$CLAVE")
fi
export NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="$(cat "$CLAVE")"
export NEXT_DEPLOYMENT_ID="$(git rev-parse --short HEAD)"

echo "▸ compilando (la aplicación sigue en línea)"
rm -rf "$nuevo"
# Los tipos generados de la build ANTERIOR referencian las rutas de aquel
# momento: si este despliegue ELIMINA una página, el typecheck del build
# nuevo tropieza con ese validator viejo. Son artefactos de compilación, no
# de ejecución: borrarlos no toca al servidor que sigue sirviendo.
rm -rf "$activo/types" .next/types
NEXT_DIST_DIR="$nuevo" nice -n 19 npm run build

#  3. Los archivos estáticos de la versión anterior se conservan dentro de la
#     nueva. Llevan el hash en el nombre, así que no chocan; sin ellos, una
#     pestaña vieja que pide un trozo de código que aún no había cargado
#     recibe 404 y la página se cae. Se purgan a los 14 días.
if [ -d "$activo/static" ]; then
  cp -rnp "$activo/static/." "$nuevo/static/" 2>/dev/null || true
  find "$nuevo/static" -type f -mtime +14 -delete 2>/dev/null || true
fi

# A partir de aquí el build nuevo está completo: el reinicio es lo único que
# corta, y dura lo que tarde el proceso en levantar.
echo "▸ reiniciando"
NEXT_DIST_DIR="$nuevo" pm2 restart "$APP" --update-env >/dev/null
echo "$nuevo" > "$ESTADO"

sleep 6
if curl -fs -o /dev/null http://127.0.0.1:3200/login; then
  echo "▸ en línea sobre $nuevo"
  # Guardar el estado de PM2 con el NEXT_DIST_DIR nuevo: si el servidor se
  # reinicia, PM2 resucita desde este volcado. Sin esto vuelve a la carpeta
  # anterior, que se borra justo abajo, y el sitio queda en 502.
  pm2 save >/dev/null
  # El anterior ya no lo usa nadie; se conserva el .next original por si hay
  # que volver a mano, pero los alternos sí se limpian.
  [ "$activo" != ".next" ] && rm -rf "$activo" || true
  pm2 describe "$APP" | grep -E '│ status'
else
  echo "✗ no responde tras el reinicio. Revisa: pm2 logs $APP"
  exit 1
fi
