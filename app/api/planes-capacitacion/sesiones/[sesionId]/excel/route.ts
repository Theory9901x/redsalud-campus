import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTrainingActivityAccess } from "@/lib/auth-helpers";
import { getAsistentesSesion } from "@/lib/sesiones-presenciales";
import { hojaInformacion, hojaTabla, horaColombia, nuevoLibro, respuestaExcel, slugArchivo } from "@/lib/excel-tabla";

const MEDIO: Record<string, string> = { QR: "QR", MANUAL: "Manual", SALA: "Sala en vivo" };

/**
 * Excel del corte POR JORNADA: asistentes con hora y medio, y el resultado
 * presaber/postsaber de cada uno en la capacitación (mismos datos que el
 * CSV viejo de ../csv, que sigue respondiendo sin enlace). En una jornada
 * virtual se añade la hoja de conexiones a la sala de esa jornada.
 * Mismo permiso adscrito que la pantalla de la jornada.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ sesionId: string }> }) {
  const { sesionId } = await params;

  const sesion = await prisma.trainingSession.findUnique({
    where: { id: sesionId },
    select: {
      id: true,
      activityId: true,
      startsAt: true,
      endsAt: true,
      modality: true,
      activity: { select: { title: true, courseId: true, area: { select: { name: true } }, plan: { select: { title: true, year: true } } } },
    },
  });
  if (!sesion) return NextResponse.json({ error: "Jornada no encontrada." }, { status: 404 });

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

  const wb = nuevoLibro();
  const pie = "RedSalud Te Forma · Corte de la jornada";

  hojaTabla(
    wb,
    "Asistentes",
    [
      { titulo: "#", ancho: 6 },
      { titulo: "Nombre", ancho: 38 },
      { titulo: "Documento", ancho: 16 },
      { titulo: "Hora de registro", ancho: 20, formato: "dd/mm/yyyy hh:mm" },
      { titulo: "Medio", ancho: 14 },
      { titulo: "Presaber (%)", ancho: 13 },
      { titulo: "Postsaber (%)", ancho: 13 },
    ],
    asistentes.map((a, i) => {
      const n = notas.get(a.user.documentNumber);
      return [i + 1, a.user.fullName, a.user.documentNumber, horaColombia(a.registradaEn), MEDIO[a.medio] ?? a.medio, n?.pre ?? null, n?.post ?? null];
    }),
    pie
  );

  if (sesion.modality !== "PRESENCIAL") {
    // Lo que entró por la sala de ESTA jornada; los tramos previos a los
    // accesos por jornada (sin jornada) se ubican por la franja horaria,
    // igual que en la pantalla de la jornada.
    const desde = new Date(sesion.startsAt.getTime() - 3 * 3600e3);
    const hasta = sesion.endsAt ? new Date(sesion.endsAt.getTime() + 3 * 3600e3) : new Date(sesion.startsAt.getTime() + 14 * 3600e3);
    const tramos = await prisma.callConnectionLog.findMany({
      where: { activityId: sesion.activityId, OR: [{ sessionId: sesion.id }, { sessionId: null, joinedAt: { gte: desde, lte: hasta } }] },
      orderBy: { joinedAt: "asc" },
      select: {
        displayName: true,
        joinedAt: true,
        leftAt: true,
        durationSeconds: true,
        user: { select: { fullName: true, documentNumber: true } },
        externalParticipant: { select: { fullName: true, company: true } },
      },
    });
    hojaTabla(
      wb,
      "Conexiones a la sala",
      [
        { titulo: "Participante", ancho: 38 },
        { titulo: "Documento", ancho: 16 },
        { titulo: "Invitado de", ancho: 24 },
        { titulo: "Ingreso", ancho: 20, formato: "dd/mm/yyyy hh:mm" },
        { titulo: "Salida", ancho: 20, formato: "dd/mm/yyyy hh:mm" },
        { titulo: "Minutos conectado", ancho: 16 },
      ],
      tramos.map((t) => [
        t.user?.fullName ?? t.externalParticipant?.fullName ?? t.displayName,
        t.user?.documentNumber ?? null,
        t.externalParticipant?.company ?? null,
        horaColombia(t.joinedAt),
        horaColombia(t.leftAt),
        Math.round(t.durationSeconds / 60),
      ]),
      pie
    );
  }

  const fechaJornada = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeStyle: "short", timeZone: "America/Bogota" }).format(sesion.startsAt);
  hojaInformacion(wb, [
    ["Capacitación", sesion.activity.title],
    ["Jornada", fechaJornada],
    ["Área", sesion.activity.area?.name ?? "Sin área"],
    ["Plan", `${sesion.activity.plan.title} (${sesion.activity.plan.year})`],
  ]);

  return respuestaExcel(wb, `jornada-${sesion.startsAt.toISOString().slice(0, 10)}-${slugArchivo(sesion.activity.title)}.xlsx`);
}
