"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { registrarAuditoria } from "@/lib/audit";
import { createUserSchema, updateUserSchema } from "@/lib/validations/user";

export type UserFormState = {
  error: string | null;
};

function isUniqueConstraintError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function createUserAction(
  _prevState: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  const sesionAudit = await requireAdmin();

  const parsed = createUserSchema.safeParse({
    fullName: formData.get("fullName"),
    documentType: formData.get("documentType"),
    documentNumber: formData.get("documentNumber"),
    email: formData.get("email"),
    username: formData.get("username"),
    phone: formData.get("phone"),
    profession: formData.get("profession"),
    position: formData.get("position"),
    department: formData.get("department"),
    personnelType: formData.get("personnelType"),
    role: formData.get("role"),
    password: formData.get("password"),
    restrictedAdminSections: formData.getAll("restrictedAdminSections"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const { password, restrictedAdminSections, ...data } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 10);

  let creado;
  try {
    creado = await prisma.user.create({
      data: {
        ...data,
        // Vacío -> null: la cadena "" en un campo @unique chocaría con la de
        // cualquier otro usuario sin ese dato.
        email: data.email || null,
        username: data.username || null,
        phone: data.phone || null,
        profession: data.profession || null,
        position: data.position || null,
        department: data.department || null,
        passwordHash,
        mustChangePassword: true,
        // Las restricciones de sección solo tienen sentido para ADMIN; para
        // otros roles no hacen nada (el proxy solo las revisa bajo /admin),
        // pero se guarda vacío para no dejar datos ambiguos.
        restrictedAdminSections: data.role === "ADMIN" ? restrictedAdminSections : [],
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { error: "Ya existe un usuario con ese correo o número de documento." };
    }
    throw error;
  }

  await registrarAuditoria({
    userId: sesionAudit.user.id,
    action: "CREATE",
    entity: "User",
    entityId: creado.id,
    description: `Creó el usuario ${creado.fullName} (${creado.email})`,
  });

  revalidatePath("/admin/usuarios");
  redirect("/admin/usuarios");
}

export async function updateUserAction(
  userId: string,
  _prevState: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  const session = await requireAdmin();

  const parsed = updateUserSchema.safeParse({
    fullName: formData.get("fullName"),
    documentType: formData.get("documentType"),
    documentNumber: formData.get("documentNumber"),
    email: formData.get("email"),
    username: formData.get("username"),
    phone: formData.get("phone"),
    profession: formData.get("profession"),
    position: formData.get("position"),
    department: formData.get("department"),
    personnelType: formData.get("personnelType"),
    role: formData.get("role"),
    status: formData.get("status"),
    restrictedAdminSections: formData.getAll("restrictedAdminSections"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const { restrictedAdminSections, ...data } = parsed.data;

  // Un admin no puede quitarse a sí mismo el acceso a Usuarios: sin esto,
  // podría dejarse sin forma de revertirlo (nadie más podría editarlo).
  if (userId === session.user.id && restrictedAdminSections.includes("USUARIOS")) {
    return { error: "No puedes restringirte a ti mismo el acceso a Usuarios." };
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        ...data,
        email: data.email || null,
        username: data.username || null,
        phone: data.phone || null,
        profession: data.profession || null,
        position: data.position || null,
        department: data.department || null,
        restrictedAdminSections: data.role === "ADMIN" ? restrictedAdminSections : [],
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { error: "Ya existe un usuario con ese correo, usuario o número de documento." };
    }
    throw error;
  }

  await registrarAuditoria({
    userId: session.user.id,
    action: "UPDATE",
    entity: "User",
    entityId: userId,
    description: `Actualizó los datos de ${data.fullName}`,
  });

  revalidatePath("/admin/usuarios");
  revalidatePath(`/admin/usuarios/${userId}`);
  redirect("/admin/usuarios");
}

export async function toggleUserStatusAction(userId: string) {
  const sesion = await requireAdmin();

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const nextStatus = user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

  await prisma.user.update({
    where: { id: userId },
    data: { status: nextStatus },
  });

  await registrarAuditoria({
    userId: sesion.user.id,
    action: "UPDATE",
    entity: "User",
    entityId: userId,
    description: `${nextStatus === "ACTIVE" ? "Activó" : "Desactivó"} a ${user.fullName}`,
  });

  revalidatePath("/admin/usuarios");
  revalidatePath(`/admin/usuarios/${userId}`);
}

export type DeleteUserState = { error: string | null };

/**
 * Elimina un usuario DEFINITIVAMENTE.
 *
 * Borrar de verdad solo tiene sentido para cuentas creadas por error, sin
 * historia. Si la persona ya tiene certificados, dicta cursos o planes, o subió
 * archivos, borrarla perdería esos registros (o rompería referencias), así que
 * se bloquea y se sugiere DESACTIVAR —que es la herramienta correcta para la
 * rotación de personal: conserva su historia y le quita el acceso—.
 *
 * Lo que sí cuelga en cascada (inscripciones, progreso, intentos, asistencias,
 * notificaciones) se borra con la persona; la bitácora conserva sus entradas
 * con el autor en blanco.
 */
export async function deleteUserAction(userId: string): Promise<DeleteUserState> {
  const sesion = await requireAdmin();

  if (userId === sesion.user.id) {
    return { error: "No puedes eliminar tu propia cuenta." };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      fullName: true,
      _count: {
        select: { certificates: true, coursesTutored: true, mediaUploads: true, trainingPlansAsTutor: true },
      },
    },
  });
  if (!user) return { error: "El usuario ya no existe." };

  const c = user._count;
  const motivos: string[] = [];
  if (c.certificates > 0) motivos.push(`${c.certificates} certificado(s) emitido(s)`);
  if (c.coursesTutored > 0) motivos.push(`${c.coursesTutored} curso(s) como tutor`);
  if (c.trainingPlansAsTutor > 0) motivos.push(`${c.trainingPlansAsTutor} plan(es) de capacitación`);
  if (c.mediaUploads > 0) motivos.push(`${c.mediaUploads} archivo(s) subido(s)`);

  if (motivos.length > 0) {
    return {
      error: `No se puede eliminar a ${user.fullName} sin perder su historia (${motivos.join(", ")}). Usa "Desactivar" para quitarle el acceso conservando sus registros.`,
    };
  }

  try {
    await prisma.user.delete({ where: { id: userId } });
  } catch (error) {
    // Alguna referencia que no se contempló arriba (encuestas o notificaciones
    // que creó, etc.) impide el borrado. Mejor un mensaje claro que un 500.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return {
        error: `No se puede eliminar a ${user.fullName} porque tiene registros asociados en la plataforma. Usa "Desactivar" para quitarle el acceso conservando su historia.`,
      };
    }
    throw error;
  }

  await registrarAuditoria({
    userId: sesion.user.id,
    action: "DELETE",
    entity: "User",
    entityId: userId,
    description: `Eliminó definitivamente al usuario ${user.fullName}`,
  });

  revalidatePath("/admin/usuarios");
  return { error: null };
}

const TEMP_PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

function generateTempPassword(length = 10): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += TEMP_PASSWORD_CHARS[bytes[i] % TEMP_PASSWORD_CHARS.length];
  }
  return out;
}

/**
 * No hay servicio de correo configurado: el admin resetea la contraseña
 * aquí mismo y le comunica la temporal al usuario por su cuenta (teléfono,
 * en persona, etc.). Se obliga a cambiarla en el siguiente inicio de sesión.
 */
export async function resetPasswordAction(userId: string): Promise<{ tempPassword: string }> {
  const sesion = await requireAdmin();

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: true },
  });

  await registrarAuditoria({
    userId: sesion.user.id,
    action: "RESET_PASSWORD",
    entity: "User",
    entityId: userId,
    description: "Generó una contraseña temporal aleatoria",
  });

  revalidatePath(`/admin/usuarios/${userId}`);
  return { tempPassword };
}

/**
 * Igual que resetPasswordAction, pero con una contraseña elegida por el
 * admin en vez de una generada al azar. Sigue obligando el cambio en el
 * siguiente inicio de sesión: es una contraseña de arranque, no la
 * definitiva del usuario.
 */
export async function setCustomPasswordAction(
  userId: string,
  password: string
): Promise<{ error: string | null }> {
  const sesion = await requireAdmin();

  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: true },
  });

  await registrarAuditoria({
    userId: sesion.user.id,
    action: "RESET_PASSWORD",
    entity: "User",
    entityId: userId,
    description: "Asignó una contraseña específica",
  });

  revalidatePath(`/admin/usuarios/${userId}`);
  return { error: null };
}
