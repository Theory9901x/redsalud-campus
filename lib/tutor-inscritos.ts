import type { EnrollmentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  audienciaDeActividad,
  contarAudiencia,
  filtroTrimestre,
  getActivityAdherence,
  trimestreActual,
} from "@/lib/training-plans";

/*
 * INSCRITOS Y PROGRESO (/tutor/inscritos). Solo LECTURA y solo lo suyo:
 *
 *   - Cursos: inscripciones de los cursos que dicta (Course.tutorId).
 *   - Plan: personas de las capacitaciones de sus áreas (TrainingArea.tutorId)
 *     o de un plan que él responde (TrainingPlan.tutorId) -el mismo alcance de
 *     /tutor/planes-capacitacion-: su audiencia, más cualquiera que tenga
 *     asistencia registrada (nadie que asistió desaparece).
 *
 * La única escritura que ofrece la página (marcar asistencia manual) usa la
 * acción existente setAttendanceAction, que valida el acceso por sí misma.
 */

const DIA = 86_400_000;
export const POR_PAGINA = 25;

export const ESTADOS_CURSO = {
  todos: "Todos",
  ACTIVE: "En curso",
  estancados: "Sin avanzar (+7 días)",
  COMPLETED: "Completaron",
  FAILED: "No aprobaron",
  CANCELLED: "Canceladas",
} as const;
export type EstadoCurso = keyof typeof ESTADOS_CURSO;

export const ESTADOS_PLAN = {
  todos: "Toda la audiencia",
  asistieron: "Asistieron",
  "sin-asistencia": "Sin asistencia",
  presaber: "Presentaron presaber",
  "sin-presaber": "Sin presaber",
  postsaber: "Presentaron postsaber",
  completaron: "Completaron el curso",
  "en-curso": "Curso sin terminar",
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

/** Cursos que dicta y capacitaciones del plan a su cargo (el alcance de la página). */
export async function getAlcanceTutor(tutorId: string) {
  const [cursos, actividades] = await Promise.all([
    prisma.course.findMany({
      where: { tutorId },
      orderBy: { title: "asc" },
      select: { id: true, title: true, status: true },
    }),
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
  return { cursos, actividades };
}

export type ActividadAlcance = Awaited<ReturnType<typeof getAlcanceTutor>>["actividades"][number];

// ════════════════════════════ CURSOS ════════════════════════════

export async function getInscritosCursos(
  tutorId: string,
  filtros: { curso?: string; estado?: EstadoCurso; q?: string; pagina?: number }
) {
  const q = filtros.q?.trim() ?? "";
  const pagina = Math.max(1, filtros.pagina ?? 1);
  const estado = filtros.estado ?? "todos";
  const base: Prisma.EnrollmentWhereInput = {
    course: { tutorId },
    ...(filtros.curso ? { courseId: filtros.curso } : {}),
  };
  const porEstado: Prisma.EnrollmentWhereInput =
    estado === "todos"
      ? {}
      : estado === "estancados"
        ? { status: "ACTIVE", progressPercentage: 0, enrolledAt: { lte: new Date(Date.now() - 7 * DIA) } }
        : { status: estado as EnrollmentStatus };
  const where: Prisma.EnrollmentWhereInput = { ...base, ...porEstado, ...(q ? { user: busquedaPersona(q) } : {}) };

  const [total, filas, conteos, estancados, promedio, lecciones] = await Promise.all([
    prisma.enrollment.count({ where }),
    prisma.enrollment.findMany({
      where,
      orderBy: [{ enrolledAt: "desc" }],
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      select: {
        id: true,
        status: true,
        progressPercentage: true,
        enrolledAt: true,
        completedAt: true,
        finalScore: true,
        courseId: true,
        course: { select: { title: true } },
        user: { select: { fullName: true, documentNumber: true, position: true, department: true, cargo: { select: { nombre: true } } } },
        certificate: { select: { certificateCode: true, status: true } },
        _count: { select: { lessonProgress: { where: { status: "COMPLETED" } } } },
        lessonProgress: { where: { completedAt: { not: null } }, orderBy: { completedAt: "desc" }, take: 1, select: { completedAt: true } },
      },
    }),
    prisma.enrollment.groupBy({ by: ["status"], where: base, _count: { _all: true } }),
    prisma.enrollment.count({ where: { ...base, status: "ACTIVE", progressPercentage: 0, enrolledAt: { lte: new Date(Date.now() - 7 * DIA) } } }),
    prisma.enrollment.aggregate({ where: { ...base, status: { not: "CANCELLED" } }, _avg: { progressPercentage: true } }),
    prisma.lesson.groupBy({ by: ["moduleId"], where: { isActive: true, module: { course: { tutorId } } }, _count: { _all: true } }),
  ]);

  // Lecciones activas por curso (para "x de y lecciones").
  const modulos = await prisma.courseModule.findMany({
    where: { id: { in: lecciones.map((l) => l.moduleId) } },
    select: { id: true, courseId: true },
  });
  const cursoDeModulo = new Map(modulos.map((m) => [m.id, m.courseId]));
  const leccionesPorCurso = new Map<string, number>();
  for (const l of lecciones) {
    const c = cursoDeModulo.get(l.moduleId);
    if (c) leccionesPorCurso.set(c, (leccionesPorCurso.get(c) ?? 0) + l._count._all);
  }

  const porEstadoConteo = Object.fromEntries(conteos.map((c) => [c.status, c._count._all])) as Partial<Record<EnrollmentStatus, number>>;
  return {
    total,
    pagina,
    paginas: Math.max(1, Math.ceil(total / POR_PAGINA)),
    resumen: {
      activos: porEstadoConteo.ACTIVE ?? 0,
      completados: porEstadoConteo.COMPLETED ?? 0,
      reprobados: porEstadoConteo.FAILED ?? 0,
      cancelados: porEstadoConteo.CANCELLED ?? 0,
      estancados,
      avancePromedio: promedio._avg.progressPercentage === null ? null : Math.round(promedio._avg.progressPercentage),
    },
    filas: filas.map((f) => ({
      id: f.id,
      estado: f.status,
      avance: f.progressPercentage,
      inscrito: f.enrolledAt,
      completado: f.completedAt,
      nota: f.finalScore,
      cursoId: f.courseId,
      curso: f.course.title,
      persona: f.user.fullName,
      documento: f.user.documentNumber,
      cargo: f.user.cargo?.nombre ?? f.user.position ?? null,
      dependencia: f.user.department,
      constancia: f.certificate?.status === "VALID" ? f.certificate.certificateCode : null,
      leccionesHechas: f._count.lessonProgress,
      leccionesTotal: leccionesPorCurso.get(f.courseId) ?? 0,
      ultimaActividad: f.lessonProgress[0]?.completedAt ?? null,
    })),
  };
}

/**
 * Avance lección por lección de UNA inscripción. Solo si el curso lo dicta el
 * tutor, si está vinculado a una capacitación de su alcance (cursosDelPlan),
 * o si quien mira es administrador.
 */
export async function getDetalleInscripcion(enrollmentId: string, tutorId: string, esAdmin: boolean, cursosDelPlan: string[] = []) {
  const e = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      status: true,
      progressPercentage: true,
      enrolledAt: true,
      startedAt: true,
      completedAt: true,
      finalScore: true,
      user: { select: { fullName: true, documentNumber: true, position: true, department: true, cargo: { select: { nombre: true } } } },
      course: {
        select: {
          id: true,
          title: true,
          tutorId: true,
          passingScore: true,
          modules: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              title: true,
              lessons: { where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, title: true, contentType: true } },
            },
          },
        },
      },
      lessonProgress: { select: { lessonId: true, status: true, completedAt: true } },
      quizAttempts: {
        orderBy: { startedAt: "desc" },
        take: 20,
        select: { id: true, attemptNumber: true, score: true, passed: true, moment: true, startedAt: true, finishedAt: true, quiz: { select: { title: true, moduleId: true } } },
      },
      certificate: { select: { certificateCode: true, status: true, issuedAt: true } },
    },
  });
  if (!e || (!esAdmin && e.course.tutorId !== tutorId && !cursosDelPlan.includes(e.course.id))) return null;
  const progreso = new Map(e.lessonProgress.map((p) => [p.lessonId, p]));
  return {
    ...e,
    modulos: e.course.modules.map((m) => ({
      ...m,
      lecciones: m.lessons.map((l) => ({
        ...l,
        completada: progreso.get(l.id)?.status === "COMPLETED",
        completadaEl: progreso.get(l.id)?.completedAt ?? null,
      })),
    })),
  };
}

// ════════════════════════════ PLAN ════════════════════════════

/** Resumen por capacitación para elegir a cuál entrar: audiencia, asistentes, evaluados, completaron. */
export async function getResumenActividades(actividades: ActividadAlcance[]) {
  const ids = actividades.map((a) => a.id);
  const quizIds = actividades.flatMap((a) => (a.course?.quizzes[0] ? [a.course.quizzes[0].id] : []));
  const courseIds = [...new Set(actividades.flatMap((a) => (a.courseId ? [a.courseId] : [])))];
  const [audiencias, asistencias, evaluados, completados] = await Promise.all([
    Promise.all(actividades.map((a) => contarAudiencia(a))),
    ids.length ? prisma.trainingAttendance.groupBy({ by: ["activityId", "userId"], where: { activityId: { in: ids }, attended: true } }) : Promise.resolve([]),
    quizIds.length ? prisma.quizAttempt.groupBy({ by: ["quizId", "userId"], where: { quizId: { in: quizIds }, finishedAt: { not: null } } }) : Promise.resolve([]),
    courseIds.length ? prisma.enrollment.groupBy({ by: ["courseId"], where: { courseId: { in: courseIds }, status: "COMPLETED" }, _count: { _all: true } }) : Promise.resolve([]),
  ]);
  const cuenta = <T,>(lista: T[], clave: (x: T) => string) => {
    const m = new Map<string, number>();
    for (const x of lista) m.set(clave(x), (m.get(clave(x)) ?? 0) + 1);
    return m;
  };
  const asistPor = cuenta(asistencias, (x) => x.activityId);
  const evalPor = cuenta(evaluados, (x) => x.quizId);
  const compPor = new Map(completados.map((c) => [c.courseId, c._count._all]));
  return actividades.map((a, i) => ({
    id: a.id,
    audiencia: audiencias[i],
    asistieron: asistPor.get(a.id) ?? 0,
    evaluados: a.course?.quizzes[0] ? evalPor.get(a.course.quizzes[0].id) ?? 0 : null,
    completaron: a.courseId ? compPor.get(a.courseId) ?? 0 : null,
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
 * postsaber (mejor intento terminado dentro del trimestre), y avance en el
 * curso vinculado. Paginado y con filtros por estado y por nombre/documento.
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
  const curso = (status: EnrollmentStatus): Prisma.UserWhereInput =>
    a.courseId ? { enrollments: { some: { courseId: a.courseId, status } } } : { id: "__ninguno__" };

  const porEstado: Record<EstadoPlan, Prisma.UserWhereInput> = {
    todos: {},
    asistieron: asistio,
    "sin-asistencia": { NOT: asistio },
    presaber: presento("PRESABER"),
    "sin-presaber": quiz ? { NOT: presento("PRESABER") } : {},
    postsaber: presento("POSTSABER"),
    completaron: curso("COMPLETED"),
    "en-curso": curso("ACTIVE"),
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
        enrollments: { where: { courseId: a.courseId ?? "__ninguno__" }, select: { id: true, status: true, progressPercentage: true }, take: 1 },
      },
    }),
    getActivityAdherence(a, f),
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
      fuente: adherencia.source,
      asistieron: asistentes.length,
      presaber: presaber.length,
      postsaber: postsaber.length,
    },
    filas: usuarios.map((u) => {
      const asis = u.trainingAttendances[0];
      const ins = u.enrollments[0];
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
        inscripcion: ins ? { id: ins.id, estado: ins.status, avance: ins.progressPercentage } : null,
      };
    }),
  };
}

// ════════════════════════════ CONSTANCIAS ════════════════════════════

/**
 * Constancias emitidas en los cursos que dicta el tutor, y quiénes ya
 * completaron un curso sin tener constancia todavía (la emisión la hace la
 * plataforma o el administrador; aquí solo se consulta).
 */
export async function getConstanciasTutor(
  tutorId: string,
  filtros: { curso?: string; estado?: "VALID" | "REVOKED" | "todas"; q?: string; pagina?: number }
) {
  const q = filtros.q?.trim() ?? "";
  const pagina = Math.max(1, filtros.pagina ?? 1);
  const base: Prisma.CertificateWhereInput = { course: { tutorId }, ...(filtros.curso ? { courseId: filtros.curso } : {}) };
  const where: Prisma.CertificateWhereInput = {
    ...base,
    ...(filtros.estado && filtros.estado !== "todas" ? { status: filtros.estado } : {}),
    ...(q ? { OR: [{ user: busquedaPersona(q) }, { certificateCode: { contains: q.toUpperCase() } }] } : {}),
  };
  const inicioMes = (() => {
    const ym = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit" }).format(new Date());
    return new Date(`${ym}-01T00:00:00-05:00`);
  })();
  const pendientesWhere: Prisma.EnrollmentWhereInput = {
    course: { tutorId },
    ...(filtros.curso ? { courseId: filtros.curso } : {}),
    status: "COMPLETED",
    certificate: { is: null },
  };

  const [total, filas, validas, revocadas, delMes, pendientesTotal, pendientes, porMes] = await Promise.all([
    prisma.certificate.count({ where }),
    prisma.certificate.findMany({
      where,
      orderBy: { issuedAt: "desc" },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      select: {
        id: true,
        certificateCode: true,
        issuedAt: true,
        status: true,
        revokedReason: true,
        user: { select: { fullName: true, documentNumber: true } },
        course: { select: { title: true, durationHours: true } },
        enrollment: { select: { finalScore: true } },
      },
    }),
    prisma.certificate.count({ where: { ...base, status: "VALID" } }),
    prisma.certificate.count({ where: { ...base, status: "REVOKED" } }),
    prisma.certificate.count({ where: { ...base, status: "VALID", issuedAt: { gte: inicioMes } } }),
    prisma.enrollment.count({ where: pendientesWhere }),
    prisma.enrollment.findMany({
      where: pendientesWhere,
      orderBy: { completedAt: "desc" },
      take: 8,
      select: { id: true, completedAt: true, finalScore: true, user: { select: { fullName: true, documentNumber: true } }, course: { select: { title: true } } },
    }),
    prisma.certificate.findMany({
      where: { ...base, status: "VALID", issuedAt: { gte: new Date(inicioMes.getTime() - 330 * DIA) } },
      select: { issuedAt: true },
    }),
  ]);

  // Emisión de los últimos 12 meses (hora de Colombia), para el minigráfico.
  const clave = (f: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit" }).format(f);
  const meses = Array.from({ length: 12 }, (_, i) => {
    const f = new Date(inicioMes.getTime() - (11 - i) * 30.44 * DIA + 15 * DIA);
    return { clave: clave(f), fecha: f, total: 0 };
  });
  const indice = new Map(meses.map((m, i) => [m.clave, i]));
  for (const c of porMes) {
    const i = indice.get(clave(c.issuedAt));
    if (i !== undefined) meses[i].total++;
  }

  return {
    total,
    pagina,
    paginas: Math.max(1, Math.ceil(total / POR_PAGINA)),
    resumen: { validas, revocadas, delMes, pendientes: pendientesTotal },
    filas,
    pendientes,
    meses,
  };
}
