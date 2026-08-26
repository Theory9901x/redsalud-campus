import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTrainingActivityAccess } from "@/lib/auth-helpers";
import { getAsistentesSesion } from "@/lib/sesiones-presenciales";

/**
 * FASE 10 — Export del corte POR SESIÓN: asistentes con hora y medio, y el
 * resultado presaber/postsaber de cada uno en la actividad de la sesión.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ sesionId: string }> }) {
  const { sesionId } = await params;

  const sesion = await prisma.trainingSession.findUnique({
    where: { id: sesionId },
    select: { activityId: true, startsAt: true, activity: { select: { title: true, courseId: true } } },
  });
  if (!sesion) return NextResponse.json({ error: "Sesión no encontrada." }, { status: 404 });

  try {
    await requireTrainingActivityAccess(sesion.activityId);
  } catch {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const asistentes = await getAsistentesSesion(sesionId);

  // Resultados del ciclo de quienes asistieron, en un solo lote.
  const notas = new Map<string, { pre: number | null; post: number | null }>();
  if (sesion.activity.courseId && asistentes.length > 0) {
    const intentos = await prisma.quizAttempt.findMany({
      where: {
        user: { documentNumber: { in: asistentes.map((a) => a.user.documentNumber) } },
        score: { not: null },
        moment: { not: null },
        quiz: { courseId: sesion.activity.courseId, moduleId: null },
      },
      select: { moment: true, score: true, user: { select: { documentNumber: true } } },
    });
    for (const i of intentos) {
      const doc = i.user.documentNumber;
      const previo = notas.get(doc) ?? { pre: null, post: null };
      if (i.moment === "PRESABER") previo.pre = Math.max(previo.pre ?? 0, i.score!);
      if (i.moment === "POSTSABER") previo.post = Math.max(previo.post ?? 0, i.score!);
      notas.set(doc, previo);
    }
  }

  const celda = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const filas = [
    ["Nombre", "Documento", "Hora de registro", "Medio", "Presaber %", "Postsaber %"],
    ...asistentes.map((a) => {
      const n = notas.get(a.user.documentNumber);
      return [
        a.user.fullName,
        a.user.documentNumber,
        a.registradaEn.toISOString(),
        a.medio,
        n?.pre != null ? String(n.pre) : "",
        n?.post != null ? String(n.post) : "",
      ];
    }),
  ];
  const csv = "﻿" + filas.map((f) => f.map(celda).join(";")).join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sesion-${sesion.startsAt.toISOString().slice(0, 10)}.csv"`,
    },
  });
}
