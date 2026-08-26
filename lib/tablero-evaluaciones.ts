import { prisma } from "@/lib/prisma";
import type { CourseAudience, TrainingModality } from "@prisma/client";

/**
 * FASE 10 — Datos del tablero de /evaluaciones del estudiante.
 *
 * La unidad es la CAPACITACIÓN (actividad del PIC), no el examen suelto:
 * cada fila trae el ciclo completo de esta persona -presaber, capacitación,
 * postsaber, encuesta- con su siguiente acción, y las dimensiones por las
 * que se agrupa (área, trimestre, modalidad, próxima sesión).
 *
 * Rendimiento: TODO se resuelve aquí con consultas por lote -intentos de
 * todos los cursos en una, encuestas en una, sesiones en una-; nada de una
 * consulta por tarjeta. Con las 55 líneas del PIC son 5 consultas en total.
 */

export type PasoCiclo = {
  clave: "presaber" | "capacitacion" | "postsaber" | "encuesta";
  etiqueta: string;
  estado: "hecho" | "disponible" | "pendiente" | "no-aplica";
  /** Nota obtenida (pasos de evaluación ya presentados). */
  nota?: number | null;
  detalle?: string;
};

export type AccionTablero =
  | { tipo: "presaber" | "postsaber"; activityId: string; etiqueta: string }
  | { tipo: "encuesta"; slug: string; etiqueta: string }
  | { tipo: "sesion"; etiqueta: string; detalle: string }
  | null;

export type FilaTablero = {
  id: string;
  titulo: string;
  area: string;
  areaOrden: number;
  plan: string;
  planId: string;
  modalidad: TrainingModality;
  trimestres: number[];
  cerrada: boolean;
  pasos: PasoCiclo[];
  accion: AccionTablero;
  cicloCompleto: boolean;
  pendientes: number;
  /** Próxima sesión agendada (presencial o virtual), ya formateada en servidor. */
  proximaSesion: { etiqueta: string; lugar: string | null; esFutura: boolean } | null;
  /** Fecha para el orden cronológico: la sesión más próxima, o null. */
  fechaOrden: string | null;
};

export type TableroEvaluaciones = {
  filas: FilaTablero[];
  kpis: {
    pendientes: number;
    ciclosCompletos: number;
    encuestasPendientes: number;
    proximasSesiones: number;
  };
};

const FORMATO_SESION = new Intl.DateTimeFormat("es-CO", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

export async function getTableroEvaluaciones(userId: string): Promise<TableroEvaluaciones> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { department: true, personnelType: true },
  });
  const audiencia: CourseAudience[] = [user.personnelType, "AMBOS"];

  // 1 — Capacitaciones que le aplican a esta persona (plan activo, visibles).
  const actividades = await prisma.trainingActivity.findMany({
    where: {
      plan: { status: "ACTIVE" },
      status: { not: "DRAFT" },
      targetAudience: { in: audiencia },
    },
    select: {
      id: true,
      title: true,
      courseId: true,
      status: true,
      modality: true,
      quarters: true,
      presaberOpenedAt: true,
      presaberClosedAt: true,
      postsaberOpenedAt: true,
      postsaberClosedAt: true,
      area: { select: { name: true, sortOrder: true } },
      plan: { select: { id: true, title: true, targetDepartment: true } },
    },
  });

  // Pertenencia por dependencia del plan (misma regla del resto del módulo).
  const aplicables = actividades.filter((a) => {
    const dep = a.plan.targetDepartment;
    return !dep || (user.department && user.department.trim().toLowerCase() === dep.trim().toLowerCase());
  });

  const courseIds = [...new Set(aplicables.map((a) => a.courseId).filter((c): c is string => !!c))];
  const activityIds = aplicables.map((a) => a.id);
  const ahora = new Date();

  // 2..5 — Lotes: intentos, encuestas, respuestas, sesiones. En paralelo.
  const [intentos, encuestas, sesiones] = await Promise.all([
    courseIds.length > 0
      ? prisma.quizAttempt.findMany({
          where: {
            userId,
            score: { not: null },
            moment: { not: null },
            quiz: { courseId: { in: courseIds }, moduleId: null },
          },
          select: { moment: true, score: true, quiz: { select: { courseId: true } } },
        })
      : Promise.resolve([]),
    prisma.survey.findMany({
      where: {
        trainingActivityId: { in: activityIds },
        status: "PUBLISHED",
        isTemplate: false,
        targetAudience: { in: audiencia },
      },
      select: {
        slug: true,
        trainingActivityId: true,
        responses: { where: { userId, completed: true }, select: { id: true }, take: 1 },
      },
    }),
    prisma.trainingSession.findMany({
      where: { activityId: { in: activityIds }, status: { not: "CLOSED" }, startsAt: { gte: new Date(ahora.getTime() - 12 * 3600000) } },
      orderBy: { startsAt: "asc" },
      select: { activityId: true, startsAt: true, location: true, modality: true, municipio: { select: { nombre: true } } },
    }),
  ]);

  // Mejor nota por curso y momento.
  const mejorNota = new Map<string, number>();
  for (const i of intentos) {
    const clave = `${i.quiz.courseId}:${i.moment}`;
    mejorNota.set(clave, Math.max(mejorNota.get(clave) ?? 0, i.score!));
  }

  const encuestaPorActividad = new Map<string, { slug: string; respondida: boolean }>();
  for (const e of encuestas) {
    if (!e.trainingActivityId) continue;
    // Si hay varias, gana la que aún esté pendiente.
    const previa = encuestaPorActividad.get(e.trainingActivityId);
    const registro = { slug: e.slug, respondida: e.responses.length > 0 };
    if (!previa || (previa.respondida && !registro.respondida)) encuestaPorActividad.set(e.trainingActivityId, registro);
  }

  const sesionPorActividad = new Map<string, (typeof sesiones)[number]>();
  for (const s of sesiones) {
    if (!sesionPorActividad.has(s.activityId)) sesionPorActividad.set(s.activityId, s);
  }

  // 6 — Armar cada fila con su ciclo.
  const filas: FilaTablero[] = aplicables.map((a) => {
    const cerrada = a.status === "CLOSED";
    const pre = a.courseId ? (mejorNota.get(`${a.courseId}:PRESABER`) ?? null) : null;
    const post = a.courseId ? (mejorNota.get(`${a.courseId}:POSTSABER`) ?? null) : null;
    const preHecho = pre !== null;
    const postHecho = post !== null;
    const encuesta = encuestaPorActividad.get(a.id) ?? null;
    const sesion = sesionPorActividad.get(a.id) ?? null;

    const pasos: PasoCiclo[] = [
      {
        clave: "presaber",
        etiqueta: "Presaber",
        estado: !a.courseId ? "no-aplica" : preHecho ? "hecho" : cerrada ? "pendiente" : "disponible",
        nota: pre,
      },
      {
        clave: "capacitacion",
        etiqueta: "Capacitación",
        estado: cerrada ? "hecho" : sesion ? "disponible" : "pendiente",
        detalle: sesion
          ? `${FORMATO_SESION.format(sesion.startsAt)}${sesion.location ? ` · ${sesion.location}` : sesion.municipio ? ` · ${sesion.municipio.nombre}` : ""}`
          : undefined,
      },
      {
        clave: "postsaber",
        etiqueta: "Postsaber",
        estado: !a.courseId ? "no-aplica" : postHecho ? "hecho" : cerrada ? "pendiente" : preHecho ? "disponible" : "pendiente",
        nota: post,
      },
      {
        clave: "encuesta",
        etiqueta: "Encuesta",
        estado: !encuesta ? "no-aplica" : encuesta.respondida ? "hecho" : "disponible",
      },
    ];

    // La siguiente acción: el primer paso disponible que dependa de la persona.
    let accion: AccionTablero = null;
    if (!cerrada && a.courseId && !preHecho) {
      accion = { tipo: "presaber", activityId: a.id, etiqueta: "Presentar presaber" };
    } else if (!cerrada && a.courseId && preHecho && !postHecho) {
      accion = { tipo: "postsaber", activityId: a.id, etiqueta: "Presentar postsaber" };
    } else if (encuesta && !encuesta.respondida) {
      accion = { tipo: "encuesta", slug: encuesta.slug, etiqueta: "Responder encuesta" };
    } else if (!cerrada && sesion) {
      accion = {
        tipo: "sesion",
        etiqueta: "Ver mi sesión",
        detalle: FORMATO_SESION.format(sesion.startsAt),
      };
    }

    const pendientes = pasos.filter((p) => p.estado === "disponible" && p.clave !== "capacitacion").length;
    const cicloCompleto = !!a.courseId && preHecho && postHecho && (!encuesta || encuesta.respondida);

    return {
      id: a.id,
      titulo: a.title,
      area: a.area?.name ?? "Sin área",
      areaOrden: a.area?.sortOrder ?? 99,
      plan: a.plan.title,
      planId: a.plan.id,
      modalidad: a.modality,
      trimestres: a.quarters,
      cerrada,
      pasos,
      accion,
      cicloCompleto,
      pendientes,
      proximaSesion: sesion
        ? {
            etiqueta: FORMATO_SESION.format(sesion.startsAt),
            lugar: sesion.location ?? sesion.municipio?.nombre ?? null,
            esFutura: sesion.startsAt > ahora,
          }
        : null,
      fechaOrden: sesion?.startsAt.toISOString() ?? null,
    };
  });

  return {
    filas,
    kpis: {
      pendientes: filas.reduce((s, f) => s + f.pendientes, 0),
      ciclosCompletos: filas.filter((f) => f.cicloCompleto).length,
      encuestasPendientes: filas.filter((f) => f.pasos.some((p) => p.clave === "encuesta" && p.estado === "disponible")).length,
      proximasSesiones: filas.filter((f) => f.modalidad !== "VIRTUAL" && f.proximaSesion?.esFutura).length,
    },
  };
}
