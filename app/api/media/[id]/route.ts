import { readFile, stat } from "node:fs/promises";
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

  const isOwner = media.uploadedBy === session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  const isEnrolled = !isAdmin && !isOwner && (await isEnrolledInLessonCourse(media.folder ?? "", session.user.id));
  const isPlanTutor = !isAdmin && !isOwner && !isEnrolled && (await isTrainingPlanTutor(media.folder ?? "", session.user.id));
  const isTargetedStudent =
    !isAdmin && !isOwner && !isEnrolled && !isPlanTutor && (await isTargetedStudentForTraining(media.folder ?? "", session.user.id));

  if (!isAdmin && !isOwner && !isEnrolled && !isPlanTutor && !isTargetedStudent) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const filePath = privateMediaDiskPath(media.folder ?? "", media.fileName);

  let fileSize: number;
  try {
    fileSize = (await stat(filePath)).size;
  } catch {
    return NextResponse.json({ error: "Archivo no encontrado en disco." }, { status: 404 });
  }

  // Soporte de rango de bytes para que <video> pueda buscar/adelantar sin
  // descargar el archivo completo primero (necesario para VIDEO, inocuo para el resto).
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

    try {
      const buffer = await readFile(filePath);
      const chunk = buffer.subarray(start, end + 1);
      return new NextResponse(new Uint8Array(chunk), {
        status: 206,
        headers: {
          "Content-Type": media.fileType,
          "Content-Disposition": `inline; filename="${encodeURIComponent(media.fileName)}"`,
          "Cache-Control": "private, max-age=0, no-cache",
          "Accept-Ranges": "bytes",
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Content-Length": String(chunk.byteLength),
        },
      });
    } catch {
      return NextResponse.json({ error: "Archivo no encontrado en disco." }, { status: 404 });
    }
  }

  try {
    const buffer = await readFile(filePath);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": media.fileType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(media.fileName)}"`,
        "Cache-Control": "private, max-age=0, no-cache",
        "Accept-Ranges": "bytes",
      },
    });
  } catch {
    return NextResponse.json({ error: "Archivo no encontrado en disco." }, { status: 404 });
  }
}
