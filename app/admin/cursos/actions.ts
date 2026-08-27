"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { htmlSeguro } from "@/lib/html-seguro";
import { requireCourseAccess, requireTutorOrAdmin, requireAdmin } from "@/lib/auth-helpers";
import { courseSchema } from "@/lib/validations/course";
import { saveCourseImage } from "@/lib/storage";

export type CourseFormState = {
  error: string | null;
};

function isUniqueConstraintError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function parseCourseForm(formData: FormData) {
  return courseSchema.safeParse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    shortDescription: formData.get("shortDescription"),
    fullDescription: formData.get("fullDescription") ?? "",
    instructions: formData.get("instructions") ?? "",
    categoryId: formData.get("categoryId") ?? "",
    courseType: formData.get("courseType"),
    durationHours: formData.get("durationHours"),
    passingScore: formData.get("passingScore"),
    enrollmentMode: formData.get("enrollmentMode"),
    targetAudience: formData.get("targetAudience"),
    isSequential: formData.get("isSequential") === "on" || formData.get("isSequential") === "true",
    tutorId: formData.get("tutorId") ?? "",
  });
}

export async function createCourseAction(
  basePath: string,
  _prevState: CourseFormState,
  formData: FormData
): Promise<CourseFormState> {
  const session = await requireTutorOrAdmin();

  // Crear cursos es del administrador, no de las áreas: el catálogo
  // institucional lo cura una sola mano. Las áreas gestionan el CONTENIDO de
  // los cursos que se les asignan (módulos, lecciones, evaluaciones), pero no
  // deciden qué cursos existen.
  if (session.user.role !== "ADMIN") {
    return { error: "Solo un administrador puede crear cursos. Pide al administrador que cree el curso y te lo asigne como tutor." };
  }

  const parsed = parseCourseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const data = parsed.data;
  if (!data.tutorId) {
    return { error: "Selecciona un tutor." };
  }
  const tutorId = data.tutorId!;

  let courseId: string;
  try {
    const course = await prisma.course.create({
      data: {
        title: data.title,
        slug: data.slug,
        shortDescription: data.shortDescription,
        fullDescription: data.fullDescription || null,
        instructions: htmlSeguro(data.instructions) || null,
        categoryId: data.categoryId || null,
        courseType: data.courseType,
        durationHours: data.durationHours,
        passingScore: data.passingScore,
        enrollmentMode: data.enrollmentMode,
        targetAudience: data.targetAudience,
        isSequential: data.isSequential,
        tutorId,
      },
    });
    courseId = course.id;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { error: "Ya existe un curso con ese slug. Cambia el título o el slug." };
    }
    throw error;
  }

  revalidatePath(basePath);
  redirect(`${basePath}/${courseId}`);
}

export async function updateCourseAction(
  courseId: string,
  basePath: string,
  _prevState: CourseFormState,
  formData: FormData
): Promise<CourseFormState> {
  const session = await requireCourseAccess(courseId);

  const parsed = parseCourseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const data = parsed.data;
  if (session.user.role === "ADMIN" && !data.tutorId) {
    return { error: "Selecciona un tutor." };
  }
  const tutorUpdate = session.user.role === "ADMIN" ? { tutorId: data.tutorId! } : {};

  try {
    await prisma.course.update({
      where: { id: courseId },
      data: {
        title: data.title,
        slug: data.slug,
        shortDescription: data.shortDescription,
        fullDescription: data.fullDescription || null,
        instructions: htmlSeguro(data.instructions) || null,
        categoryId: data.categoryId || null,
        courseType: data.courseType,
        durationHours: data.durationHours,
        passingScore: data.passingScore,
        enrollmentMode: data.enrollmentMode,
        targetAudience: data.targetAudience,
        isSequential: data.isSequential,
        ...tutorUpdate,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { error: "Ya existe un curso con ese slug." };
    }
    throw error;
  }

  revalidatePath(basePath);
  revalidatePath(`${basePath}/${courseId}`);
  return { error: null };
}

export type ImageUploadState = { error: string | null };

const MAX_IMAGE_SIZE = 15 * 1024 * 1024;

export async function uploadCourseImageAction(
  courseId: string,
  basePath: string,
  _prevState: ImageUploadState,
  formData: FormData
): Promise<ImageUploadState> {
  await requireCourseAccess(courseId);

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecciona una imagen primero." };
  }
  if (!file.type.startsWith("image/")) {
    return { error: "El archivo debe ser una imagen." };
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return { error: "La imagen no puede pesar más de 15 MB." };
  }

  try {
    const imageUrl = await saveCourseImage(file, courseId);
    await prisma.course.update({ where: { id: courseId }, data: { imageUrl } });
  } catch (error) {
    console.error("Error subiendo imagen del curso:", error);
    return { error: "No se pudo guardar la imagen. Intenta de nuevo." };
  }

  revalidatePath(basePath);
  revalidatePath(`${basePath}/${courseId}`);
  return { error: null };
}

export async function publishCourseAction(courseId: string) {
  await requireAdmin();
  await prisma.course.update({
    where: { id: courseId },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });
  revalidatePath("/admin/cursos");
  revalidatePath(`/admin/cursos/${courseId}`);
  revalidatePath("/cursos");
}

export async function archiveCourseAction(courseId: string) {
  await requireAdmin();
  await prisma.course.update({ where: { id: courseId }, data: { status: "ARCHIVED" } });
  revalidatePath("/admin/cursos");
  revalidatePath(`/admin/cursos/${courseId}`);
  revalidatePath("/cursos");
}

export async function revertToDraftAction(courseId: string) {
  await requireAdmin();
  await prisma.course.update({ where: { id: courseId }, data: { status: "DRAFT" } });
  revalidatePath("/admin/cursos");
  revalidatePath(`/admin/cursos/${courseId}`);
  revalidatePath("/cursos");
}

export type DeleteCourseState = { error: string | null };

/**
 * Elimina un curso DEFINITIVAMENTE, con su contenido, inscripciones y avance.
 *
 * Guarda: si el curso ya emitió certificados, borrarlo los perdería (y la
 * referencia lo impediría de todos modos). En ese caso se bloquea y se sugiere
 * ARCHIVAR —que lo saca del catálogo conservando todo—. Un curso sin
 * certificados sí se puede borrar; sus módulos, lecciones, evaluaciones,
 * inscripciones y progreso cuelgan en cascada.
 */
export async function deleteCourseAction(courseId: string): Promise<DeleteCourseState> {
  await requireAdmin();

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { title: true, _count: { select: { certificates: true } } },
  });
  if (!course) return { error: "El curso ya no existe." };

  if (course._count.certificates > 0) {
    return {
      error: `No se puede eliminar "${course.title}" porque ya emitió ${course._count.certificates} certificado(s), que se perderían. Usa "Archivar" para sacarlo del catálogo conservando todo.`,
    };
  }

  try {
    await prisma.course.delete({ where: { id: courseId } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return {
        error: `No se puede eliminar "${course.title}" porque tiene registros asociados (p. ej. planes de capacitación). Usa "Archivar" en su lugar.`,
      };
    }
    throw error;
  }

  revalidatePath("/admin/cursos");
  revalidatePath("/cursos");
  return { error: null };
}
