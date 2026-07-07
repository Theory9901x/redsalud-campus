"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { auth, signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { saveAvatarImage } from "@/lib/storage";
import { changePasswordSchema } from "@/lib/validations/profile";

export type ChangePasswordState = { error: string | null; success?: boolean };
export type AvatarUploadState = { error: string | null };

const MAX_AVATAR_SIZE = 8 * 1024 * 1024;

export async function changePasswordAction(
  _prevState: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
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
  const currentMatches = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!currentMatches) {
    return { error: "La contraseña actual no es correcta." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash, mustChangePassword: false },
  });

  // La sesión (JWT) trae mustChangePassword=true "congelado" desde el login.
  // Sin esto, el proxy seguiría mandando al usuario de vuelta a /perfil
  // aunque la contraseña ya haya cambiado. Reautenticar con la nueva
  // contraseña refresca el token con el valor correcto.
  await signIn("credentials", {
    email: user.email,
    password: parsed.data.newPassword,
    redirect: false,
  });

  return { error: null, success: true };
}

export async function uploadAvatarAction(
  _prevState: AvatarUploadState,
  formData: FormData
): Promise<AvatarUploadState> {
  const session = await auth();
  if (!session?.user) return { error: "Debes iniciar sesión." };

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecciona una imagen primero." };
  }
  if (!file.type.startsWith("image/")) {
    return { error: "El archivo debe ser una imagen." };
  }
  if (file.size > MAX_AVATAR_SIZE) {
    return { error: "La imagen no puede pesar más de 8 MB." };
  }

  try {
    await saveAvatarImage(file, session.user.id);
  } catch (error) {
    console.error("Error subiendo avatar:", error);
    return { error: "No se pudo guardar la imagen. Intenta de nuevo." };
  }

  revalidatePath("/perfil");
  revalidatePath("/inicio");
  revalidatePath("/mi-aula");
  return { error: null };
}
