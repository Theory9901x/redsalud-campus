import { randomUUID } from "node:crypto";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";

const PRIVATE_UPLOADS_ROOT = path.join(process.cwd(), "uploads");
const PUBLIC_UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");

function sanitizeFileName(originalName: string) {
  const ext = path.extname(originalName).toLowerCase();
  const base = path
    .basename(originalName, ext)
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .slice(0, 60);
  return `${Date.now()}-${base}${ext}`;
}

/** Ancho máximo de una portada: el hero del detalle se ve a ~1150px CSS, así
 *  que 1920 cubre pantallas de alta densidad sin desperdicio. */
const COVER_MAX_WIDTH = 1920;

/**
 * Guarda la imagen destacada de un curso en /public (archivo público, sin
 * control de acceso), recomprimida a WebP y acotada en ancho.
 *
 * Por qué: las portadas llegan como PNG de captura (se midieron de 1.7 MB) y
 * se descargan enteras en CADA tarjeta de la grilla del catálogo, donde se
 * ven a ~300px. Como las imágenes se sirven sin el optimizador de Next (ver
 * next.config.ts), el redimensionado tiene que pasar aquí, al subir.
 */
export async function saveCourseImage(file: File, courseId: string): Promise<string> {
  const dir = path.join(PUBLIC_UPLOADS_ROOT, "covers", courseId);
  await mkdir(dir, { recursive: true });

  const inputBuffer = Buffer.from(await file.arrayBuffer());
  const baseName = sanitizeFileName(file.name).replace(/\.[^.]+$/, "");
  const fileName = `${baseName}.webp`;

  const optimized = await sharp(inputBuffer)
    .rotate() // respeta la orientación EXIF antes de redimensionar
    .resize({ width: COVER_MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  await writeFile(path.join(dir, fileName), optimized);

  return `/uploads/covers/${courseId}/${fileName}`;
}

/**
 * Imagen de apoyo de una pregunta de evaluación (pública, recomprimida a WebP):
 * diagramas del enunciado, como las posturas a evaluar. No es material sensible
 * —es parte del enunciado que el estudiante debe ver— así que va a /public.
 */
export async function saveQuestionImage(file: File, quizId: string): Promise<string> {
  const dir = path.join(PUBLIC_UPLOADS_ROOT, "quiz", quizId);
  await mkdir(dir, { recursive: true });

  const inputBuffer = Buffer.from(await file.arrayBuffer());
  const baseName = sanitizeFileName(file.name).replace(/\.[^.]+$/, "");
  const fileName = `${baseName}.webp`;

  const optimized = await sharp(inputBuffer)
    .rotate()
    .resize({ width: 1200, withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();

  await writeFile(path.join(dir, fileName), optimized);
  return `/uploads/quiz/${quizId}/${fileName}`;
}

/** Logo o firma institucional (público): se usan tanto en la web como impresos en el PDF del certificado. */
export async function saveInstitutionAsset(file: File, kind: "logo" | "firma"): Promise<string> {
  const fileName = sanitizeFileName(file.name);
  const dir = path.join(PUBLIC_UPLOADS_ROOT, "institucion", kind);
  await mkdir(dir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, fileName), buffer);

  return `/uploads/institucion/${kind}/${fileName}`;
}

/** Imagen de fondo o recurso decorativo del constructor visual de certificados (público). */
export async function saveCertificateTemplateAsset(file: File, kind: "fondo" | "imagen"): Promise<string> {
  const fileName = sanitizeFileName(file.name);
  const dir = path.join(PUBLIC_UPLOADS_ROOT, "plantillas", kind);
  await mkdir(dir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, fileName), buffer);

  return `/uploads/plantillas/${kind}/${fileName}`;
}

/** Convierte una URL pública devuelta por saveCourseImage/saveInstitutionAsset a su ruta absoluta en disco. */
export function publicUploadDiskPath(publicUrl: string): string {
  const relative = publicUrl.replace(/^\/uploads\//, "");
  return path.join(PUBLIC_UPLOADS_ROOT, relative);
}

/** Guarda el PDF generado de un certificado (privado, servido solo por /api/certificados/[id]). */
export async function saveCertificatePdf(buffer: Buffer, certificateId: string): Promise<{ folder: string; fileName: string }> {
  const folder = "certificates";
  const fileName = `${certificateId}.pdf`;
  const dir = path.join(PRIVATE_UPLOADS_ROOT, folder);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, fileName), buffer);
  return { folder, fileName };
}

/**
 * Guarda un archivo privado fuera de /public, registrado como Media.
 * Solo se puede leer a través de la ruta autenticada /api/media/[id].
 * `extra` permite asociar el registro a su dueño real (plan/actividad de
 * capacitación, etc.) sin crear un modelo de documento distinto por caso.
 */
async function savePrivateFile(
  file: File,
  folder: string,
  uploadedBy: string,
  extra?: { trainingPlanId?: string; trainingActivityId?: string }
) {
  const id = randomUUID();
  const fileName = sanitizeFileName(file.name);
  const dir = path.join(PRIVATE_UPLOADS_ROOT, folder);
  await mkdir(dir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, fileName), buffer);

  return prisma.media.create({
    data: {
      id,
      fileName,
      fileType: file.type || "application/octet-stream",
      fileSize: buffer.byteLength,
      folder,
      fileUrl: `/api/media/${id}`,
      uploadedBy,
      ...extra,
    },
  });
}

/** Adjunto de una lección (PDF, imagen). */
export async function saveLessonFile(file: File, lessonId: string, uploadedBy: string) {
  return savePrivateFile(file, `lessons/${lessonId}`, uploadedBy);
}

/**
 * Foto de perfil del usuario. No se agrega columna a User: se guarda como
 * Media en la carpeta "avatars/{userId}" y se busca la más reciente.
 */
export async function saveAvatarImage(file: File, userId: string) {
  return savePrivateFile(file, `avatars/${userId}`, userId);
}

/** Documento adjunto a un plan de capacitación (Etapa 2). */
export async function saveTrainingPlanDocument(file: File, planId: string, uploadedBy: string) {
  return savePrivateFile(file, `training-plans/${planId}`, uploadedBy, { trainingPlanId: planId });
}

/** Documento adjunto a una actividad puntual del plan (Etapa 2). */
export async function saveTrainingActivityDocument(file: File, activityId: string, uploadedBy: string) {
  return savePrivateFile(file, `training-activities/${activityId}`, uploadedBy, { trainingActivityId: activityId });
}

export function privateMediaDiskPath(folder: string, fileName: string) {
  return path.join(PRIVATE_UPLOADS_ROOT, folder, fileName);
}
