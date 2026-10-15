import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTrainingPlanRead, requireTutorOrAdmin } from "@/lib/auth-helpers";
import { esSoloLectura, veComoAdmin } from "@/lib/roles";

/**
 * ALCANCE de quien abre los indicadores de un plan. La regla es la del
 * módulo: el administrador (y Seguimiento, solo lectura) y el responsable
 * del plan ven lo institucional; un tutor de área ve sus áreas con las
 * mismas fórmulas. `areaIds` null = institucional.
 */
export type Alcance = {
  plan: { id: string; title: string; year: number };
  userId: string;
  institucional: boolean;
  soloLectura: boolean;
  areaIds: string[] | null;
};

export async function resolverAlcance(planId: string): Promise<Alcance> {
  const sesion = await requireTutorOrAdmin();
  const plan = await prisma.trainingPlan.findUnique({ where: { id: planId }, select: { id: true, tutorId: true, title: true, year: true } });
  if (!plan) notFound();

  const institucional = veComoAdmin(sesion.user.role) || plan.tutorId === sesion.user.id;
  if (!institucional) await requireTrainingPlanRead(planId).catch(() => null);

  const areaIds = institucional
    ? null
    : (await prisma.trainingArea.findMany({ where: { tutorId: sesion.user.id }, select: { id: true } })).map((a) => a.id);

  return {
    plan: { id: plan.id, title: plan.title, year: plan.year },
    userId: sesion.user.id,
    institucional,
    soloLectura: esSoloLectura(sesion.user.role),
    areaIds,
  };
}

/**
 * El área pedida en la URL (?area=), validada contra el alcance: un tutor
 * solo puede pedir una de las suyas. Si el tutor tiene UNA sola área y no
 * pidió ninguna, se toma la suya: su ficha es siempre la de su área.
 */
export function areaPermitida(alcance: Alcance, pedida: string | undefined): string | null {
  if (alcance.areaIds && alcance.areaIds.length === 1 && !pedida) return alcance.areaIds[0];
  if (!pedida) return null;
  if (alcance.areaIds && !alcance.areaIds.includes(pedida)) notFound();
  return pedida;
}
