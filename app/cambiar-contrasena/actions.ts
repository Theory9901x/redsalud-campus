"use server";

import bcrypt from "bcryptjs";
import { auth, signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { changePasswordSchema } from "@/lib/validations/profile";
import { registrarAuditoria } from "@/lib/audit";

export type EstadoCambio = { error: string | null; exito?: boolean };

/**
 * Cambio de contraseña obligatorio, para cualquier rol.
 *
 * Existe aparte del que vive en el perfil del estudiante porque este lo usa
 * gente que todavía no puede entrar a ninguna otra parte: mientras la
 * contraseña siga siendo la temporal, el proxy la trae aquí. Un tutor o un
 * administrador no tienen perfil de estudiante donde cambiarla.
 */
export async function cambiarContrasenaObligatoriaAction(
  _previo: EstadoCambio,
  formData: FormData
): Promise<EstadoCambio> {
  const session = await auth();
  if (!session?.user) return { error: "Debes iniciar sesión." };

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmNewPassword: formData.get("confirmNewPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });

  if (!(await bcrypt.compare(parsed.data.currentPassword, user.passwordHash))) {
    return { error: "La contraseña actual no es correcta." };
  }
  if (await bcrypt.compare(parsed.data.newPassword, user.passwordHash)) {
    return { error: "La nueva contraseña tiene que ser distinta de la temporal." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(parsed.data.newPassword, 10), mustChangePassword: false },
  });

  await registrarAuditoria({
    userId: user.id,
    action: "UPDATE",
    entity: "User",
    entityId: user.id,
    description: "Cambió su contraseña temporal en el primer ingreso.",
  });

  // El token trae mustChangePassword=true congelado desde el login y se
  // revalida cada cierto tiempo; sin volver a autenticar, el proxy seguiría
  // devolviendo a esta página con la contraseña ya cambiada.
  //
  // El identificador es el correo O el nombre de usuario: las cuentas de área
  // no tienen correo, y con `email: null` el reingreso fallaba en silencio.
  await signIn("credentials", {
    email: user.email ?? user.username,
    password: parsed.data.newPassword,
    redirect: false,
  });

  return { error: null, exito: true };
}
