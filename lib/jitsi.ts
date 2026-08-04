import { SignJWT } from "jose";

/**
 * Token de acceso a la sala Jitsi PROPIA de la entidad.
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
export async function firmarTokenJitsi(displayName: string): Promise<string | null> {
  const appId = process.env.JITSI_JWT_APP_ID;
  const secret = process.env.JITSI_JWT_APP_SECRET;
  if (!appId || !secret) return null;

  return new SignJWT({
    aud: "jitsi",
    iss: appId,
    sub: "*",
    room: "*",
    context: { user: { name: displayName } },
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("6h")
    .sign(new TextEncoder().encode(secret));
}
