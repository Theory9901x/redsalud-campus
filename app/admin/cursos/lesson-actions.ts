"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCourseAccess } from "@/lib/auth-helpers";
import { lessonSchema } from "@/lib/validations/course";
import { saveLessonFile } from "@/lib/storage";

export type LessonFormState = {
  error: string | null;
  success?: boolean;
};

async function lessonCourseInfo(lessonId: string) {
  const lesson = await prisma.lesson.findUniqueOrThrow({
    where: { id: lessonId },
    select: { moduleId: true, module: { select: { courseId: true } } },
  });
  return lesson.module.courseId;
}

async function moduleCourseId(moduleId: string) {
  const module_ = await prisma.courseModule.findUniqueOrThrow({
    where: { id: moduleId },
    select: { courseId: true },
  });
  return module_.courseId;
}

const MAX_LESSON_FILE_SIZE = 20 * 1024 * 1024;
// El video no se sube por streaming (se carga completo en memoria antes de
// guardarlo, ver lib/storage.ts), así que este tope es una limitación
// práctica del pipeline actual, no una decisión de producto.
const MAX_LESSON_VIDEO_SIZE = 200 * 1024 * 1024;

async function attachLessonFile(
  formData: FormData,
  contentType: string,
  lessonId: string,
  uploadedBy: string
): Promise<{ error: string | null }> {
  const file = formData.get("file");
  const acceptsFile = contentType === "PDF" || contentType === "IMAGE" || contentType === "VIDEO";
  if (!acceptsFile || !(file instanceof File) || file.size === 0) {
    return { error: null };
  }

  if (contentType === "PDF" && file.type !== "application/pdf") {
    return { error: "El archivo debe ser un PDF." };
  }
  if (contentType === "IMAGE" && !file.type.startsWith("image/")) {
    return { error: "El archivo debe ser una imagen." };
  }
  if (contentType === "VIDEO" && !file.type.startsWith("video/")) {
    return { error: "El archivo debe ser un video." };
  }
  if (contentType !== "VIDEO" && file.size > MAX_LESSON_FILE_SIZE) {
    return { error: "El archivo no puede pesar más de 20 MB." };
  }
  if (contentType === "VIDEO" && file.size > MAX_LESSON_VIDEO_SIZE) {
    return { error: "El video no puede pesar más de 200 MB." };
  }

  try {
    const media = await saveLessonFile(file, lessonId, uploadedBy);
    await prisma.lesson.update({ where: { id: lessonId }, data: { fileUrl: media.fileUrl } });
    return { error: null };
  } catch (error) {
    console.error("Error subiendo archivo de la lección:", error);
    return { error: "No se pudo guardar el archivo. Intenta de nuevo." };
  }
}

function parseLessonForm(formData: FormData) {
  return lessonSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    contentType: formData.get("contentType"),
    contentBody: formData.get("contentBody") ?? "",
    videoUrl: formData.get("videoUrl") ?? "",
    externalUrl: formData.get("externalUrl") ?? "",
    isRequired: formData.get("isRequired") === "on" || formData.get("isRequired") === "true",
    estimatedMinutes: formData.get("estimatedMinutes") || undefined,
  });
}

export async function createLessonAction(
  moduleId: string,
  _prevState: LessonFormState,
  formData: FormData
): Promise<LessonFormState> {
  const courseId = await moduleCourseId(moduleId);
  const session = await requireCourseAccess(courseId);

  const parsed = parseLessonForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const data = parsed.data;
  const count = await prisma.lesson.count({ where: { moduleId } });

  const lesson = await prisma.lesson.create({
    data: {
      moduleId,
      title: data.title,
      description: data.description || null,
      contentType: data.contentType,
      contentBody: data.contentBody || null,
      videoUrl: data.videoUrl || null,
      externalUrl: data.externalUrl || null,
      isRequired: data.isRequired,
      estimatedMinutes: data.estimatedMinutes ?? null,
      sortOrder: count,
    },
  });

  const fileResult = await attachLessonFile(formData, data.contentType, lesson.id, session.user.id);
  if (fileResult.error) {
    return { error: fileResult.error };
  }

  revalidatePath(`/admin/cursos/${courseId}`);
  revalidatePath(`/tutor/cursos/${courseId}`);
  return { error: null, success: true };
}

export async function updateLessonAction(
  lessonId: string,
  _prevState: LessonFormState,
  formData: FormData
): Promise<LessonFormState> {
  const courseId = await lessonCourseInfo(lessonId);
  const session = await requireCourseAccess(courseId);

  const parsed = parseLessonForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const data = parsed.data;

  await prisma.lesson.update({
    where: { id: lessonId },
    data: {
      title: data.title,
      description: data.description || null,
      contentType: data.contentType,
      contentBody: data.contentBody || null,
      videoUrl: data.videoUrl || null,
      externalUrl: data.externalUrl || null,
      isRequired: data.isRequired,
      estimatedMinutes: data.estimatedMinutes ?? null,
    },
  });

  const fileResult = await attachLessonFile(formData, data.contentType, lessonId, session.user.id);
  if (fileResult.error) {
    return { error: fileResult.error };
  }

  revalidatePath(`/admin/cursos/${courseId}`);
  revalidatePath(`/tutor/cursos/${courseId}`);
  return { error: null, success: true };
}

export async function deleteLessonAction(lessonId: string) {
  const courseId = await lessonCourseInfo(lessonId);
  await requireCourseAccess(courseId);

  await prisma.lesson.delete({ where: { id: lessonId } });

  revalidatePath(`/admin/cursos/${courseId}`);
  revalidatePath(`/tutor/cursos/${courseId}`);
}

export async function reorderLessonsAction(moduleId: string, orderedLessonIds: string[]) {
  const courseId = await moduleCourseId(moduleId);
  await requireCourseAccess(courseId);

  // Un tutor autorizado en su propio curso no debe poder colar el id de una
  // lección ajena para alterar su orden: se exige que todas pertenezcan a este módulo.
  const validCount = await prisma.lesson.count({ where: { id: { in: orderedLessonIds }, moduleId } });
  if (validCount !== orderedLessonIds.length) {
    throw new Error("Una o más lecciones no pertenecen a este módulo.");
  }

  // Dos fases: primero valores negativos temporales para no chocar con la
  // restricción única (moduleId, sortOrder) mientras se reordena.
  await prisma.$transaction([
    ...orderedLessonIds.map((id, index) =>
      prisma.lesson.update({ where: { id }, data: { sortOrder: -(index + 1) } })
    ),
    ...orderedLessonIds.map((id, index) =>
      prisma.lesson.update({ where: { id }, data: { sortOrder: index } })
    ),
  ]);

  revalidatePath(`/admin/cursos/${courseId}`);
  revalidatePath(`/tutor/cursos/${courseId}`);
}
