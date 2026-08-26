import { prisma } from "@/lib/prisma";
import { compararAdherencia } from "@/lib/presaber-postsaber";
import type { FaseSesion } from "@prisma/client";

/**
 * FASE 10 — Lógica de las sesiones presenciales.
 *
 * La sesión tiene una máquina de fases que el tutor controla EN VIVO:
 * REGISTRO → PRESABER → CAPACITACION → POSTSABER → CERRADA. El mismo QR
 * (/s/[token]) cambia de comportamiento según la fase, así que un solo
 * cartel impreso sirve toda la jornada.
 *
 * Reglas de fondo:
 *  - La fase la cambia SOLO el tutor del área o el administrador, en el
 *    servidor. Un estudiante no puede presentar postsaber en fase presaber:
 *    el momento del intento sale de la fase vigente, nunca del cliente.
 *  - La asistencia es idempotente (restricción única sesión+usuario).
 *  - Cerrar congela un snapshot de totales: el informe de una jornada que
 *    ya pasó no se recalcula con datos que alguien toque después.
 */

export { ORDEN_FASES, ETIQUETA_FASE, faseSiguiente, faseAnterior } from "@/lib/sesiones-fases";

/** La sesión por su token público, con lo que la página /s/[token] necesita. */
export async function getSesionPorToken(token: string) {
  return prisma.trainingSession.findUnique({
    where: { tokenPublico: token },
    include: {
      activity: {
        select: {
          id: true,
          title: true,
          courseId: true,
          planId: true,
          targetAudience: true,
          modality: true,
          area: { select: { name: true } },
          plan: { select: { title: true, targetDepartment: true } },
        },
      },
      municipio: { select: { nombre: true } },
      _count: { select: { asistencias: true } },
    },
  });
}

/**
 * Registra la asistencia de una persona a la sesión. Idempotente: el doble
 * escaneo cae en la restricción única y se responde igual que si fuera la
 * primera vez -a quien escanea dos veces no le interesa el detalle-.
 */
export async function registrarAsistenciaSesion(
  sesionId: string,
  userId: string,
  medio: "QR" | "MANUAL"
): Promise<{ yaEstaba: boolean }> {
  try {
    await prisma.asistenciaSesion.create({ data: { sesionId, userId, medio } });
    return { yaEstaba: false };
  } catch (error) {
    // P2002 = ya registrada. Cualquier otro error sí es un error.
    if (typeof error === "object" && error && "code" in error && (error as { code?: string }).code === "P2002") {
      return { yaEstaba: true };
    }
    throw error;
  }
}

/** Lo que la persona identificada ya hizo en esta sesión: para el resumen de fase CERRADA y los botones. */
export async function getEstadoPersonaEnSesion(
  sesion: { id: string; activity: { courseId: string | null } },
  userId: string
) {
  const [asistencia, intentos] = await Promise.all([
    prisma.asistenciaSesion.findUnique({
      where: { sesionId_userId: { sesionId: sesion.id, userId } },
      select: { registradaEn: true, medio: true },
    }),
    sesion.activity.courseId
      ? prisma.quizAttempt.findMany({
          where: {
            userId,
            finishedAt: { not: null },
            moment: { not: null },
            quiz: { courseId: sesion.activity.courseId, moduleId: null },
          },
          select: { moment: true, score: true },
          orderBy: { finishedAt: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const mejorDe = (momento: "PRESABER" | "POSTSABER") => {
    const scores = intentos.filter((i) => i.moment === momento && i.score !== null).map((i) => i.score!);
    return scores.length > 0 ? Math.max(...scores) : null;
  };

  return {
    asistencia,
    presaber: mejorDe("PRESABER"),
    postsaber: mejorDe("POSTSABER"),
  };
}

export type SnapshotSesion = {
  asistentes: number;
  presaberPresentados: number;
  postsaberPresentados: number;
  promedioPre: number | null;
  promedioPost: number | null;
  diferencia: number | null;
  variacion: number | null;
  cerradaEl: string;
};

/**
 * Cierra la sesión y congela sus totales. La adherencia usa la comparación
 * vigente del módulo (compararAdherencia), no una fórmula nueva.
 */
export async function cerrarSesionConSnapshot(sesionId: string): Promise<SnapshotSesion> {
  const sesion = await prisma.trainingSession.findUniqueOrThrow({
    where: { id: sesionId },
    select: {
      id: true,
      activity: { select: { courseId: true } },
      asistencias: { select: { userId: true } },
    },
  });

  const asistentes = sesion.asistencias.length;
  const idsAsistentes = sesion.asistencias.map((a) => a.userId);

  let presaberPresentados = 0;
  let postsaberPresentados = 0;
  let promedioPre: number | null = null;
  let promedioPost: number | null = null;

  // El corte de la sesión mide a QUIENES ASISTIERON a esta sesión, no a toda
  // la actividad: es justo el análisis "por sesión" que pide la Fase 10.
  if (sesion.activity.courseId && idsAsistentes.length > 0) {
    const intentos = await prisma.quizAttempt.findMany({
      where: {
        userId: { in: idsAsistentes },
        finishedAt: { not: null },
        moment: { not: null },
        quiz: { courseId: sesion.activity.courseId, moduleId: null },
      },
      select: { userId: true, moment: true, score: true },
    });

    const mejorPorPersona = (momento: "PRESABER" | "POSTSABER") => {
      const porUsuario = new Map<string, number>();
      for (const i of intentos) {
        if (i.moment !== momento || i.score === null) continue;
        porUsuario.set(i.userId, Math.max(porUsuario.get(i.userId) ?? 0, i.score));
      }
      return porUsuario;
    };

    const pre = mejorPorPersona("PRESABER");
    const post = mejorPorPersona("POSTSABER");
    presaberPresentados = pre.size;
    postsaberPresentados = post.size;
    promedioPre = pre.size > 0 ? Math.round([...pre.values()].reduce((a, b) => a + b, 0) / pre.size) : null;
    promedioPost = post.size > 0 ? Math.round([...post.values()].reduce((a, b) => a + b, 0) / post.size) : null;
  }

  const comparacion =
    promedioPre !== null && promedioPost !== null ? compararAdherencia(promedioPre, promedioPost) : null;

  const snapshot: SnapshotSesion = {
    asistentes,
    presaberPresentados,
    postsaberPresentados,
    promedioPre,
    promedioPost,
    diferencia: comparacion?.diferencia ?? null,
    variacion: comparacion?.variacion ?? null,
    cerradaEl: new Date().toISOString(),
  };

  await prisma.trainingSession.update({
    where: { id: sesionId },
    data: {
      fase: "CERRADA",
      status: "CLOSED",
      cerradaEl: new Date(),
      cierreSnapshot: snapshot as unknown as object,
    },
  });

  return snapshot;
}

/** Lista de asistentes con hora, para la vista en vivo del tutor. */
export async function getAsistentesSesion(sesionId: string) {
  return prisma.asistenciaSesion.findMany({
    where: { sesionId },
    orderBy: { registradaEn: "asc" },
    select: {
      registradaEn: true,
      medio: true,
      user: { select: { fullName: true, documentNumber: true } },
    },
  });
}
