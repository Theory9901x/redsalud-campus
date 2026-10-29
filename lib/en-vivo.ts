import type { CourseAudience, PlanKind, TrainingModality, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/audit";
import { esPrueba } from "@/lib/pruebas";

/**
 * CAPACITACIONES EN VIVO: las llamadas vigentes de toda la institución, para
 * que nadie dependa de que le reenvíen el enlace o el QR, y para que con dos
 * o más jornadas a la vez cada quien entre a la suya sin enredarse.
 *
 * "En vivo" = una jornada agendada cuya franja incluye este momento (con un
 * margen para entrar antes y para la que se alarga), o una sala con gente
 * conectada en los últimos minutos aunque la jornada no tenga hora (los
 * tramos de conexión se registran al salir y cada 5 minutos).
 * Lo que se llame "prueba" solo lo ve el rol ADMIN (lib/pruebas).
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
const VIDA_REUNION = 24 * 60 * MIN; // una reunión sigue en vivo hasta 24 h después de su inicio


/**
 * Cierra las reuniones que llevan más de 24 h abiertas desde su inicio y que
 * nadie cerró a mano. Una sala con gente conectada en los últimos minutos no
 * se toca: el cierre automático nunca saca a nadie de una llamada en curso.
 */
export async function cerrarReunionesVencidas() {
  const ahora = new Date();
  const vencidas = await prisma.trainingActivity.findMany({
    where: {
      status: { not: "CLOSED" },
      plan: { kind: "REUNION" },
      sessions: { some: { startsAt: { lt: new Date(ahora.getTime() - VIDA_REUNION) } }, none: { startsAt: { gte: new Date(ahora.getTime() - VIDA_REUNION) } } },
      callConnections: { none: { createdAt: { gte: new Date(ahora.getTime() - RECIENTE) } } },
    },
    select: { id: true, title: true },
  });
  if (!vencidas.length) return;
  const ids = vencidas.map((a) => a.id);
  await prisma.$transaction([
    prisma.trainingActivity.updateMany({ where: { id: { in: ids }, status: { not: "CLOSED" } }, data: { status: "CLOSED", closedAt: ahora } }),
    prisma.trainingSession.updateMany({ where: { activityId: { in: ids }, status: { not: "CLOSED" } }, data: { status: "CLOSED", fase: "CERRADA", cerradaEl: ahora } }),
  ]);
  await Promise.all(vencidas.map((a) => registrarAuditoria({ action: "UPDATE", entity: "TrainingActivity", entityId: a.id, description: `Reunión cerrada automáticamente: más de 24 h abierta (${a.title})` }).catch(() => {})));
}

export async function getCapacitacionesEnVivo(opciones: { verPruebas: boolean; viewer?: { id: string; role: Role } }): Promise<CapacitacionEnVivo[]> {
  await cerrarReunionesVencidas().catch((e) => console.error("No se pudieron cerrar las reuniones vencidas", e));
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
    // Las reuniones no tienen público: se entra por enlace o QR. Al estudiante
    // solo le aparece la reunión en la que ya estuvo, para que pueda volver.
    ...(estudiante ? {
      targetAudience: { in: [estudiante.personnelType, "AMBOS" as const] }, status: "OPEN" as const,
      OR: [{ plan: { kind: { not: "REUNION" as const } } }, { callConnections: { some: { userId: opciones.viewer!.id } } }],
    } : {}),
    plan: { status: "ACTIVE" as const, ...(estudiante ? { OR: [{ targetDepartment: null }, ...(estudiante.department ? [{ targetDepartment: { equals: estudiante.department, mode: "insensitive" as const } }] : [])] } : {}) },
  };

  const [jornadas, tramosRecientes] = await Promise.all([
    prisma.trainingSession.findMany({
      where: {
        status: { not: "CLOSED" },
        startsAt: { gte: new Date(ahora.getTime() - VIDA_REUNION), lte: new Date(ahora.getTime() + HORIZONTE) },
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
    const enVivo = ahora.getTime() >= j.startsAt.getTime() - ANTES &&
      (j.activity.plan.kind === "REUNION" ? ahora.getTime() <= j.startsAt.getTime() + VIDA_REUNION : ahora.getTime() <= fin.getTime() + DESPUES);
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
