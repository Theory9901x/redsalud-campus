import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  audienciaDeActividad,
  contarAudiencia,
  filtroTrimestre,
  getActivityAdherence,
  trimestreActual,
} from "@/lib/training-plans";

/*
 * PARTICIPANTES (/tutor/inscritos). Solo LECTURA y solo lo suyo: personas
 * de las capacitaciones de sus áreas (TrainingArea.tutorId) o de un plan que
 * él responde (TrainingPlan.tutorId) -el mismo alcance de
 * /tutor/planes-capacitacion-: su audiencia, más cualquiera que tenga
 * asistencia registrada (nadie que asistió desaparece).
 *
 * El tutor es un ÁREA del Plan Institucional de Capacitaciones: aquí no hay
 * cursos, avance por lecciones ni constancias. Se mide asistencia por
 * trimestre y presaber/postsaber por capacitación.
 *
 * La única escritura que ofrece la página (marcar asistencia manual) usa la
 * acción existente setAttendanceAction, que valida el acceso por sí misma.
 */

export const POR_PAGINA = 25;

export const ESTADOS_PLAN = {
  todos: "Toda la audiencia",
  asistieron: "Asistieron",
  "sin-asistencia": "Sin asistencia",
  presaber: "Presentaron presaber",
  "sin-presaber": "Sin presaber",
  postsaber: "Presentaron postsaber",
} as const;
export type EstadoPlan = keyof typeof ESTADOS_PLAN;

const busquedaPersona = (q: string): Prisma.UserWhereInput =>
  q
    ? {
        OR: [
          { fullName: { contains: q, mode: "insensitive" } },
          { documentNumber: { contains: q } },
        ],
      }
    : {};

/** Áreas a su cargo y capacitaciones del plan que responde (el alcance de la página). */
export async function getAlcanceTutor(tutorId: string) {
  const [areas, actividades] = await Promise.all([
    prisma.trainingArea.findMany({ where: { tutorId }, select: { id: true, name: true }, orderBy: { sortOrder: "asc" } }),
    prisma.trainingActivity.findMany({
      where: { plan: { kind: "CAPACITACION" }, OR: [{ area: { tutorId } }, { plan: { tutorId } }] },
      orderBy: [{ plan: { year: "desc" } }, { title: "asc" }],
      select: {
        id: true,
        title: true,
        planId: true,
        status: true,
        quarters: true,
        courseId: true,
        programa: true,
        targetAudience: true,
        audienceCommitteePlanId: true,
        area: { select: { name: true } },
        course: { select: { title: true, quizzes: { where: { moduleId: null, isActive: true }, select: { id: true, passingScore: true }, take: 1 } } },
        plan: { select: { id: true, title: true, year: true, targetDepartment: true, kind: true, status: true } },
      },
    }),
  ]);
  return { areas, actividades };
}

export type ActividadAlcance = Awaited<ReturnType<typeof getAlcanceTutor>>["actividades"][number];

// ════════════════════════════ PLAN ════════════════════════════

/** Resumen por capacitación para elegir a cuál entrar: audiencia, asistentes y evaluados. */
export async function getResumenActividades(actividades: ActividadAlcance[]) {
  const ids = actividades.map((a) => a.id);
  const quizIds = actividades.flatMap((a) => (a.course?.quizzes[0] ? [a.course.quizzes[0].id] : []));
  const [audiencias, asistencias, evaluados] = await Promise.all([
    Promise.all(actividades.map((a) => contarAudiencia(a))),
    ids.length ? prisma.trainingAttendance.groupBy({ by: ["activityId", "userId"], where: { activityId: { in: ids }, attended: true } }) : Promise.resolve([]),
    quizIds.length ? prisma.quizAttempt.groupBy({ by: ["quizId", "userId"], where: { quizId: { in: quizIds }, finishedAt: { not: null } } }) : Promise.resolve([]),
  ]);
  const cuenta = <T,>(lista: T[], clave: (x: T) => string) => {
    const m = new Map<string, number>();
    for (const x of lista) m.set(clave(x), (m.get(clave(x)) ?? 0) + 1);
    return m;
  };
  const asistPor = cuenta(asistencias, (x) => x.activityId);
  const evalPor = cuenta(evaluados, (x) => x.quizId);
  return actividades.map((a, i) => ({
    id: a.id,
    audiencia: audiencias[i],
    asistieron: asistPor.get(a.id) ?? 0,
    evaluados: a.course?.quizzes[0] ? evalPor.get(a.course.quizzes[0].id) ?? 0 : null,
  }));
}

/** Trimestre a revisar de una capacitación: el pedido, o el en curso, o el último programado ya transcurrido, o el primero. */
export function trimestreDeRevision(a: ActividadAlcance, pedido?: number) {
  const opciones = a.quarters.length ? [...a.quarters].sort((x, y) => x - y) : [1, 2, 3, 4];
  if (pedido && pedido >= 1 && pedido <= 4) return { opciones, elegido: pedido };
  const ahora = trimestreActual();
  const enCurso = a.plan.year === ahora.anio ? ahora.trimestre : a.plan.year < ahora.anio ? 5 : 0;
  const elegido =
    (opciones.includes(enCurso) && enCurso) || [...opciones].reverse().find((t) => t < enCurso) || opciones[0];
  return { opciones, elegido };
}

/**
 * Personas de UNA capacitación en UN trimestre: asistencia, presaber y
 * postsaber (mejor intento terminado dentro del trimestre). La adherencia es
 * por asistencia, no por haber terminado un curso. Paginado y con filtros
 * por estado y por nombre/documento.
 */
export async function getPersonasActividad(
  a: ActividadAlcance,
  filtros: { trimestre: number; estado?: EstadoPlan; q?: string; pagina?: number }
) {
  const q = filtros.q?.trim() ?? "";
  const pagina = Math.max(1, filtros.pagina ?? 1);
  const t = filtros.trimestre;
  const f = filtroTrimestre(a.plan.year, t);
  const quiz = a.course?.quizzes[0] ?? null;
  const enVentana = { gte: f.desde, lt: f.hasta };

  const asistio: Prisma.UserWhereInput = { trainingAttendances: { some: { activityId: a.id, trimestre: t, attended: true } } };
  const presento = (moment: "PRESABER" | "POSTSABER"): Prisma.UserWhereInput =>
    quiz ? { quizAttempts: { some: { quizId: quiz.id, moment, finishedAt: enVentana } } } : { id: "__ninguno__" };

  const porEstado: Record<EstadoPlan, Prisma.UserWhereInput> = {
    todos: {},
    asistieron: asistio,
    "sin-asistencia": { NOT: asistio },
    presaber: presento("PRESABER"),
    "sin-presaber": quiz ? { NOT: presento("PRESABER") } : {},
    postsaber: presento("POSTSABER"),
  };

  const universo: Prisma.UserWhereInput = {
    OR: [audienciaDeActividad(a), { trainingAttendances: { some: { activityId: a.id } } }],
  };
  const where: Prisma.UserWhereInput = { AND: [universo, porEstado[filtros.estado ?? "todos"], busquedaPersona(q)] };

  const [total, usuarios, adherencia, asistentes, presaber, postsaber] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { fullName: "asc" },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      select: {
        id: true,
        fullName: true,
        documentNumber: true,
        position: true,
        department: true,
        cargo: { select: { nombre: true } },
        trainingAttendances: { where: { activityId: a.id, trimestre: t }, select: { attended: true, registeredAt: true, source: true }, take: 1 },
      },
    }),
    // courseId: null -> adherencia por ASISTENCIA en el trimestre.
    getActivityAdherence({ ...a, courseId: null }, f),
    prisma.trainingAttendance.groupBy({ by: ["userId"], where: { activityId: a.id, trimestre: t, attended: true } }),
    quiz ? prisma.quizAttempt.groupBy({ by: ["userId"], where: { quizId: quiz.id, moment: "PRESABER", finishedAt: enVentana } }) : Promise.resolve([]),
    quiz ? prisma.quizAttempt.groupBy({ by: ["userId"], where: { quizId: quiz.id, moment: "POSTSABER", finishedAt: enVentana } }) : Promise.resolve([]),
  ]);

  // Mejor intento terminado de cada persona de esta página, por momento.
  const intentos = quiz && usuarios.length
    ? await prisma.quizAttempt.findMany({
        where: { quizId: quiz.id, userId: { in: usuarios.map((u) => u.id) }, finishedAt: enVentana, score: { not: null }, moment: { not: null } },
        select: { userId: true, moment: true, score: true },
      })
    : [];
  const mejor = new Map<string, number>();
  for (const i of intentos) {
    const k = `${i.userId}:${i.moment}`;
    if ((mejor.get(k) ?? -1) < i.score!) mejor.set(k, i.score!);
  }

  return {
    total,
    pagina,
    paginas: Math.max(1, Math.ceil(total / POR_PAGINA)),
    aprobacion: quiz?.passingScore ?? null,
    resumen: {
      audiencia: adherencia.totalExpected,
      cumplen: adherencia.adherentCount,
      adherencia: adherencia.totalExpected > 0 ? adherencia.percentage : null,
      asistieron: asistentes.length,
      presaber: presaber.length,
      postsaber: postsaber.length,
    },
    filas: usuarios.map((u) => {
      const asis = u.trainingAttendances[0];
      return {
        id: u.id,
        persona: u.fullName,
        documento: u.documentNumber,
        cargo: u.cargo?.nombre ?? u.position ?? null,
        dependencia: u.department,
        asistio: asis?.attended ?? false,
        registrada: asis?.registeredAt ?? null,
        fuente: asis?.source ?? null,
        presaber: mejor.get(`${u.id}:PRESABER`) ?? null,
        postsaber: mejor.get(`${u.id}:POSTSABER`) ?? null,
      };
    }),
  };
}
