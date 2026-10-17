import { prisma } from "@/lib/prisma";
import { targetAudienceUserWhere, rangoTrimestre, type ActivityReportData } from "@/lib/training-plans";
import type { CourseAudience } from "@prisma/client";
import { actividadesConEvaluacion } from "@/lib/evaluacion-capacitacion";

export { semaforo, UMBRAL_VERDE, UMBRAL_AMARILLO, type Semaforo } from "@/lib/semaforo-indicadores";

/**
 * INDICADORES DEL PLAN DE CAPACITACIONES.
 *
 * La UNIDAD DE MEDIDA es la CAPACITACIÓN (cada línea del PIC): cada
 * indicador se calcula primero para cada capacitación por separado, y lo
 * institucional y lo de cada área son solo el CONSOLIDADO de esas
 * mediciones. Un "+12 pp" general no dice nada por sí solo; lo que se
 * gestiona es que la jornada de higiene de manos de Calidad mejoró +40 y la
 * de PAI apenas +5.
 *
 * Los tres indicadores, con su ficha técnica:
 *
 * 1. Adherencia del conocimiento (principal). Por capacitación,
 *    ((promedio postsaber − promedio presaber) ÷ promedio presaber) × 100
 *    sobre quienes tienen AMBOS intentos. Se mide EN VIVO: una jornada
 *    abierta con gente que ya completó el ciclo entra como PRELIMINAR; al
 *    cerrarla, el dato queda DEFINITIVO (se lee del informe congelado del
 *    acta). El consolidado es el promedio de la variación por persona de
 *    todas las capacitaciones medidas, con la misma fórmula de siempre.
 * 2. Cobertura de evaluación: capacitación con su evaluación presaber /
 *    postsaber configurada -activa y con al menos una pregunta- (1) o sin ella (0).
 * 3. Asistencia efectiva: personas con asistencia registrada frente a la
 *    audiencia objetivo de la capacitación.
 *
 * Todo se calcula solo, en tiempo real, en UNA pasada sobre las
 * actividades del plan (~60): un puñado de consultas agrupadas, nunca una
 * por capacitación. Nadie marca nada a mano.
 */

export type Indicadores = {
  adherencia: {
    /** Puntos porcentuales de mejora; null si nadie ha completado el ciclo. */
    valor: number | null;
    personas: number;
    /** Capacitaciones con al menos una persona con ciclo completo. */
    actividadesMedidas: number;
    /** De las medidas, cuántas siguen abiertas (dato preliminar). */
    preliminares: number;
    /** De las medidas, cuántas ya cerraron (dato definitivo). */
    actividadesCerradas: number;
  };
  cobertura: { valor: number; conContenido: number; total: number };
  asistencia: { valor: number; asistentes: number; audiencia: number };
};

export type IndicadoresPorArea = Indicadores & {
  areaId: string;
  areaNombre: string;
  /** La misma desagregación por trimestre, pero del universo del área: para la ficha de cada área. */
  porTrimestre: { trimestre: number; indicadores: Indicadores }[];
};

/** Ciclo presaber/postsaber de una capacitación: solo quienes tienen ambos intentos. */
export type CicloActividad = {
  promedioPre: number;
  promedioPost: number;
  personas: number;
  /** Variación por persona (%), para el consolidado. */
  variaciones: number[];
};

export type EstadoActividad = "borrador" | "abierta" | "cerrada";

/** Lo medido de UNA capacitación: la unidad sobre la que se aplica cada indicador. */
export type MedicionActividad = {
  activityId: string;
  titulo: string;
  areaId: string;
  areaNombre: string;
  programa: string | null;
  quarters: number[];
  estado: EstadoActividad;
  cerradaEl: Date | null;
  /** Primera jornada agendada, si la hay. */
  jornada: Date | null;
  conContenido: boolean;
  audiencia: number;
  /** Personas distintas con asistencia, en el año y por trimestre. */
  asistentes: number;
  asistentesPorTrimestre: Record<number, number>;
  /** Ciclo del año y por trimestre (por fecha del intento; congelado = igual en todos sus trimestres). */
  ciclo: CicloActividad | null;
  cicloPorTrimestre: Record<number, CicloActividad | null>;
  /** true mientras la jornada siga abierta: su adherencia se mueve con cada intento. */
  preliminar: boolean;
};

export type PlanIndicadores = {
  planTitulo: string;
  anual: Indicadores;
  porTrimestre: { trimestre: number; indicadores: Indicadores }[];
  /** Desagregación del consolidado del año, para el detalle bajo las tarjetas. */
  porArea: IndicadoresPorArea[];
  /** Todas las capacitaciones del alcance, cada una con su medición. */
  actividades: MedicionActividad[];
};

const TRIMESTRES = [1, 2, 3, 4] as const;

/** Consolidado de un conjunto de capacitaciones; `t` toma la medición del trimestre en vez de la del año. */
function agregar(actividades: MedicionActividad[], t?: number): Indicadores {
  const ciclos = actividades.map((a) => (t ? a.cicloPorTrimestre[t] : a.ciclo));
  const variaciones = ciclos.flatMap((c) => c?.variaciones ?? []);
  const medidas = actividades.filter((_, i) => (ciclos[i]?.personas ?? 0) > 0);
  const conContenido = actividades.filter((a) => a.conContenido).length;
  const audiencia = actividades.reduce((s, a) => s + a.audiencia, 0);
  const asistentes = actividades.reduce((s, a) => s + (t ? (a.asistentesPorTrimestre[t] ?? 0) : a.asistentes), 0);

  return {
    adherencia: {
      valor: variaciones.length > 0 ? Math.round(variaciones.reduce((s, v) => s + v, 0) / variaciones.length) : null,
      personas: variaciones.length,
      actividadesMedidas: medidas.length,
      preliminares: medidas.filter((a) => a.preliminar).length,
      actividadesCerradas: medidas.filter((a) => !a.preliminar).length,
    },
    cobertura: {
      valor: actividades.length > 0 ? Math.round((conContenido / actividades.length) * 100) : 0,
      conContenido,
      total: actividades.length,
    },
    asistencia: {
      valor: audiencia > 0 ? Math.round((asistentes / audiencia) * 100) : 0,
      asistentes,
      audiencia,
    },
  };
}

function serie(actividades: MedicionActividad[]) {
  // Una línea puede estar en varios trimestres: cuenta en cada uno, que es
  // como la programó el PIC.
  return TRIMESTRES.map((t) => ({
    trimestre: t,
    indicadores: agregar(
      actividades.filter((a) => a.quarters.includes(t)),
      t
    ),
  }));
}

/** Ciclo a partir de una lista de personas con sus dos notas: solo quienes tienen ambas y un presaber > 0. */
function cicloDe(personas: { presaber: number | null; postsaber: number | null }[]): CicloActividad | null {
  // Ambos intentos, y un presaber mayor que cero: dividir por cero no es
  // "mejoró infinito", es que no hay línea base con la que comparar.
  const completas = personas.filter((p): p is { presaber: number; postsaber: number } => p.presaber !== null && p.postsaber !== null && p.presaber > 0);
  if (completas.length === 0) return null;
  const prom = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  return {
    promedioPre: prom(completas.map((p) => p.presaber)),
    promedioPost: prom(completas.map((p) => p.postsaber)),
    personas: completas.length,
    variaciones: completas.map((p) => ((p.postsaber - p.presaber) / p.presaber) * 100),
  };
}

type Intento = { userId: string; moment: "PRESABER" | "POSTSABER" | null; score: number | null; finishedAt: Date | null };

/**
 * Mejor intento por persona por momento, el mismo criterio de
 * computeCycleResults (lib/training-plans.ts): a alguien se le mide por lo
 * mejor que demostró en la ventana.
 */
function personasDe(intentos: Intento[], ventana?: { desde: Date; hasta: Date }) {
  const mejores = new Map<string, { presaber: number | null; postsaber: number | null }>();
  for (const i of intentos) {
    if (i.score === null || !i.moment || !i.finishedAt) continue;
    if (ventana && (i.finishedAt < ventana.desde || i.finishedAt >= ventana.hasta)) continue;
    const r = mejores.get(i.userId) ?? { presaber: null, postsaber: null };
    const clave = i.moment === "PRESABER" ? "presaber" : "postsaber";
    if (r[clave] === null || i.score > r[clave]!) r[clave] = i.score;
    mejores.set(i.userId, r);
  }
  return [...mejores.values()];
}

/**
 * `areaIds` acota el universo: un tutor de área ve sus indicadores con las
 * mismas fórmulas, no unas propias. null = institucional, todas las áreas.
 */
export async function getPlanIndicators(planId: string, areaIds: string[] | null): Promise<PlanIndicadores | null> {
  const plan = await prisma.trainingPlan.findUnique({
    where: { id: planId },
    select: { title: true, year: true, targetDepartment: true },
  });
  if (!plan) return null;

  const actividades = await prisma.trainingActivity.findMany({
    where: { planId, ...(areaIds ? { areaId: { in: areaIds } } : {}) },
    orderBy: { title: "asc" },
    select: {
      id: true,
      title: true,
      programa: true,
      quarters: true,
      status: true,
      enabledAt: true,
      closedAt: true,
      courseId: true,
      targetAudience: true,
      audienceCommitteePlanId: true,
      reportSnapshot: true,
      area: { select: { id: true, name: true } },
    },
  });
  if (actividades.length === 0) {
    const vacio = agregar([]);
    return {
      planTitulo: plan.title,
      anual: vacio,
      porTrimestre: TRIMESTRES.map((t) => ({ trimestre: t, indicadores: vacio })),
      porArea: [],
      actividades: [],
    };
  }
  const ids = actividades.map((a) => a.id);

  // La audiencia objetivo depende solo de (dependencia del plan × tipo de
  // personal), no de la actividad: tres conteos en vez de uno por línea.
  const audiencias: CourseAudience[] = ["AMBOS", "ASISTENCIAL", "ADMINISTRATIVO"];
  const comites = [...new Set(actividades.map((a) => a.audienceCommitteePlanId).filter((x): x is string => !!x))];
  // Cursos cuya evaluación final alimenta la adherencia: los que no estén
  // congelados en un acta se leen en vivo.
  const cursosEnVivo = [...new Set(actividades.filter((a) => a.courseId && !a.reportSnapshot).map((a) => a.courseId!))];

  const [conteosAudiencia, integrantes, asistencias, sesiones, quizzes, conEvaluacion] = await Promise.all([
    Promise.all(audiencias.map(async (a) => [a, await prisma.user.count({ where: targetAudienceUserWhere(plan.targetDepartment, a) })] as const)).then((xs) => new Map(xs)),
    comites.length ? prisma.committeeMember.findMany({ where: { planId: { in: comites } }, select: { planId: true, userId: true } }) : Promise.resolve([]),
    prisma.trainingAttendance.findMany({ where: { activityId: { in: ids }, attended: true }, select: { activityId: true, userId: true, trimestre: true } }),
    prisma.trainingSession.findMany({ where: { activityId: { in: ids } }, orderBy: { startsAt: "asc" }, select: { activityId: true, startsAt: true } }),
    cursosEnVivo.length ? prisma.quiz.findMany({ where: { courseId: { in: cursosEnVivo }, moduleId: null }, select: { id: true, courseId: true } }) : Promise.resolve([]),
    actividadesConEvaluacion(actividades),
  ]);

  // Una evaluación final por curso (la primera, como findFirst en computeCycleResults).
  const quizPorCurso = new Map<string, string>();
  for (const q of quizzes) if (!quizPorCurso.has(q.courseId)) quizPorCurso.set(q.courseId, q.id);
  const intentosPorQuiz = new Map<string, Intento[]>();
  if (quizPorCurso.size > 0) {
    const intentos = await prisma.quizAttempt.findMany({
      where: { quizId: { in: [...quizPorCurso.values()] }, moment: { not: null }, score: { not: null }, finishedAt: { not: null } },
      select: { quizId: true, userId: true, moment: true, score: true, finishedAt: true },
    });
    for (const i of intentos) {
      const lista = intentosPorQuiz.get(i.quizId) ?? [];
      lista.push(i);
      intentosPorQuiz.set(i.quizId, lista);
    }
  }

  // Integrantes por comité: con audiencia de comité solo cuentan ellos.
  const integrantesPorComite = new Map<string, Set<string>>();
  for (const m of integrantes) {
    if (!m.userId) continue;
    const set = integrantesPorComite.get(m.planId) ?? new Set<string>();
    set.add(m.userId);
    integrantesPorComite.set(m.planId, set);
  }
  const tamanoComite = new Map(comites.map((c) => [c, integrantes.filter((m) => m.planId === c).length]));

  // Personas distintas con asistencia, por actividad y por trimestre.
  const asistentesAnual = new Map<string, Set<string>>();
  const asistentesTrim = new Map<string, Set<string>>();
  const integrantesDe = new Map(actividades.map((a) => [a.id, a.audienceCommitteePlanId ? integrantesPorComite.get(a.audienceCommitteePlanId) ?? new Set<string>() : null]));
  for (const r of asistencias) {
    const soloComite = integrantesDe.get(r.activityId);
    if (soloComite && !soloComite.has(r.userId)) continue;
    (asistentesAnual.get(r.activityId) ?? asistentesAnual.set(r.activityId, new Set()).get(r.activityId)!).add(r.userId);
    const k = `${r.activityId}:${r.trimestre}`;
    (asistentesTrim.get(k) ?? asistentesTrim.set(k, new Set()).get(k)!).add(r.userId);
  }
  const primeraJornada = new Map<string, Date>();
  for (const s of sesiones) if (!primeraJornada.has(s.activityId)) primeraJornada.set(s.activityId, s.startsAt);

  const ventanas = TRIMESTRES.map((t) => rangoTrimestre(plan.year, t));

  const metricas: MedicionActividad[] = actividades.map((a) => {
    let ciclo: CicloActividad | null = null;
    const cicloPorTrimestre: Record<number, CicloActividad | null> = { 1: null, 2: null, 3: null, 4: null };

    if (a.courseId && a.reportSnapshot) {
      // Jornada cerrada con acta: el informe congelado es la fuente, es justo
      // lo que se firmó y no cambia si después se toca un intento. No guarda
      // fechas por persona, así que vale igual en cada trimestre programado.
      const personas = (a.reportSnapshot as unknown as ActivityReportData).personas ?? [];
      ciclo = cicloDe(personas);
      for (const t of TRIMESTRES) cicloPorTrimestre[t] = a.quarters.includes(t) ? ciclo : null;
    } else if (a.courseId) {
      // En vivo (jornada abierta, o cerrada antes de que existiera el acta):
      // mejor intento por persona; por trimestre, según la fecha del intento.
      const intentos = intentosPorQuiz.get(quizPorCurso.get(a.courseId) ?? "") ?? [];
      ciclo = cicloDe(personasDe(intentos));
      for (const t of TRIMESTRES) cicloPorTrimestre[t] = cicloDe(personasDe(intentos, ventanas[t - 1]));
    }

    const asistentesPorTrimestre: Record<number, number> = {};
    for (const t of TRIMESTRES) asistentesPorTrimestre[t] = asistentesTrim.get(`${a.id}:${t}`)?.size ?? 0;

    return {
      activityId: a.id,
      titulo: a.title,
      areaId: a.area?.id ?? "sin-area",
      areaNombre: a.area?.name ?? "Sin área",
      programa: a.programa,
      quarters: a.quarters,
      estado: a.closedAt ? "cerrada" : a.status === "OPEN" || a.enabledAt ? "abierta" : "borrador",
      cerradaEl: a.closedAt,
      jornada: primeraJornada.get(a.id) ?? null,
      conContenido: conEvaluacion.has(a.id),
      audiencia: a.audienceCommitteePlanId ? (tamanoComite.get(a.audienceCommitteePlanId) ?? 0) : (conteosAudiencia.get(a.targetAudience) ?? 0),
      asistentes: asistentesAnual.get(a.id)?.size ?? 0,
      asistentesPorTrimestre,
      ciclo,
      cicloPorTrimestre,
      preliminar: a.closedAt === null,
    };
  });

  const porArea = [...new Map(metricas.map((m) => [m.areaId, m])).keys()]
    .map((areaId) => {
      const suyas = metricas.filter((m) => m.areaId === areaId);
      return { areaId, areaNombre: suyas[0].areaNombre, ...agregar(suyas), porTrimestre: serie(suyas) };
    })
    .sort((a, b) => a.areaNombre.localeCompare(b.areaNombre, "es"));

  return {
    planTitulo: plan.title,
    anual: agregar(metricas),
    porTrimestre: serie(metricas),
    porArea,
    actividades: metricas,
  };
}
