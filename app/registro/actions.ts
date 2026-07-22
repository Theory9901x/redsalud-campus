"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isUniqueConstraintError } from "@/lib/prisma-errors";
import { registerSchema } from "@/lib/validations/register";

export type RegisterState = {
  error: string | null;
};

export async function registerAction(_prevState: RegisterState, formData: FormData): Promise<RegisterState> {
  const parsed = registerSchema.safeParse({
    fullName: formData.get("fullName"),
    documentType: formData.get("documentType"),
    documentNumber: formData.get("documentNumber"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
    profession: formData.get("profession") ?? "",
    position: formData.get("position") ?? "",
    personnelType: formData.get("personnelType"),
    municipioId: formData.get("municipioId"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const data = parsed.data;
  const passwordHash = await bcrypt.hash(data.password, 10);

  try {
    await prisma.user.create({
      data: {
        fullName: data.fullName,
        documentType: data.documentType,
        documentNumber: data.documentNumber,
        email: data.email,
        phone: data.phone || null,
        profession: data.profession || null,
        position: data.position || null,
        municipioId: data.municipioId,
        personnelType: data.personnelType,
        passwordHash,
        role: "STUDENT",
        status: "ACTIVE",
        mustChangePassword: false,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { error: "Ya existe una cuenta con ese correo o número de documento." };
    }
    throw error;
  }

  try {
    await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirectTo: "/",
    });
    return { error: null };
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Tu cuenta se creó, pero no pudimos iniciar sesión automáticamente. Intenta iniciar sesión." };
    }
    throw error;
  }
}
