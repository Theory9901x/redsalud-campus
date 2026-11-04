# Jitsi: solo el anfitrión modera

## Problema

En las reuniones todos reciben un pase (JWT) para que la sala arranque sin
esperar al anfitrión. Jicofo tiene la autenticación JWT activa y convierte
en moderador a todo el que trae pase. Así, cualquier participante podía
"Terminar la reunión para todos". El 4-nov-2026 a las 11:07 (Colombia) un
participante cerró así una reunión en curso. Prosody lo registró como
`end_conference ... destroyed by occupant`.

## Qué hace la plataforma (ya en el código)

- `lib/jitsi.ts` firma el pase con `context.user.moderator` y
  `context.user.affiliation`: `owner` solo para el anfitrión y `member` para
  los demás.
- En celular, el botón nativo de colgar de Jitsi solo lo ve el anfitrión.
  Los demás salen con el botón propio "Salir de la reunión", que solo los
  saca a ellos.
- El pase dura 24 h, lo mismo que puede durar abierta una reunión.

Sin el cambio del servidor, Jitsi ignora el claim de rol y todo el que trae
pase sigue moderando. El botón propio en celular protege desde el primer
despliegue.

## Cambio en el servidor de video (pendiente de aplicar)

Recrear prosody y jicofo corta TODAS las llamadas en curso. Hazlo solo sin
reuniones activas y con el aviso del usuario.

```bash
cd /opt/jitsi/docker-jitsi-meet
cp .env .env.bak-$(date +%Y%m%d-%H%M)
# Módulo que asigna el rol según el pase. Si XMPP_MUC_MODULES ya tiene
# valores, añadir token_affiliation separado por coma.
grep -q '^XMPP_MUC_MODULES=' .env && sed -i 's/^XMPP_MUC_MODULES=\(.*\)$/XMPP_MUC_MODULES=\1,token_affiliation/' .env || echo 'XMPP_MUC_MODULES=token_affiliation' >> .env
sed -i 's/^XMPP_MUC_MODULES=,/XMPP_MUC_MODULES=/' .env
# Jicofo deja de convertir en moderador a todo autenticado.
grep -q '^ENABLE_AUTO_OWNER=' .env && sed -i 's/^ENABLE_AUTO_OWNER=.*/ENABLE_AUTO_OWNER=0/' .env || echo 'ENABLE_AUTO_OWNER=0' >> .env
docker compose up -d prosody jicofo
```

## Verificación (obligatoria, antes de dar por cerrado)

1. Una cuenta participante (sin gestión de la reunión) entra a `/sala/<id>`
   y la sala arranca sola, sin "esperando al anfitrión".
2. En jicofo ese participante aparece con `role=PARTICIPANT` y no sube a
   moderador:
   `docker logs --since 10m docker-jitsi-meet-jicofo-1 | grep -E "Member joined|grantOwnership|role="`
3. El anfitrión entra y queda como moderador. En celular ve "Terminar para
   todos". El participante no lo ve.
4. Un invitado externo por `/invitado/<id>` entra y queda conectado.
5. Limpiar la prueba con `scripts/limpiar-prueba-movil.ts <activityId>`.

Si la sala no arranca sin anfitrión, revertir de inmediato:

```bash
cd /opt/jitsi/docker-jitsi-meet && cp .env.bak-<fecha> .env && docker compose up -d prosody jicofo
```
