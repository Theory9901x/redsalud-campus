import type { CourseAudience, TrainingModality } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SIN_PRUEBAS } from "@/lib/pruebas";
import { getStudentCycleInfo, trimestreActual } from "@/lib/training-plans";
import { cicloEsAutomatico, estadoPostsaber, estadoPresaber } from "@/lib/presaber-postsaber";
import { etiquetaDiaMes, etiquetaHora, etiquetaTrimestres, tituloLegible } from "@/components/training-plans/labels";

/**
 * AGENDA DEL ESTUDIANTE: la única fuente de «Mis capacitaciones» y de
 * «Evaluaciones». Antes cada pantalla armaba su propia lista con reglas
 * distintas (una ignoraba las ventanas manuales, otra mostraba actividades
 * ocultas y planes de prueba) y por eso decían cosas diferentes de la misma
 * capacitación.
 *
 * REGLA DE LAS 24 HORAS (pedida por la entidad): el estudiante no ve lo que ya
 * pasó. Una jornada sigue visible hasta 24 horas después de su inicio -tiempo
 * de sobra para presentar el postsaber y la encuesta- y luego desaparece de
 * sus listas. Lo cerrado sale 24 horas después del cierre. Solo es una regla
 * de LISTADO: los enlaces y códigos QR (/c/…) siguen respondiendo por sí
 * mismos, y sus resultados quedan en el historial.
 */
export const VENTANA_VISIBLE_MS = 24 * 60 * 60 * 1000;

const MIN = 60_000;
const ANTES = 30 * MIN; // se puede entrar media hora antes
const DESPUES = 15 * MIN; // la jornada se puede alargar un poco
const SIN_FIN = 3 * 60 * MIN; // jornada sin hora de fin: se asume de tres horas

/** ¿Esta jornada todavía se le muestra al estudiante? */
export function jornadaVisible(startsAt: Date, ahora = new Date()) {
  return startsAt.getTime() + VENTANA_VISIBLE_MS >= ahora.getTime();
}

export type PasoAgenda = {
  clave: "presaber" | "postsaber" | "encuesta";
  etiqueta: string;
  estado: "hecho" | "disponible" | "bloqueado";
  nota: number | null;
  /** Solo cuando está disponible: por dónde se presenta. */
  href: string | null;
  /** Texto del botón cuando está disponible. */
  accion: string | null;
};

export type MomentoAgenda = "EN_VIVO" | "FINALIZADA" | "PROXIMA" | "SIN_FECHA";

export type FilaAgenda = {
  id: string;
  titulo: string;
  area: string | null;
  programa: string | null;
  plan: string;
  planId: string;
  independiente: boolean;
  modalidad: TrainingModality;
  lugar: string | null;
  momento: MomentoAgenda;
  /** Ya formateado en el servidor (hora de Colombia). */
  dia: { dia: string; mes: string } | null;
  hora: string | null;
  /** Encabezado bajo el que se agrupa en «Próximas». */
  grupo: string | null;
  inicioMs: number | null;
  trimestres: string | null;
  /** Entrada a la sala o al contenido, cuando hay por dónde entrar ahora. */
  enlaceSala: string | null;
  pasos: PasoAgenda[];
  /** Evaluaciones y encuestas que puede presentar AHORA. */
  pendientes: number;
};

const DIA_BOGOTA = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" });
const diaClave = (f: Date) => DIA_BOGOTA.format(f);
const DIA_SEMANA = new Intl.DateTimeFormat("es-CO", { weekday: "long", timeZone: "America/Bogota" });

function grupoDe(inicio: Date, ahora: Date): string {
  const hoy = diaClave(ahora);
  const manana = diaClave(new Date(ahora.getTime() + 86_400_000));
  const clave = diaClave(inicio);
  if (clave === hoy) return "Hoy";
  if (clave === manana) return "Mañana";
  if (inicio.getTime() - ahora.getTime() <= 7 * 86_400_000) {
    return `Este ${DIA_SEMANA.format(inicio)}`;
  }
  return "Más adelante";
}

export async function getAgendaEstudiante(userId: string): Promise<FilaAgenda[]> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { department: true, personnelType: true, committeeMemberships: { select: { planId: true } } },
  });
  const audiencia: CourseAudience[] = [user.personnelType, "AMBOS"];
  const comites = new Set(user.committeeMemberships.map((m) => m.planId));

  const actividades = await prisma.trainingActivity.findMany({
    where: {
      status: { not: "DRAFT" },
      manuallyHidden: false,
      targetAudience: { in: audiencia },
      ...SIN_PRUEBAS,
      plan: {
        kind: "CAPACITACION",
        status: "ACTIVE",
        ...SIN_PRUEBAS,
        OR: [
          { targetDepartment: null },
          ...(user.department ? [{ targetDepartment: { equals: user.department, mode: "insensitive" as const } }] : []),
        ],
      },
    },
    select: {
      id: true,
      title: true,
      programa: true,
      courseId: true,
      status: true,
      closedAt: true,
      modality: true,
      quarters: true,
      audienceCommitteePlanId: true,
      presaberOpenedAt: true,
      presaberClosedAt: true,
      postsaberOpenedAt: true,
      postsaberClosedAt: true,
      area: { select: { name: true } },
      plan: { select: { id: true, title: true, year: true, isIndependent: true } },
      sessions: {
        orderBy: { startsAt: "asc" },
        select: {
          startsAt: true,
          endsAt: true,
          status: true,
          location: true,
          modality: true,
          tokenPublico: true,
          municipio: { select: { nombre: true } },
        },
      },
    },
  });

  // Dirigida a los integrantes de un comité: solo ellos la ven.
  const aplicables = actividades.filter((a) => !a.audienceCommitteePlanId || comites.has(a.audienceCommitteePlanId));
  if (aplicables.length === 0) return [];

  const courseIds = [...new Set(aplicables.map((a) => a.courseId).filter((c): c is string => !!c))];
  const [ciclo, intentos, encuestas] = await Promise.all([
    getStudentCycleInfo(courseIds, userId),
    courseIds.length
      ? prisma.quizAttempt.findMany({
          where: { userId, score: { not: null }, moment: { not: null }, finishedAt: { not: null }, quiz: { courseId: { in: courseIds }, moduleId: null } },
          select: { moment: true, score: true, quiz: { select: { courseId: true } } },
        })
      : Promise.resolve([]),
    prisma.survey.findMany({
      where: { trainingActivityId: { in: aplicables.map((a) => a.id) }, status: "PUBLISHED", isTemplate: false, targetAudience: { in: audiencia } },
      select: { slug: true, trainingActivityId: true, responses: { where: { userId, completed: true }, select: { id: true }, take: 1 } },
    }),
  ]);

  const mejorNota = new Map<string, number>();
  for (const i of intentos) {
    const clave = `${i.quiz.courseId}:${i.moment}`;
    mejorNota.set(clave, Math.max(mejorNota.get(clave) ?? 0, i.score!));
  }
  const encuestaDe = new Map<string, { slug: string; respondida: boolean }>();
  for (const e of encuestas) {
    if (!e.trainingActivityId) continue;
    const previa = encuestaDe.get(e.trainingActivityId);
    const registro = { slug: e.slug, respondida: e.responses.length > 0 };
    // Si hay varias, gana la que aún esté pendiente.
    if (!previa || (previa.respondida && !registro.respondida)) encuestaDe.set(e.trainingActivityId, registro);
  }

  const ahora = new Date();
  const { anio, trimestre } = trimestreActual(ahora);
  const filas: FilaAgenda[] = [];

  for (const a of aplicables) {
    const cerrada = a.status === "CLOSED";
    const visibles = a.sessions.filter((s) => jornadaVisible(s.startsAt, ahora));
    const enVivo = visibles.find(
      (s) =>
        s.status !== "CLOSED" &&
        ahora.getTime() >= s.startsAt.getTime() - ANTES &&
        ahora.getTime() <= (s.endsAt ?? new Date(s.startsAt.getTime() + SIN_FIN)).getTime() + DESPUES,
    );
    const reciente = [...visibles].reverse().find((s) => s.startsAt.getTime() <= ahora.getTime());
    const proxima = visibles.find((s) => s.startsAt.getTime() > ahora.getTime() && s.status !== "CLOSED");
    const sesion = enVivo ?? reciente ?? proxima ?? null;

    let momento: MomentoAgenda;
    if (enVivo) momento = "EN_VIVO";
    else if (reciente) momento = "FINALIZADA";
    else if (proxima) momento = "PROXIMA";
    else if (cerrada) {
      // Cerrada sin jornada reciente: solo las primeras 24 h tras el cierre.
      if (!a.closedAt || !jornadaVisible(a.closedAt, ahora)) continue;
      momento = "FINALIZADA";
    } else {
      // Sin jornada vigente. Sigue en la agenda solo si todavía le falta
      // programarse: este trimestre o uno posterior, y sin jornada ya hecha
      // en ese tramo (una línea del PIC puede repetirse en varios trimestres).
      if (a.plan.year < anio) continue;
      if (a.plan.year === anio && a.quarters.length > 0) {
        const ultima = a.sessions.at(-1);
        const trimestreUltima = ultima ? trimestreActual(ultima.startsAt) : null;
        const desde = trimestreUltima && trimestreUltima.anio === anio ? Math.max(trimestre, trimestreUltima.trimestre + 1) : trimestre;
        if (!a.quarters.some((q) => q >= desde)) continue;
      } else if (a.sessions.length > 0 && !a.plan.isIndependent) {
        // Sin trimestres marcados y con todas sus jornadas ya pasadas.
        continue;
      }
      momento = "SIN_FECHA";
    }

    // ---- Ciclo de evaluación de ESTA persona (misma regla que la ficha) ----
    const cyc = a.courseId ? ciclo.get(a.courseId) : undefined;
    const automatico = cicloEsAutomatico(a);
    const preHecho = !!cyc?.presaberDone;
    const postHecho = !!cyc?.postsaberDone;
    const preAbierto = !!cyc && !preHecho && !cerrada && (automatico || estadoPresaber(a) === "DISPONIBLE");
    const postAbierto = !!cyc && !postHecho && !cerrada && (automatico ? preHecho : estadoPostsaber(a) === "DISPONIBLE");
    const encuesta = encuestaDe.get(a.id) ?? null;

    // Una línea del PIC sin jornada agendada no ofrece evaluaciones: se
    // presentan en la jornada. (Las independientes sí: pueden ser a ritmo propio.)
    const ofreceEvaluar = momento !== "SIN_FECHA" || a.plan.isIndependent;

    const pasos: PasoAgenda[] = [];
    if (cyc) {
      pasos.push({
        clave: "presaber",
        etiqueta: "Presaber",
        estado: preHecho ? "hecho" : preAbierto && ofreceEvaluar ? "disponible" : "bloqueado",
        nota: mejorNota.get(`${a.courseId}:PRESABER`) ?? null,
        href: preAbierto && ofreceEvaluar ? `/c/${a.id}/presaber` : null,
        accion: "Presentar presaber",
      });
      pasos.push({
        clave: "postsaber",
        etiqueta: "Postsaber",
        estado: postHecho ? "hecho" : postAbierto && ofreceEvaluar ? "disponible" : "bloqueado",
        nota: mejorNota.get(`${a.courseId}:POSTSABER`) ?? null,
        href: postAbierto && ofreceEvaluar ? `/c/${a.id}/postsaber` : null,
        accion: "Presentar postsaber",
      });
    }
    if (encuesta) {
      const abierta = !encuesta.respondida && ofreceEvaluar;
      pasos.push({
        clave: "encuesta",
        etiqueta: "Encuesta",
        estado: encuesta.respondida ? "hecho" : abierta ? "disponible" : "bloqueado",
        nota: null,
        href: abierta ? `/e/${encuesta.slug}` : null,
        accion: "Responder encuesta",
      });
    }

    const virtual = (sesion?.modality ?? a.modality) !== "PRESENCIAL";
    const enlaceSala =
      momento === "EN_VIVO" && virtual
        ? `/c/${a.id}/meet?s=${enVivo!.tokenPublico}`
        : a.plan.isIndependent && !cerrada && momento !== "FINALIZADA"
          ? `/c/${a.id}/meet${sesion ? `?s=${sesion.tokenPublico}` : ""}`
          : null;

    filas.push({
      id: a.id,
      titulo: tituloLegible(a.title),
      area: a.area?.name ?? null,
      programa: a.programa,
      plan: a.plan.title,
      planId: a.plan.id,
      independiente: a.plan.isIndependent,
      modalidad: sesion?.modality ?? a.modality,
      lugar: sesion?.location ?? sesion?.municipio?.nombre ?? null,
      momento,
      dia: sesion ? etiquetaDiaMes(sesion.startsAt) : null,
      hora: sesion ? `${etiquetaHora(sesion.startsAt)}${sesion.endsAt ? ` – ${etiquetaHora(sesion.endsAt)}` : ""}` : null,
      grupo: momento === "PROXIMA" && sesion ? grupoDe(sesion.startsAt, ahora) : null,
      inicioMs: sesion?.startsAt.getTime() ?? null,
      trimestres: etiquetaTrimestres(a.quarters),
      enlaceSala,
      pasos,
      pendientes: pasos.filter((p) => p.estado === "disponible").length,
    });
  }

  const ORDEN: Record<MomentoAgenda, number> = { EN_VIVO: 0, FINALIZADA: 1, PROXIMA: 2, SIN_FECHA: 3 };
  return filas.sort(
    (x, y) =>
      ORDEN[x.momento] - ORDEN[y.momento] ||
      (x.inicioMs ?? Infinity) - (y.inicioMs ?? Infinity) ||
      x.titulo.localeCompare(y.titulo, "es"),
  );
}
