"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCourseAccess } from "@/lib/auth-helpers";
import { moduleSchema } from "@/lib/validations/course";

export type ModuleFormState = {
  error: string | null;
  success?: boolean;
};

async function moduleCourseId(moduleId: string) {
  const module_ = await prisma.courseModule.findUniqueOrThrow({
    where: { id: moduleId },
    select: { courseId: true },
  });
  return module_.courseId;
}

export async function createModuleAction(
  courseId: string,
  _prevState: ModuleFormState,
  formData: FormData
): Promise<ModuleFormState> {
  await requireCourseAccess(courseId);

  const parsed = moduleSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    isRequired: formData.get("isRequired") === "on" || formData.get("isRequired") === "true",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const count = await prisma.courseModule.count({ where: { courseId } });
  await prisma.courseModule.create({
    data: {
      courseId,
      title: parsed.data.title,
      description: parsed.data.description || null,
      isRequired: parsed.data.isRequired,
      sortOrder: count,
    },
  });

  revalidatePath(`/admin/cursos/${courseId}`);
  revalidatePath(`/tutor/cursos/${courseId}`);
  return { error: null, success: true };
}

export async function updateModuleAction(
  moduleId: string,
  _prevState: ModuleFormState,
  formData: FormData
): Promise<ModuleFormState> {
  const courseId = await moduleCourseId(moduleId);
  await requireCourseAccess(courseId);

  const parsed = moduleSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    isRequired: formData.get("isRequired") === "on" || formData.get("isRequired") === "true",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  await prisma.courseModule.update({
    where: { id: moduleId },
    data: {
      title: parsed.data.title,
      description: parsed.data.description || null,
      isRequired: parsed.data.isRequired,
    },
  });

  revalidatePath(`/admin/cursos/${courseId}`);
  revalidatePath(`/tutor/cursos/${courseId}`);
  return { error: null, success: true };
}

export async function deleteModuleAction(moduleId: string) {
  const courseId = await moduleCourseId(moduleId);
  await requireCourseAccess(courseId);

  await prisma.courseModule.delete({ where: { id: moduleId } });

  revalidatePath(`/admin/cursos/${courseId}`);
  revalidatePath(`/tutor/cursos/${courseId}`);
}

export async function reorderModulesAction(courseId: string, orderedModuleIds: string[]) {
  await requireCourseAccess(courseId);

  // Dos fases: primero valores negativos temporales para no chocar con la
  // restricción única (courseId, sortOrder) mientras se reordena.
  await prisma.$transaction([
    ...orderedModuleIds.map((id, index) =>
      prisma.courseModule.update({ where: { id }, data: { sortOrder: -(index + 1) } })
    ),
    ...orderedModuleIds.map((id, index) =>
      prisma.courseModule.update({ where: { id }, data: { sortOrder: index } })
    ),
  ]);

  revalidatePath(`/admin/cursos/${courseId}`);
  revalidatePath(`/tutor/cursos/${courseId}`);
}
