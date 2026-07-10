import { readFile } from "node:fs/promises";
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

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  if (!isAdmin && !isOwner && !isEnrolled && !isPlanTutor) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
    const buffer = await readFile(privateMediaDiskPath(media.folder ?? "", media.fileName));
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": media.fileType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(media.fileName)}"`,
        "Cache-Control": "private, max-age=0, no-cache",
      },
    });
  } catch {
    return NextResponse.json({ error: "Archivo no encontrado en disco." }, { status: 404 });
  }
}
