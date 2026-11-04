import { SignJWT } from "jose";

/**
 * Token de acceso a la sala Jitsi PROPIA de la entidad.
 *
 * ROL EN EL PASE: `moderador` decide quién modera. Solo el anfitrión
 * (quien responde por la reunión o la capacitación) va con moderador=true;
 * los demás llevan pase para que la sala ARRANQUE sin esperar a nadie, pero
 * como participantes: no pueden silenciar, expulsar ni "terminar la reunión
 * para todos". El servidor lo aplica con el módulo token_affiliation de
 * Prosody y ENABLE_AUTO_OWNER=0 en Jicofo (ver docs/jitsi-roles.md). Sin
 * ese ajuste en el servidor, el claim se ignora y todo autenticado modera.
 *
 * El servidor corre con autenticación JWT: quien trae token firmado por la
 * plataforma entra como usuario autenticado (el personal: puede moderar,
 * silenciar, expulsar); quien no trae token entra como INVITADO sin ningún
 * control de moderación -exactamente lo que corresponde a los externos- y
 * además la sala solo arranca cuando entra alguien autenticado.
 *
 * Null si el entorno no tiene las llaves (p. ej. desarrollo apuntando a un
 * Jitsi sin auth): la sala simplemente no envía token.
 */
export async function firmarTokenJitsi(displayName: string, { moderador }: { moderador: boolean }): Promise<string | null> {
  const appId = process.env.JITSI_JWT_APP_ID;
  const secret = process.env.JITSI_JWT_APP_SECRET;
  if (!appId || !secret) return null;

  return new SignJWT({
    aud: "jitsi",
    iss: appId,
    sub: "*",
    room: "*",
    context: { user: { name: displayName, moderator: moderador, affiliation: moderador ? "owner" : "member" } },
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    // 24 h: una reunión puede seguir abierta un día entero y Jitsi revalida
    // el token al reconectar; con 6 h, una reconexión tardía se rechazaba.
    .setExpirationTime("24h")
    .sign(new TextEncoder().encode(secret));
}
