import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActivityAdherence, getPresaberPostsaberSummary } from "@/lib/training-plans";
import { compararAdherencia } from "@/lib/presaber-postsaber";
import { renderAreaReportPdf, type AreaReportInput } from "@/lib/area-report-pdf";
import { TRAINING_ACTIVITY_STATUS_LABELS, etiquetaProgramacion } from "@/components/training-plans/labels";
import { slugify } from "@/lib/slug";

const DATE_FORMAT = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * Informe PDF de un área del plan: sus capacitaciones, cobertura, ciclos
 * presaber/postsaber y asistencia nominal.
 *
 * Lo puede pedir un ADMIN o el tutor de la propia área. Un tutor de OTRA
 * área no: aunque puede leer el plan completo en pantalla, el informe en PDF
 * es un documento que se archiva y se reparte, y cada área responde por el
 * suyo.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ areaId: string }> }) {
  const { areaId } = await params;
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "TUTOR")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const area = await prisma.trainingArea.findUnique({
    where: { id: areaId },
    include: {
      tutor: { select: { id: true, fullName: true } },
      activities: {
        orderBy: [{ quarters: "asc" }, { title: "asc" }],
        include: {
          course: { select: { title: true } },
          plan: { select: { title: true, targetDepartment: true } },
          sessions: { orderBy: { startsAt: "asc" }, take: 1, select: { startsAt: true, endsAt: true } },
          _count: { select: { sessions: true } },
        },
      },
    },
  });
  if (!area) return NextResponse.json({ error: "Área no encontrada." }, { status: 404 });

  if (session.user.role !== "ADMIN" && area.tutor?.id !== session.user.id) {
    return NextResponse.json({ error: "No autorizado: no eres el responsable de esta área." }, { status: 403 });
  }

  const capacitaciones = await Promise.all(
    area.activities.map(async (a) => {
      const adherencia = await getActivityAdherence({
        id: a.id,
        courseId: a.courseId,
        targetAudience: a.targetAudience,
        plan: { targetDepartment: a.plan.targetDepartment },
      });
      return {
        title: a.title,
        programa: a.programa,
        programacion: etiquetaProgramacion(a),
        status: TRAINING_ACTIVITY_STATUS_LABELS[a.status],
        course: a.course?.title ?? null,
        adherencia: adherencia.totalExpected > 0 ? adherencia.percentage : null,
      };
    })
  );

  const ciclos: AreaReportInput["ciclos"] = [];
  for (const a of area.activities) {
    if (!a.courseId) continue;
    const resumen = await getPresaberPostsaberSummary(a.id);
    if (resumen.presaberCantidad === 0 && resumen.postsaberCantidad === 0) continue;
    const comparacion =
      resumen.presaberPromedio !== null && resumen.postsaberPromedio !== null
        ? compararAdherencia(resumen.presaberPromedio, resumen.postsaberPromedio)
        : null;
    ciclos.push({
      activityTitle: a.title,
      ...resumen,
      diferencia: comparacion?.diferencia ?? null,
      variacion: comparacion?.variacion ?? null,
    });
  }

  const asistencias = await prisma.trainingAttendance.findMany({
    where: { activityId: { in: area.activities.map((a) => a.id) }, attended: true },
    orderBy: { registeredAt: "asc" },
    select: {
      registeredAt: true,
      source: true,
      activity: { select: { title: true } },
      user: { select: { fullName: true, documentNumber: true } },
    },
  });

  const input: AreaReportInput = {
    areaName: area.name,
    tutorName: area.tutor?.fullName ?? null,
    planTitle: area.activities[0]?.plan.title ?? "Plan de capacitaciones",
    generatedBy: session.user.name ?? "—",
    cobertura: {
      total: area.activities.length,
      conContenido: area.activities.filter((a) => a.courseId).length,
    },
    capacitaciones,
    ciclos,
    asistencia: asistencias.map((r) => ({
      activityTitle: r.activity.title,
      fullName: r.user.fullName,
      documentNumber: r.user.documentNumber,
      dateLabel: DATE_FORMAT.format(r.registeredAt),
      source: r.source === "AUTOMATIC" ? "Automático" : "Manual",
    })),
  };

  const pdf = await renderAreaReportPdf(input);

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="informe-${slugify(area.name)}.pdf"`,
    },
  });
}
