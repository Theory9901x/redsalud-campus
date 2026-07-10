"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
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

  const parsed = parseCourseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const data = parsed.data;
  if (session.user.role === "ADMIN" && !data.tutorId) {
    return { error: "Selecciona un tutor." };
  }
  const tutorId = session.user.role === "ADMIN" ? data.tutorId! : session.user.id;

  let courseId: string;
  try {
    const course = await prisma.course.create({
      data: {
        title: data.title,
        slug: data.slug,
        shortDescription: data.shortDescription,
        fullDescription: data.fullDescription || null,
        instructions: data.instructions || null,
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
        instructions: data.instructions || null,
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
