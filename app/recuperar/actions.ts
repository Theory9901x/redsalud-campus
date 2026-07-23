"use server";

import { randomInt, createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { enviarCorreo, plantillaCodigoRecuperacion, correoConfigurado } from "@/lib/correo";
import { registrarAuditoria } from "@/lib/audit";

const VIGENCIA_MINUTOS = 15;
const MAX_INTENTOS = 5;

/** El código se guarda hasheado; nunca en claro en la base. */
const hashCodigo = (codigo: string) => createHash("sha256").update(codigo).digest("hex");

export type EstadoSolicitud = { error: string | null; enviado?: boolean };

/**
 * Paso 1: la persona escribe su correo (o usuario) y se le envía un código.
 *
 * El código se manda SIEMPRE a la dirección registrada en la cuenta, no a la
 * que se escribió: si se enviara al texto tecleado, cualquiera podría pedir el
 * código de otra persona a su propio correo y tomarle la cuenta.
 *
 * La respuesta es la misma exista o no la cuenta, para no convertir esta
 * pantalla en una forma de averiguar qué correos están registrados.
 */
export async function solicitarCodigoAction(
  _prev: EstadoSolicitud,
  formData: FormData
): Promise<EstadoSolicitud> {
  const identificador = String(formData.get("identificador") ?? "").trim().toLowerCase();
  if (!identificador) return { error: "Escribe tu correo o usuario." };

  const user = await prisma.user.findFirst({
    where: { OR: [{ email: identificador }, { username: identificador }] },
    select: { id: true, fullName: true, email: true, status: true },
  });

  // Cuenta inexistente o inactiva: se responde igual que en el caso exitoso.
  if (!user || user.status !== "ACTIVE") {
    return { error: null, enviado: true };
  }

  // Un código vigente por persona: los anteriores se invalidan.
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });

  const codigo = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      codeHash: hashCodigo(codigo),
      expiresAt: new Date(Date.now() + VIGENCIA_MINUTOS * 60_000),
    },
  });

  const { texto, html } = plantillaCodigoRecuperacion(user.fullName, codigo, VIGENCIA_MINUTOS);
  const enviado = await enviarCorreo({
    para: user.email,
    asunto: "Código para restablecer tu contraseña",
    html,
    texto,
  });

  await registrarAuditoria({
    userId: user.id,
    action: "RESET_PASSWORD",
    entity: "User",
    entityId: user.id,
    description: enviado
      ? "Solicitó un código de recuperación de contraseña"
      : "Solicitó recuperación, pero el correo no pudo enviarse (SMTP sin configurar)",
  });

  if (!enviado && !correoConfigurado()) {
    return {
      error:
        "El envío de correos aún no está configurado en la plataforma. Comunícate con Talento Humano para restablecer tu contraseña.",
    };
  }

  return { error: null, enviado: true };
}

export type EstadoCambio = { error: string | null; exito?: boolean };

/**
 * Paso 2 y 3: valida el código y cambia la contraseña en la misma operación.
 *
 * Se hace en un solo paso del servidor a propósito: si se validara el código
 * en una acción y se cambiara la clave en otra, habría que confiar en que el
 * cliente diga "ya validé", que es justo lo que no se puede confiar.
 */
export async function cambiarConCodigoAction(
  _prev: EstadoCambio,
  formData: FormData
): Promise<EstadoCambio> {
  const identificador = String(formData.get("identificador") ?? "").trim().toLowerCase();
  const codigo = String(formData.get("codigo") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmar = String(formData.get("confirmar") ?? "");

  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };
  if (password !== confirmar) return { error: "Las contraseñas no coinciden." };

  const user = await prisma.user.findFirst({
    where: { OR: [{ email: identificador }, { username: identificador }] },
    select: { id: true, fullName: true },
  });
  const token = user
    ? await prisma.passwordResetToken.findFirst({
        where: { userId: user.id, usedAt: null },
        orderBy: { createdAt: "desc" },
      })
    : null;

  // Mensaje único para código inexistente, vencido o equivocado: distinguirlos
  // le diría a quien prueba códigos si va por buen camino.
  const invalido = { error: "El código no es válido o ya venció. Solicita uno nuevo." };
  if (!user || !token) return invalido;
  if (token.expiresAt < new Date()) return invalido;

  if (token.attempts >= MAX_INTENTOS) {
    await prisma.passwordResetToken.delete({ where: { id: token.id } });
    return { error: "Demasiados intentos fallidos. Solicita un código nuevo." };
  }

  if (token.codeHash !== hashCodigo(codigo)) {
    await prisma.passwordResetToken.update({
      where: { id: token.id },
      data: { attempts: { increment: 1 } },
    });
    return invalido;
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(password, 10), mustChangePassword: false },
    }),
    prisma.passwordResetToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
  ]);

  await registrarAuditoria({
    userId: user.id,
    action: "RESET_PASSWORD",
    entity: "User",
    entityId: user.id,
    description: "Restableció su contraseña con un código enviado a su correo",
  });

  return { error: null, exito: true };
}
