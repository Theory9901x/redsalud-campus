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
git pull --ff-only

if [ "${1:-}" = "--migrar" ]; then
  echo "▸ migraciones"
  npx prisma migrate deploy
fi

echo "▸ cliente de Prisma"
npx prisma generate >/dev/null

echo "▸ compilando (la aplicación sigue en línea)"
rm -rf "$nuevo"
NEXT_DIST_DIR="$nuevo" nice -n 19 npm run build

# A partir de aquí el build nuevo está completo: el reinicio es lo único que
# corta, y dura lo que tarde el proceso en levantar.
echo "▸ reiniciando"
NEXT_DIST_DIR="$nuevo" pm2 restart "$APP" --update-env >/dev/null
echo "$nuevo" > "$ESTADO"

sleep 6
if curl -fs -o /dev/null http://127.0.0.1:3200/login; then
  echo "▸ en línea sobre $nuevo"
  # El anterior ya no lo usa nadie; se conserva el .next original por si hay
  # que volver a mano, pero los alternos sí se limpian.
  [ "$activo" != ".next" ] && rm -rf "$activo" || true
  pm2 describe "$APP" | grep -E '│ status'
else
  echo "✗ no responde tras el reinicio. Revisa: pm2 logs $APP"
  exit 1
fi
