import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { privateMediaDiskPath } from "@/lib/storage";

/** Si el archivo es un adjunto de lección ("lessons/{lessonId}"), ¿el usuario está inscrito en ese curso? */
async function isEnrolledInLessonCourse(folder: string, userId: string) {
  const match = folder.match(/^lessons\/([^/]+)$/);
  if (!match) return false;

  const lesson = await prisma.lesson.findUnique({
    where: { id: match[1] },
    select: { module: { select: { courseId: true } } },
  });
  if (!lesson) return false;

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId: lesson.module.courseId } },
  });
  return !!enrollment;
}

/** Documento de un plan o actividad de capacitación: autorizado el tutor responsable del plan (admin ya cubierto aparte). */
async function isTrainingPlanTutor(folder: string, userId: string) {
  const planMatch = folder.match(/^training-plans\/([^/]+)$/);
  const activityMatch = folder.match(/^training-activities\/([^/]+)$/);

  const planId = planMatch
    ? planMatch[1]
    : activityMatch
      ? (await prisma.trainingActivity.findUnique({ where: { id: activityMatch[1] }, select: { planId: true } }))?.planId
      : null;
  if (!planId) return false;

  const plan = await prisma.trainingPlan.findUnique({ where: { id: planId }, select: { tutorId: true } });
  return plan?.tutorId === userId;
}

/** Documento de un plan/actividad: autorizado el estudiante al que va dirigido (misma dependencia o comodín "todo el personal"). */
async function isTargetedStudentForTraining(folder: string, userId: string) {
  const planMatch = folder.match(/^training-plans\/([^/]+)$/);
  const activityMatch = folder.match(/^training-activities\/([^/]+)$/);

  const planId = planMatch
    ? planMatch[1]
    : activityMatch
      ? (await prisma.trainingActivity.findUnique({ where: { id: activityMatch[1] }, select: { planId: true } }))?.planId
      : null;
  if (!planId) return false;

  const plan = await prisma.trainingPlan.findUnique({ where: { id: planId }, select: { targetDepartment: true } });
  if (!plan) return false;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, status: true, department: true } });
  if (!user || user.role !== "STUDENT" || user.status !== "ACTIVE") return false;
  if (!plan.targetDepartment) return true;
  return !!user.department && user.department.trim().toLowerCase() === plan.targetDepartment.trim().toLowerCase();
}

/**
 * Memoria corta de autorizaciones (usuario, medio) -> permitido.
 *
 * Un <video> reproduce a punta de peticiones Range: decenas por sesión de
 * reproducción, y cada una repetía la cadena completa de consultas
 * (media -> lesson -> enrollment) antes de servir el primer byte. Ese viaje a
 * la base en cada chunk es lo que se sentía como lag al adelantar el video.
 * La inscripción a un curso no cambia en mitad de una reproducción; 60
 * segundos de memoria por proceso bastan. Solo se memorizan los PERMITIDOS:
 * un rechazo debe poder corregirse (p. ej. recién inscrito) sin esperar TTL.
 */
const AUTH_TTL_MS = 60_000;
const authCache = new Map<string, number>();

function autorizado(key: string): boolean {
  const exp = authCache.get(key);
  if (exp === undefined) return false;
  if (Date.now() > exp) {
    authCache.delete(key);
    return false;
  }
  return true;
}

function memorizar(key: string) {
  // Tope de tamaño: descarta lo más viejo (orden de inserción del Map).
  if (authCache.size >= 2000) {
    const primera = authCache.keys().next().value;
    if (primera !== undefined) authCache.delete(primera);
  }
  authCache.set(key, Date.now() + AUTH_TTL_MS);
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const media = await prisma.media.findUnique({ where: { id } });
  if (!media) {
    return NextResponse.json({ error: "Archivo no encontrado." }, { status: 404 });
  }

  const cacheKey = `${session.user.id}:${media.id}`;
  if (!autorizado(cacheKey)) {
    const isOwner = media.uploadedBy === session.user.id;
    const isAdmin = session.user.role === "ADMIN";
    const isEnrolled = !isAdmin && !isOwner && (await isEnrolledInLessonCourse(media.folder ?? "", session.user.id));
    const isPlanTutor = !isAdmin && !isOwner && !isEnrolled && (await isTrainingPlanTutor(media.folder ?? "", session.user.id));
    const isTargetedStudent =
      !isAdmin && !isOwner && !isEnrolled && !isPlanTutor && (await isTargetedStudentForTraining(media.folder ?? "", session.user.id));

    if (!isAdmin && !isOwner && !isEnrolled && !isPlanTutor && !isTargetedStudent) {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }
    memorizar(cacheKey);
  }

  const filePath = privateMediaDiskPath(media.folder ?? "", media.fileName);

  let fileSize: number;
  try {
    fileSize = (await stat(filePath)).size;
  } catch {
    return NextResponse.json({ error: "Archivo no encontrado en disco." }, { status: 404 });
  }

  // Soporte de rango de bytes para que <video> pueda buscar/adelantar sin
  // descargar el archivo completo primero. Se sirve por STREAMING
  // (createReadStream), nunca cargando el archivo entero en memoria: un video
  // de cientos de MB con varios estudiantes reproduciendo a la vez agotaría
  // la RAM del servidor con readFile().
  const range = request.headers.get("range");
  if (range) {
    const match = range.match(/^bytes=(\d*)-(\d*)$/);
    const start = match?.[1] ? Number(match[1]) : 0;
    const end = match?.[2] ? Number(match[2]) : fileSize - 1;

    if (!match || start > end || start >= fileSize || end >= fileSize) {
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${fileSize}` },
      });
    }

    const stream = Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream;
    return new NextResponse(stream, {
      status: 206,
      headers: {
        "Content-Type": media.fileType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(media.fileName)}"`,
        // Los medios son inmutables: reemplazar un archivo crea SIEMPRE un id
        // nuevo, así que esta URL nunca cambia de contenido. Cachear evita
        // re-descargar PDFs de varios MB en cada visita a la lección.
        "Cache-Control": "private, max-age=31536000, immutable",
        "Accept-Ranges": "bytes",
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Content-Length": String(end - start + 1),
      },
    });
  }

  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
  return new NextResponse(stream, {
    headers: {
      "Content-Type": media.fileType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(media.fileName)}"`,
      // Los medios son inmutables: reemplazar un archivo crea SIEMPRE un id
      // nuevo, así que esta URL nunca cambia de contenido. Cachear evita
      // re-descargar PDFs de varios MB en cada visita a la lección.
      "Cache-Control": "private, max-age=31536000, immutable",
      "Accept-Ranges": "bytes",
      "Content-Length": String(fileSize),
    },
  });
}
