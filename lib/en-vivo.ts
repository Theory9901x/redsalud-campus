import type { CourseAudience, PlanKind, TrainingModality, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * CAPACITACIONES EN VIVO: las llamadas vigentes de toda la institución, para
 * que nadie dependa de que le reenvíen el enlace o el QR, y para que con dos
 * o más jornadas a la vez cada quien entre a la suya sin enredarse.
 *
 * "En vivo" = una jornada agendada cuya franja incluye este momento (con un
 * margen para entrar antes y para la que se alarga), o una sala con gente
 * conectada en los últimos minutos aunque la jornada no tenga hora (los
 * tramos de conexión se registran al salir y cada 5 minutos).
 * Lo marcado [PRUEBA] solo lo ve el personal (admin y tutores).
 */
export type CapacitacionEnVivo = {
  id: string;
  titulo: string;
  objetivo: string | null;
  area: string | null;
  programa: string | null;
  categoria: PlanKind;
  plan: string;
  publico: CourseAudience;
  publicoNota: string | null;
  modalidad: TrainingModality;
  responsable: string | null;
  inicio: Date | null;
  fin: Date | null;
  estado: "EN_VIVO" | "PROXIMA";
  conectados: number;
  enlace: string;
  prueba: boolean;
};

const MIN = 60_000;
const ANTES = 30 * MIN; // se puede entrar media hora antes
const DESPUES = 15 * MIN; // y la jornada se puede alargar un poco
const SIN_FIN = 3 * 60 * MIN; // jornada sin hora de fin: se asume de tres horas
const RECIENTE = 10 * MIN; // gente conectada hace menos de esto = sala activa
const HORIZONTE = 7 * 24 * 60 * MIN; // próximas: una semana

const esPrueba = (...textos: string[]) => textos.some((t) => /^\s*\[(PRUEBA|DEMO)\]/i.test(t));

export async function getCapacitacionesEnVivo(opciones: { verPruebas: boolean; viewer?: { id: string; role: Role } }): Promise<CapacitacionEnVivo[]> {
  const ahora = new Date();
  const seleccion = {
    id: true,
    title: true,
    objective: true,
    programa: true,
    targetAudience: true,
    targetAudienceNote: true,
    modality: true,
    responsibleLabel: true,
    area: { select: { name: true } },
    responsibleUser: { select: { fullName: true } },
    plan: { select: { title: true, kind: true } },
  } as const;
  const estudiante = opciones.viewer?.role === "STUDENT" ? await prisma.user.findUniqueOrThrow({ where: { id: opciones.viewer.id }, select: { personnelType: true, department: true } }) : null;
  const actividadVisible = {
    status: { not: "CLOSED" as const },
    manuallyHidden: false,
    ...(estudiante ? { targetAudience: { in: [estudiante.personnelType, "AMBOS" as const] }, status: "OPEN" as const } : {}),
    plan: { status: "ACTIVE" as const, ...(estudiante ? { OR: [{ targetDepartment: null }, ...(estudiante.department ? [{ targetDepartment: { equals: estudiante.department, mode: "insensitive" as const } }] : [])] } : {}) },
  };

  const [jornadas, tramosRecientes] = await Promise.all([
    prisma.trainingSession.findMany({
      where: {
        status: { not: "CLOSED" },
        startsAt: { gte: new Date(ahora.getTime() - 24 * 60 * MIN), lte: new Date(ahora.getTime() + HORIZONTE) },
        activity: actividadVisible,
      },
      orderBy: { startsAt: "asc" },
      select: { startsAt: true, endsAt: true, activity: { select: seleccion } },
    }),
    prisma.callConnectionLog.findMany({
      where: { createdAt: { gte: new Date(ahora.getTime() - RECIENTE) }, activity: actividadVisible },
      select: { activityId: true, userId: true, externalParticipantId: true, displayName: true, activity: { select: seleccion } },
    }),
  ]);

  const conectadosPor = new Map<string, Set<string>>();
  for (const t of tramosRecientes) {
    const set = conectadosPor.get(t.activityId) ?? new Set<string>();
    set.add(t.userId ?? t.externalParticipantId ?? t.displayName);
    conectadosPor.set(t.activityId, set);
  }

  type Act = (typeof jornadas)[number]["activity"];
  const armar = (a: Act, inicio: Date | null, fin: Date | null, estado: CapacitacionEnVivo["estado"]): CapacitacionEnVivo => ({
    id: a.id,
    titulo: a.title,
    objetivo: a.objective,
    area: a.area?.name ?? null,
    programa: a.programa,
    categoria: a.plan.kind,
    plan: a.plan.title,
    publico: a.targetAudience,
    publicoNota: a.targetAudienceNote,
    modalidad: a.modality,
    responsable: a.responsibleUser?.fullName ?? a.responsibleLabel,
    inicio,
    fin,
    estado,
    conectados: conectadosPor.get(a.id)?.size ?? 0,
    enlace: `/c/${a.id}/meet`,
    prueba: esPrueba(a.title, a.plan.title),
  });

  const resultado = new Map<string, CapacitacionEnVivo>();
  for (const j of jornadas) {
    const fin = j.endsAt ?? new Date(j.startsAt.getTime() + SIN_FIN);
    const enVivo = ahora.getTime() >= j.startsAt.getTime() - ANTES && ahora.getTime() <= fin.getTime() + DESPUES;
    const proxima = j.startsAt.getTime() - ANTES > ahora.getTime();
    if (!enVivo && !proxima) continue;
    const previa = resultado.get(j.activity.id);
    // Una capacitación aparece una vez: su jornada en vivo, o la más próxima.
    if (previa && (previa.estado === "EN_VIVO" || !enVivo)) continue;
    resultado.set(j.activity.id, armar(j.activity, j.startsAt, j.endsAt, enVivo ? "EN_VIVO" : "PROXIMA"));
  }
  // Salas con gente conectada aunque no haya jornada en franja.
  for (const t of tramosRecientes) {
    const previa = resultado.get(t.activityId);
    if (previa?.estado === "EN_VIVO") continue;
    resultado.set(t.activityId, armar(t.activity, previa?.inicio ?? null, previa?.fin ?? null, "EN_VIVO"));
  }

  return [...resultado.values()]
    .filter((c) => opciones.verPruebas || !c.prueba)
    .sort(
      (a, b) =>
        (a.estado === b.estado ? 0 : a.estado === "EN_VIVO" ? -1 : 1) ||
        (a.inicio?.getTime() ?? 0) - (b.inicio?.getTime() ?? 0) ||
        a.titulo.localeCompare(b.titulo, "es")
    );
}
