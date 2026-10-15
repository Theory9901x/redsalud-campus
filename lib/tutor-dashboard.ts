import { prisma } from "@/lib/prisma";
import { getActivityAdherence, filtroTrimestre, rangoTrimestre, trimestreActual } from "@/lib/training-plans";
import { getCapacitacionesEnVivo } from "@/lib/en-vivo";
import { cicloEsAutomatico, momentoActivo, type MomentoEvaluacion } from "@/lib/presaber-postsaber";
import type { TrainingModality } from "@prisma/client";

/*
 * CENTRO DE MANDO DEL TUTOR (/tutor). Solo LECTURA y solo lo suyo:
 *
 *   - capacitaciones del Plan Institucional del año en curso cuya ÁREA
 *     responde este tutor (TrainingArea.tutorId), o de un plan que él mismo
 *     responde (TrainingPlan.tutorId) -el mismo alcance que ve en
 *     /tutor/planes-capacitacion/[id]-;
 *   - cursos que dicta (Course.tutorId).
 *
 * Las consultas están acotadas a esos ids: nada recorre la institución
 * entera salvo getCapacitacionesEnVivo, que ya trae solo la franja vigente y
 * aquí se filtra a sus capacitaciones.
 */

const MIN = 60_000;
const DIA = 24 * 60 * MIN;
const SEMANAS = 12;
const SIN_FIN = 3 * 60 * MIN; // jornada sin hora de fin: tres horas (mismo criterio de lib/en-vivo)

export type TonoAccion = "vivo" | "critico" | "atencion" | "info" | "listo";

export type EntradaAccion = {
  titulo: string;
  detalle: string;
  href: string;
  /** Enlace secundario (sala, PDF): <a> normal, no navegación del router. */
  extra?: { etiqueta: string; href: string };
};

export type GrupoAccion = {
  clave: string;
  tono: TonoAccion;
  sello: string;
  titulo: string;
  bajada: string;
  cta: string;
  entradas: EntradaAccion[];
};

export type EventoFeed = {
  tipo: "asistencia" | "evaluacion" | "inscripcion" | "finalizacion" | "constancia";
  at: Date;
  quien: string;
  texto: string;
  dato?: string;
  positivo?: boolean;
};

/** "hace 5 min" / "hace 3 h" / "hace 2 d": se calcula en el servidor, nunca en el cliente. */
export function hace(fecha: Date, ahora: Date) {
  const min = Math.max(0, Math.round((ahora.getTime() - fecha.getTime()) / MIN));
  if (min < 1) return "justo ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d < 30 ? `hace ${d} d` : `hace ${Math.round(d / 30)} mes${Math.round(d / 30) === 1 ? "" : "es"}`;
}

/** Medianoche de hoy en Colombia (UTC-5 fijo, sin horario de verano). */
function inicioDelDiaBogota(ahora: Date) {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(ahora);
  return new Date(`${ymd}T00:00:00-05:00`);
}

const rutaActividad = (planId: string, activityId: string, t?: number) =>
  `/tutor/planes-capacitacion/${planId}/actividades/${activityId}${t ? `?t=${t}` : ""}`;

export async function getTutorCommandCenter(tutorId: string, ahora = new Date()) {
  const { anio, trimestre } = trimestreActual(ahora);
  const rango = rangoTrimestre(anio, trimestre);
  const hoy0 = inicioDelDiaBogota(ahora);
  const manana0 = new Date(hoy0.getTime() + DIA);
  const enUnaSemana = new Date(hoy0.getTime() + 8 * DIA);
  const desdeSerie = new Date(hoy0.getTime() - (SEMANAS * 7 - 1) * DIA);

  const [areas, actividades, cursos] = await Promise.all([
    prisma.trainingArea.findMany({ where: { tutorId }, select: { id: true, name: true }, orderBy: { sortOrder: "asc" } }),
    prisma.trainingActivity.findMany({
      where: {
        plan: { kind: "CAPACITACION", year: anio },
        OR: [{ area: { tutorId } }, { plan: { tutorId } }],
      },
      orderBy: { title: "asc" },
      select: {
        id: true,
        title: true,
        planId: true,
        status: true,
        quarters: true,
        courseId: true,
        type: true,
        modality: true,
        programa: true,
        targetAudience: true,
        audienceCommitteePlanId: true,
        closedAt: true,
        reportSnapshotAt: true,
        presaberOpenedAt: true,
        presaberClosedAt: true,
        postsaberOpenedAt: true,
        postsaberClosedAt: true,
        area: { select: { id: true, name: true } },
        plan: { select: { id: true, title: true, year: true, targetDepartment: true, kind: true } },
        course: {
          select: { id: true, title: true, quizzes: { where: { moduleId: null, isActive: true }, select: { id: true, passingScore: true }, take: 1 } },
        },
        sessions: {
          orderBy: { startsAt: "asc" },
          select: { id: true, startsAt: true, endsAt: true, status: true, modality: true, location: true, meetingUrl: true },
        },
      },
    }),
    prisma.course.findMany({
      where: { tutorId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        modules: { select: { _count: { select: { lessons: true } } } },
        _count: { select: { certificates: true } },
        trainingActivities: { select: { id: true }, take: 1 },
      },
    }),
  ]);

  const ids = actividades.map((a) => a.id);
  const delTrimestre = actividades.filter((a) => a.quarters.includes(trimestre));
  const enRango = (f: Date, r: { desde: Date; hasta: Date }) => f >= r.desde && f < r.hasta;
  const jornadasDelTrimestre = (a: (typeof actividades)[number]) => a.sessions.filter((s) => enRango(s.startsAt, rango));
  const quizPorActividad = new Map(actividades.flatMap((a) => (a.course?.quizzes[0] ? [[a.id, a.course.quizzes[0]] as const] : [])));
  const quizIds = [...quizPorActividad.values()].map((q) => q.id);
  const courseIds = cursos.map((c) => c.id);

  // ── Todo lo que depende de los ids, en paralelo ──
  const [
    adherencias,
    asistentesTrimestre,
    asistentesPorTrimestre,
    presentandoAhora,
    terminadosTrimestre,
    serieAsistencia,
    serieEvaluaciones,
    enVivoInstitucional,
    feedAsistencia,
    feedEvaluaciones,
    estadoInscripciones,
    estancados,
    feedInscripciones,
    feedFinalizaciones,
    feedConstancias,
    constanciasMes,
  ] = await Promise.all([
    Promise.all(
      delTrimestre.map(async (a) => ({
        id: a.id,
        ...(await getActivityAdherence(
          {
            id: a.id,
            courseId: a.courseId,
            targetAudience: a.targetAudience,
            plan: { id: a.plan.id, targetDepartment: a.plan.targetDepartment, kind: a.plan.kind },
            audienceCommitteePlanId: a.audienceCommitteePlanId,
          },
          filtroTrimestre(anio, trimestre)
        )),
      }))
    ),
    delTrimestre.length
      ? prisma.trainingAttendance.groupBy({ by: ["userId"], where: { activityId: { in: delTrimestre.map((a) => a.id) }, attended: true, trimestre } })
      : Promise.resolve([]),
    ids.length
      ? prisma.trainingAttendance.groupBy({ by: ["trimestre", "userId"], where: { activityId: { in: ids }, attended: true, trimestre: { gte: 1, lte: 4 } } })
      : Promise.resolve([]),
    quizIds.length
      ? prisma.quizAttempt.groupBy({ by: ["quizId", "userId"], where: { quizId: { in: quizIds }, finishedAt: null, startedAt: { gte: new Date(ahora.getTime() - 2 * 60 * MIN) } } })
      : Promise.resolve([]),
    quizIds.length
      ? prisma.quizAttempt.groupBy({ by: ["quizId", "userId"], where: { quizId: { in: quizIds }, finishedAt: { gte: rango.desde, lt: rango.hasta }, score: { not: null } } })
      : Promise.resolve([]),
    ids.length
      ? prisma.trainingAttendance.findMany({ where: { activityId: { in: ids }, attended: true, registeredAt: { gte: desdeSerie } }, select: { registeredAt: true } })
      : Promise.resolve([]),
    quizIds.length
      ? prisma.quizAttempt.findMany({ where: { quizId: { in: quizIds }, finishedAt: { gte: desdeSerie } }, select: { finishedAt: true } })
      : Promise.resolve([]),
    ids.length ? getCapacitacionesEnVivo({ verPruebas: true }) : Promise.resolve([]),
    ids.length
      ? prisma.trainingAttendance.findMany({
          where: { activityId: { in: ids }, attended: true },
          orderBy: { registeredAt: "desc" },
          take: 8,
          select: { registeredAt: true, source: true, user: { select: { fullName: true } }, activity: { select: { title: true } } },
        })
      : Promise.resolve([]),
    quizIds.length
      ? prisma.quizAttempt.findMany({
          where: { quizId: { in: quizIds }, finishedAt: { not: null }, score: { not: null } },
          orderBy: { finishedAt: "desc" },
          take: 8,
          select: { finishedAt: true, score: true, passed: true, moment: true, user: { select: { fullName: true } }, quiz: { select: { course: { select: { title: true } } } } },
        })
      : Promise.resolve([]),
    courseIds.length ? prisma.enrollment.groupBy({ by: ["courseId", "status"], where: { courseId: { in: courseIds } }, _count: { _all: true } }) : Promise.resolve([]),
    courseIds.length
      ? prisma.enrollment.groupBy({
          by: ["courseId"],
          where: { courseId: { in: courseIds }, status: "ACTIVE", progressPercentage: 0, enrolledAt: { lte: new Date(ahora.getTime() - 7 * DIA) } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    courseIds.length
      ? prisma.enrollment.findMany({
          where: { courseId: { in: courseIds } },
          orderBy: { enrolledAt: "desc" },
          take: 6,
          select: { enrolledAt: true, user: { select: { fullName: true } }, course: { select: { title: true } } },
        })
      : Promise.resolve([]),
    courseIds.length
      ? prisma.enrollment.findMany({
          where: { courseId: { in: courseIds }, completedAt: { not: null } },
          orderBy: { completedAt: "desc" },
          take: 6,
          select: { completedAt: true, user: { select: { fullName: true } }, course: { select: { title: true } } },
        })
      : Promise.resolve([]),
    courseIds.length
      ? prisma.certificate.findMany({
          where: { courseId: { in: courseIds } },
          orderBy: { issuedAt: "desc" },
          take: 6,
          select: { issuedAt: true, user: { select: { fullName: true } }, course: { select: { title: true } } },
        })
      : Promise.resolve([]),
    courseIds.length
      ? prisma.certificate.count({ where: { courseId: { in: courseIds }, issuedAt: { gte: new Date(`${hoy0.toISOString().slice(0, 7)}-01T00:00:00-05:00`) } } })
      : Promise.resolve(0),
  ]);

  // ── Adherencia del trimestre, por capacitación ──
  const adherenciaPorId = new Map(adherencias.map((a) => [a.id, a]));
  const conAudiencia = adherencias.filter((a) => a.totalExpected > 0);
  const adherenciaPromedio = conAudiencia.length
    ? Math.round(conAudiencia.reduce((s, a) => s + a.percentage, 0) / conAudiencia.length)
    : null;

  const filasAdherencia = delTrimestre
    .map((a) => {
      const ad = adherenciaPorId.get(a.id)!;
      const jornadas = jornadasDelTrimestre(a);
      return {
        id: a.id,
        titulo: a.title,
        area: a.area?.name ?? null,
        programa: a.programa,
        estado: a.status,
        href: rutaActividad(a.planId, a.id, trimestre),
        fuente: ad.source,
        esperados: ad.totalExpected,
        cumplen: ad.adherentCount,
        porcentaje: ad.totalExpected > 0 ? ad.percentage : null,
        jornada: jornadas[0]?.startsAt ?? null,
        jornadas: jornadas.length,
        curso: a.course?.title ?? null,
      };
    })
    .sort((x, y) => (x.porcentaje ?? 101) - (y.porcentaje ?? 101) || x.titulo.localeCompare(y.titulo, "es"));

  // ── Ventanas de evaluación abiertas (solo capacitaciones ABIERTAS con evaluación final) ──
  const presentandoPorQuiz = new Map<string, number>();
  for (const p of presentandoAhora) presentandoPorQuiz.set(p.quizId, (presentandoPorQuiz.get(p.quizId) ?? 0) + 1);
  const terminaronPorQuiz = new Map<string, number>();
  for (const p of terminadosTrimestre) terminaronPorQuiz.set(p.quizId, (terminaronPorQuiz.get(p.quizId) ?? 0) + 1);

  const evaluaciones = actividades.flatMap((a) => {
    const quiz = quizPorActividad.get(a.id);
    if (a.status !== "OPEN" || !quiz) return [];
    const automatico = cicloEsAutomatico(a);
    const momento: MomentoEvaluacion | null = automatico ? null : momentoActivo(a);
    if (!automatico && !momento) return [];
    return [
      {
        id: a.id,
        titulo: a.title,
        area: a.area?.name ?? null,
        href: rutaActividad(a.planId, a.id, a.quarters.includes(trimestre) ? trimestre : undefined),
        automatico,
        momento,
        presentando: presentandoPorQuiz.get(quiz.id) ?? 0,
        terminaron: terminaronPorQuiz.get(quiz.id) ?? 0,
      },
    ];
  });

  // ── Agenda: jornadas de hoy y de los próximos 7 días (y las que siguen en curso) ──
  const agenda = actividades
    .flatMap((a) =>
      a.sessions
        .filter((s) => {
          const fin = s.endsAt ?? new Date(s.startsAt.getTime() + SIN_FIN);
          return s.status !== "CLOSED" && fin >= ahora && s.startsAt < enUnaSemana;
        })
        .map((s) => {
          const fin = s.endsAt ?? new Date(s.startsAt.getTime() + SIN_FIN);
          return {
            id: s.id,
            activityId: a.id,
            planId: a.planId,
            titulo: a.title,
            area: a.area?.name ?? null,
            inicio: s.startsAt,
            fin: s.endsAt,
            modalidad: s.modality as TrainingModality,
            lugar: s.location,
            enCurso: s.startsAt <= ahora && fin >= ahora,
            hoy: s.startsAt < manana0,
            hrefSesion: `/tutor/planes-capacitacion/${a.planId}/actividades/${a.id}/sesion/${s.id}`,
            hrefSala: `/c/${a.id}/meet`,
            hrefPanel: `/tutor/planes-capacitacion/${a.planId}/actividades/${a.id}/en-vivo`,
          };
        })
    )
    .sort((x, y) => x.inicio.getTime() - y.inicio.getTime());

  // ── En vivo: lo institucional vigente, filtrado a sus capacitaciones ──
  const misIds = new Set(ids);
  const planDe = new Map(actividades.map((a) => [a.id, a.planId]));
  const enVivo = enVivoInstitucional
    .filter((c) => misIds.has(c.id))
    .map((c) => ({ ...c, hrefPanel: `/tutor/planes-capacitacion/${planDe.get(c.id)}/actividades/${c.id}/en-vivo` }));
  const enVivoAhora = enVivoInstitucional.filter((c) => c.estado === "EN_VIVO").length;

  // ── Cola de acción: lo que hay que hacer, en orden de urgencia ──
  const cola: GrupoAccion[] = [];
  const vivas = enVivo.filter((c) => c.estado === "EN_VIVO");
  if (vivas.length) {
    cola.push({
      clave: "vivo",
      tono: "vivo",
      sello: "En vivo",
      titulo: vivas.length === 1 ? "Una jornada tuya está en vivo" : `${vivas.length} jornadas tuyas están en vivo`,
      bajada: "Sala abierta ahora. Entra o sigue la asistencia desde el panel en vivo.",
      cta: "Panel en vivo",
      entradas: vivas.map((c) => ({
        titulo: c.titulo,
        detalle: `${c.conectados} ${c.conectados === 1 ? "persona conectada" : "personas conectadas"}${c.area ? ` · ${c.area}` : ""}`,
        href: c.hrefPanel,
        extra: { etiqueta: "Entrar a la sala", href: c.enlace },
      })),
    });
  }
  const hoyPendientes = agenda.filter((s) => s.hoy && !vivas.some((v) => v.id === s.activityId));
  if (hoyPendientes.length) {
    cola.push({
      clave: "hoy",
      tono: "critico",
      sello: "Hoy",
      titulo: hoyPendientes.length === 1 ? "Tienes una jornada hoy" : `Tienes ${hoyPendientes.length} jornadas hoy`,
      bajada: "Revisa la sala, el QR y la lista antes de empezar.",
      cta: "Preparar jornada",
      entradas: hoyPendientes.map((s) => ({
        titulo: s.titulo,
        detalle: s.lugar ?? (s.modalidad === "PRESENCIAL" ? "Presencial" : "Sala virtual"),
        href: s.hrefSesion,
        extra: s.modalidad !== "PRESENCIAL" ? { etiqueta: "Sala", href: s.hrefSala } : undefined,
      })),
    });
  }
  const sinJornada = delTrimestre.filter((a) => a.status !== "CLOSED" && jornadasDelTrimestre(a).length === 0);
  if (sinJornada.length) {
    const diasRestantes = Math.max(0, Math.ceil((rango.hasta.getTime() - ahora.getTime()) / DIA));
    cola.push({
      clave: "agendar",
      tono: "atencion",
      sello: "Por agendar",
      titulo: `${sinJornada.length} ${sinJornada.length === 1 ? "capacitación" : "capacitaciones"} del trimestre sin jornada`,
      bajada: `Quedan ${diasRestantes} días del trimestre. Sin jornada no hay sala, QR ni asistencia.`,
      cta: "Agendar",
      entradas: sinJornada.map((a) => ({
        titulo: a.title,
        detalle: [a.area?.name, a.course ? "Con curso" : "Sin curso vinculado"].filter(Boolean).join(" · "),
        href: rutaActividad(a.planId, a.id, trimestre),
      })),
    });
  }
  const ventanasManuales = evaluaciones.filter((e) => !e.automatico);
  if (ventanasManuales.length) {
    cola.push({
      clave: "ventanas",
      tono: "info",
      sello: "Evaluación abierta",
      titulo: `${ventanasManuales.length} ${ventanasManuales.length === 1 ? "ventana abierta" : "ventanas abiertas"} de presaber/postsaber`,
      bajada: "Ciérrala cuando termine la jornada para pasar al siguiente momento.",
      cta: "Ver ficha",
      entradas: ventanasManuales.map((e) => ({
        titulo: e.titulo,
        detalle: `${e.momento === "POSTSABER" ? "Postsaber" : "Presaber"} · ${e.presentando} presentando · ${e.terminaron} terminaron en el trimestre`,
        href: e.href,
      })),
    });
  }
  const semana = agenda.filter((s) => !s.hoy);
  if (semana.length) {
    cola.push({
      clave: "semana",
      tono: "info",
      sello: "Esta semana",
      titulo: `${semana.length} ${semana.length === 1 ? "jornada" : "jornadas"} en los próximos 7 días`,
      bajada: "Comparte el enlace o el QR con anticipación.",
      cta: "Abrir",
      entradas: semana.map((s) => ({ titulo: s.titulo, detalle: s.lugar ?? (s.modalidad === "PRESENCIAL" ? "Presencial" : "Sala virtual"), href: s.hrefSesion })),
    });
  }
  const sinCurso = delTrimestre.filter((a) => a.status !== "CLOSED" && !a.courseId);
  if (sinCurso.length) {
    cola.push({
      clave: "sin-curso",
      tono: "atencion",
      sello: "Sin curso",
      titulo: `${sinCurso.length} ${sinCurso.length === 1 ? "capacitación" : "capacitaciones"} del trimestre sin curso vinculado`,
      bajada: "Sin curso no hay presaber ni postsaber: la adherencia sale solo de la asistencia registrada.",
      cta: "Vincular",
      entradas: sinCurso.map((a) => ({ titulo: a.title, detalle: a.area?.name ?? "Capacitación del plan", href: rutaActividad(a.planId, a.id, trimestre) })),
    });
  }
  const cerradas = actividades
    .filter((a) => a.status === "CLOSED")
    .sort((x, y) => (y.closedAt?.getTime() ?? 0) - (x.closedAt?.getTime() ?? 0));
  if (cerradas.length) {
    cola.push({
      clave: "informes",
      tono: "listo",
      sello: "Informe listo",
      titulo: `${cerradas.length} ${cerradas.length === 1 ? "informe disponible" : "informes disponibles"}`,
      bajada: "Capacitaciones cerradas: su informe está congelado y listo para radicar.",
      cta: "Abrir",
      entradas: cerradas.map((a) => ({
        titulo: a.title,
        detalle: a.closedAt ? `Cerrada ${hace(a.closedAt, ahora)}` : "Cerrada",
        href: rutaActividad(a.planId, a.id),
        extra: { etiqueta: "PDF", href: `/api/planes-capacitacion/actividades/${a.id}/informe` },
      })),
    });
  }

  // ── Cursos que dicta ──
  const conteoInscripciones = new Map<string, Record<string, number>>();
  for (const g of estadoInscripciones) {
    const m = conteoInscripciones.get(g.courseId) ?? {};
    m[g.status] = g._count._all;
    conteoInscripciones.set(g.courseId, m);
  }
  const estancadosPor = new Map(estancados.map((e) => [e.courseId, e._count._all]));
  const filasCursos = cursos.map((c) => {
    const m = conteoInscripciones.get(c.id) ?? {};
    const activos = m.ACTIVE ?? 0;
    const completados = m.COMPLETED ?? 0;
    const reprobados = m.FAILED ?? 0;
    const inscritos = activos + completados + reprobados;
    const lecciones = c.modules.reduce((s, mo) => s + mo._count.lessons, 0);
    return {
      id: c.id,
      titulo: c.title,
      estado: c.status,
      inscritos,
      activos,
      completados,
      finalizacion: inscritos > 0 ? Math.round((completados / inscritos) * 100) : null,
      constancias: c._count.certificates,
      modulos: c.modules.length,
      lecciones,
      estancados: estancadosPor.get(c.id) ?? 0,
      delPlan: c.trainingActivities.length > 0,
    };
  });
  const atencionCursos = filasCursos.flatMap((c) => [
    ...(c.lecciones === 0 ? [{ titulo: c.titulo, detalle: c.modulos === 0 ? "Sin módulos ni lecciones" : "Módulos sin lecciones", href: `/tutor/cursos/${c.id}` }] : []),
    ...(c.estancados > 0
      ? [{ titulo: c.titulo, detalle: `${c.estancados} ${c.estancados === 1 ? "inscrito sin avanzar" : "inscritos sin avanzar"} hace más de 7 días`, href: `/tutor/inscritos?curso=${c.id}&estado=estancados` }]
      : []),
  ]);
  if (atencionCursos.length) {
    cola.push({
      clave: "cursos",
      tono: "atencion",
      sello: "Cursos",
      titulo: `${atencionCursos.length} ${atencionCursos.length === 1 ? "alerta" : "alertas"} en tus cursos`,
      bajada: "Contenido incompleto o personas inscritas que no han empezado.",
      cta: "Revisar",
      entradas: atencionCursos,
    });
  }

  // ── Por trimestre ──
  const personasPorT = [0, 0, 0, 0];
  for (const g of asistentesPorTrimestre) personasPorT[g.trimestre - 1]++;
  const porTrimestre = [1, 2, 3, 4].map((t) => {
    const r = rangoTrimestre(anio, t);
    const lista = actividades.filter((a) => a.quarters.includes(t));
    const conJornada = lista.filter((a) => a.sessions.some((s) => enRango(s.startsAt, r))).length;
    return {
      t,
      programadas: lista.length,
      conJornada,
      cerradas: lista.filter((a) => a.status === "CLOSED").length,
      /** Abiertas o en borrador que YA tienen jornada en ese trimestre (no se cruza con las cerradas). */
      jornadaSinCerrar: lista.filter((a) => a.status !== "CLOSED" && a.sessions.some((s) => enRango(s.startsAt, r))).length,
      personas: personasPorT[t - 1],
      estado: t < trimestre ? ("pasado" as const) : t === trimestre ? ("actual" as const) : ("futuro" as const),
    };
  });

  // ── Pulso semanal (12 semanas): asistencias registradas y evaluaciones presentadas ──
  const semanas = Array.from({ length: SEMANAS }, (_, i) => {
    const desde = new Date(desdeSerie.getTime() + i * 7 * DIA);
    return { desde, asistencias: 0, evaluaciones: 0 };
  });
  const cubeta = (f: Date) => Math.floor((f.getTime() - desdeSerie.getTime()) / (7 * DIA));
  for (const r of serieAsistencia) {
    const i = cubeta(r.registeredAt);
    if (i >= 0 && i < SEMANAS) semanas[i].asistencias++;
  }
  for (const r of serieEvaluaciones) {
    const i = r.finishedAt ? cubeta(r.finishedAt) : -1;
    if (i >= 0 && i < SEMANAS) semanas[i].evaluaciones++;
  }

  // ── Actividad reciente ──
  const feed: EventoFeed[] = [
    ...feedAsistencia.map((r) => ({
      tipo: "asistencia" as const,
      at: r.registeredAt,
      quien: r.user.fullName,
      texto: `asistió a ${r.activity.title}`,
      dato: r.source === "AUTOMATIC" ? "Auto" : "Manual",
    })),
    ...feedEvaluaciones.map((r) => ({
      tipo: "evaluacion" as const,
      at: r.finishedAt!,
      quien: r.user.fullName,
      texto: `presentó ${r.moment === "POSTSABER" ? "el postsaber" : r.moment === "PRESABER" ? "el presaber" : "la evaluación"} de ${r.quiz.course.title}`,
      dato: `${r.score}%`,
      positivo: r.passed ?? false,
    })),
    ...feedInscripciones.map((r) => ({ tipo: "inscripcion" as const, at: r.enrolledAt, quien: r.user.fullName, texto: `se inscribió en ${r.course.title}` })),
    ...feedFinalizaciones.map((r) => ({ tipo: "finalizacion" as const, at: r.completedAt!, quien: r.user.fullName, texto: `completó ${r.course.title}` })),
    ...feedConstancias.map((r) => ({ tipo: "constancia" as const, at: r.issuedAt, quien: r.user.fullName, texto: `obtuvo constancia de ${r.course.title}` })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 10);

  const conJornadaTrimestre = delTrimestre.filter((a) => jornadasDelTrimestre(a).length > 0).length;

  return {
    anio,
    trimestre,
    rango,
    areas,
    planes: [...new Map(actividades.map((a) => [a.plan.id, a.plan.title])).entries()].map(([id, titulo]) => ({ id, titulo })),
    kpis: {
      aCargo: actividades.length,
      delTrimestre: delTrimestre.length,
      conJornada: conJornadaTrimestre,
      adherenciaPromedio,
      evaluacionesAbiertas: evaluaciones.length,
      asistieronTrimestre: asistentesTrimestre.length,
      cerradas: cerradas.length,
      abiertas: actividades.filter((a) => a.status === "OPEN").length,
    },
    conteoTrimestres: [1, 2, 3, 4].map((t) => actividades.filter((a) => a.quarters.includes(t)).length) as [number, number, number, number],
    porTrimestre,
    filasAdherencia,
    evaluaciones,
    agenda,
    enVivo,
    enVivoAhora,
    cola,
    semanas,
    feed,
    cursos: filasCursos,
    constanciasMes,
  };
}

export type TutorCommandCenter = Awaited<ReturnType<typeof getTutorCommandCenter>>;
