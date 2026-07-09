"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
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
  await requireAdmin();

  const parsed = createUserSchema.safeParse({
    fullName: formData.get("fullName"),
    documentType: formData.get("documentType"),
    documentNumber: formData.get("documentNumber"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    profession: formData.get("profession"),
    position: formData.get("position"),
    department: formData.get("department"),
    personnelType: formData.get("personnelType"),
    role: formData.get("role"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const { password, ...data } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    await prisma.user.create({
      data: {
        ...data,
        phone: data.phone || null,
        profession: data.profession || null,
        position: data.position || null,
        department: data.department || null,
        passwordHash,
        mustChangePassword: true,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { error: "Ya existe un usuario con ese correo o número de documento." };
    }
    throw error;
  }

  revalidatePath("/admin/usuarios");
  redirect("/admin/usuarios");
}

export async function updateUserAction(
  userId: string,
  _prevState: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  await requireAdmin();

  const parsed = updateUserSchema.safeParse({
    fullName: formData.get("fullName"),
    documentType: formData.get("documentType"),
    documentNumber: formData.get("documentNumber"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    profession: formData.get("profession"),
    position: formData.get("position"),
    department: formData.get("department"),
    personnelType: formData.get("personnelType"),
    role: formData.get("role"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const data = parsed.data;

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        ...data,
        phone: data.phone || null,
        profession: data.profession || null,
        position: data.position || null,
        department: data.department || null,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { error: "Ya existe un usuario con ese correo o número de documento." };
    }
    throw error;
  }

  revalidatePath("/admin/usuarios");
  revalidatePath(`/admin/usuarios/${userId}`);
  redirect("/admin/usuarios");
}

export async function toggleUserStatusAction(userId: string) {
  await requireAdmin();

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const nextStatus = user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

  await prisma.user.update({
    where: { id: userId },
    data: { status: nextStatus },
  });

  revalidatePath("/admin/usuarios");
  revalidatePath(`/admin/usuarios/${userId}`);
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
  await requireAdmin();

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: true },
  });

  revalidatePath(`/admin/usuarios/${userId}`);
  return { tempPassword };
}
