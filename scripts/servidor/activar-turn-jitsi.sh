#!/usr/bin/env bash
# =====================================================================
# RELÉ DE AUDIO Y VIDEO (TURN) PARA JITSI
#
# Problema: algunas redes (wifi institucional, firewalls) bloquean el puerto
# UDP 10000 por donde viaja el audio y el video. Esas personas entran a la
# reunión, ven el chat, pero no escuchan nada. Con un relé TURN (coturn) el
# audio también puede ir por TCP 3478 o por TLS 5349.
#
# Qué hace (idempotente, con respaldos):
#   1. Instala y configura coturn en este servidor.
#   2. Copia el certificado de Let's Encrypt para coturn (y en cada renovación).
#   3. Abre los puertos en ufw.
#   4. Le dice a Jitsi que ofrezca el relé (TURN_* en el .env).
#   5. Mantiene apagado "Terminar la reunión para todos" (ENABLE_END_CONFERENCE=0).
#   6. Con --roles, además aplica "solo el anfitrión modera" (docs/jitsi-roles.md).
#   7. Recrea prosody y jicofo.  ESTO CORTA LAS LLAMADAS EN CURSO.
#
# Uso (en el servidor, como root):
#   bash /opt/redsalud/current/scripts/servidor/activar-turn-jitsi.sh            # se detiene si hay reuniones
#   FORZAR=1 bash .../activar-turn-jitsi.sh                                      # aunque haya reuniones
#   bash .../activar-turn-jitsi.sh --roles                                       # + solo el anfitrión modera
#
# Reversa: cp /opt/jitsi/docker-jitsi-meet/.env.bak-<fecha> /opt/jitsi/docker-jitsi-meet/.env
#          cd /opt/jitsi/docker-jitsi-meet && docker compose up -d prosody jicofo
# =====================================================================
set -euo pipefail

DOM=campusvirtual.redsaludteforma.com
IP=2.25.210.122
JITSI=/opt/jitsi/docker-jitsi-meet
FECHA=$(date +%Y%m%d-%H%M)
ROLES=0
[ "${1:-}" = "--roles" ] && ROLES=1

paso() { printf '\n▸ %s\n' "$*"; }

# ── 0. ¿Hay reuniones en curso? ──────────────────────────────────────
paso "reuniones activas"
SALAS=$(docker exec docker-jitsi-meet-prosody-1 sh -c 'prosodyctl --config /run/prosody/config/prosody.cfg.lua shell "muc:list(\"muc.meet.jitsi\")" 2>/dev/null' | grep -o 'OK: [0-9]* rooms' | grep -o '[0-9]*' || echo 0)
echo "salas abiertas: $SALAS"
if [ "$SALAS" != "0" ] && [ "${FORZAR:-0}" != "1" ]; then
  echo "Hay salas abiertas. Recrear prosody las corta. Repite con FORZAR=1 cuando no haya reuniones."
  exit 1
fi

# ── 1. coturn ────────────────────────────────────────────────────────
paso "instalando coturn"
export DEBIAN_FRONTEND=noninteractive
command -v turnserver >/dev/null || apt-get install -y -q coturn

SECRETO=$(grep -s '^static-auth-secret=' /etc/turnserver.conf | cut -d= -f2 || true)
[ -n "$SECRETO" ] || SECRETO=$(openssl rand -hex 32)

# ── 2. certificado para coturn ───────────────────────────────────────
paso "certificado"
install -d -m 755 /etc/letsencrypt/renewal-hooks/deploy
cat > /etc/letsencrypt/renewal-hooks/deploy/coturn.sh <<EOF
#!/bin/sh
install -d -o turnserver -g turnserver -m 750 /etc/coturn/certs
install -o turnserver -g turnserver -m 640 /etc/letsencrypt/live/$DOM/fullchain.pem /etc/coturn/certs/fullchain.pem
install -o turnserver -g turnserver -m 640 /etc/letsencrypt/live/$DOM/privkey.pem /etc/coturn/certs/privkey.pem
systemctl restart coturn 2>/dev/null || true
EOF
chmod 755 /etc/letsencrypt/renewal-hooks/deploy/coturn.sh
/etc/letsencrypt/renewal-hooks/deploy/coturn.sh

# ── 3. configuración ─────────────────────────────────────────────────
paso "configurando coturn"
[ -f /etc/turnserver.conf ] && cp /etc/turnserver.conf "/etc/turnserver.conf.bak-$FECHA"
cat > /etc/turnserver.conf <<EOF
# Relé TURN para Jitsi (scripts/servidor/activar-turn-jitsi.sh)
listening-port=3478
tls-listening-port=5349
external-ip=$IP
min-port=49160
max-port=49200
fingerprint
use-auth-secret
static-auth-secret=$SECRETO
realm=$DOM
server-name=$DOM
cert=/etc/coturn/certs/fullchain.pem
pkey=/etc/coturn/certs/privkey.pem
no-tlsv1
no-tlsv1_1
no-cli
no-multicast-peers
# Nada de relé hacia redes privadas: solo hacia la IP pública del videobridge.
denied-peer-ip=0.0.0.0-0.255.255.255
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=100.64.0.0-100.127.255.255
denied-peer-ip=127.0.0.0-127.255.255.255
denied-peer-ip=169.254.0.0-169.254.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.168.0.0-192.168.255.255
total-quota=200
stale-nonce=600
syslog
simple-log
EOF
chmod 640 /etc/turnserver.conf
chgrp turnserver /etc/turnserver.conf 2>/dev/null || true
[ -f /etc/default/coturn ] && sed -i 's/^#\?TURNSERVER_ENABLED=.*/TURNSERVER_ENABLED=1/' /etc/default/coturn
systemctl enable coturn >/dev/null 2>&1 || true
systemctl restart coturn
sleep 1
systemctl is-active coturn
ss -ltnup | grep -E ':(3478|5349) ' || { echo "coturn no quedó escuchando"; exit 1; }

# ── 4. firewall ──────────────────────────────────────────────────────
paso "firewall"
ufw allow 3478/udp >/dev/null
ufw allow 3478/tcp >/dev/null
ufw allow 5349/tcp >/dev/null
ufw allow 49160:49200/udp >/dev/null
ufw status | grep -E '3478|5349|49160'

# ── 5. Jitsi ─────────────────────────────────────────────────────────
paso "configurando Jitsi"
cd "$JITSI"
cp .env ".env.bak-$FECHA"
poner() { if grep -q "^$1=" .env; then sed -i "s|^$1=.*|$1=$2|" .env; else echo "$1=$2" >> .env; fi; }
poner TURN_CREDENTIALS "$SECRETO"
poner TURN_HOST "$DOM"
poner TURN_PORT 3478
poner TURN_TRANSPORT "udp,tcp"
poner TURNS_HOST "$DOM"
poner TURNS_PORT 5349
# "Terminar la reunión para todos" sigue apagado, como quedó el 4-nov-2026.
poner ENABLE_END_CONFERENCE 0
if [ "$ROLES" = "1" ]; then
  if grep -q '^XMPP_MUC_MODULES=' .env; then
    grep -q '^XMPP_MUC_MODULES=.*token_affiliation' .env || sed -i 's/^XMPP_MUC_MODULES=\(.*\)$/XMPP_MUC_MODULES=\1,token_affiliation/' .env
    sed -i 's/^XMPP_MUC_MODULES=,/XMPP_MUC_MODULES=/' .env
  else
    echo 'XMPP_MUC_MODULES=token_affiliation' >> .env
  fi
  poner ENABLE_AUTO_OWNER 0
fi
echo "respaldo: $JITSI/.env.bak-$FECHA"

paso "recreando prosody y jicofo (corta las llamadas en curso)"
docker compose up -d prosody jicofo
sleep 8

# ── 6. verificación ──────────────────────────────────────────────────
paso "verificación"
docker ps --format '{{.Names}} {{.Status}}' | grep jitsi
grep -A12 'external_services = {' /run/prosody/config/prosody.cfg.lua 2>/dev/null | head -14 \
  || docker exec docker-jitsi-meet-prosody-1 sh -c "grep -A12 'external_services = {' /config/prosody.cfg.lua | head -14"
if command -v turnutils_uclient >/dev/null; then
  echo "prueba de relé por TCP:"
  timeout 20 turnutils_uclient -t -W "$SECRETO" -n 3 -m 1 -e "$IP" -r 10000 "$IP" 2>&1 | grep -E 'Total|error|ERROR' | head -5 || true
fi
echo
echo "Listo. Pide a alguien en una red que antes no escuchaba que recargue la sala."
