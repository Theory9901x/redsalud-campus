"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { categorySchema } from "@/lib/validations/course";

export type CategoryFormState = {
  error: string | null;
  success?: boolean;
};

function isUniqueConstraintError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function createCategoryAction(
  _prevState: CategoryFormState,
  formData: FormData
): Promise<CategoryFormState> {
  await requireAdmin();

  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await prisma.courseCategory.create({
      data: { name: parsed.data.name, description: parsed.data.description || null },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { error: "Ya existe una categoría con ese nombre." };
    }
    throw error;
  }

  revalidatePath("/admin/cursos/categorias");
  return { error: null, success: true };
}

export async function updateCategoryAction(
  categoryId: string,
  _prevState: CategoryFormState,
  formData: FormData
): Promise<CategoryFormState> {
  await requireAdmin();

  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await prisma.courseCategory.update({
      where: { id: categoryId },
      data: { name: parsed.data.name, description: parsed.data.description || null },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { error: "Ya existe una categoría con ese nombre." };
    }
    throw error;
  }

  revalidatePath("/admin/cursos/categorias");
  return { error: null, success: true };
}

export async function toggleCategoryActiveAction(categoryId: string) {
  await requireAdmin();

  const category = await prisma.courseCategory.findUniqueOrThrow({ where: { id: categoryId } });
  await prisma.courseCategory.update({
    where: { id: categoryId },
    data: { isActive: !category.isActive },
  });

  revalidatePath("/admin/cursos/categorias");
}
