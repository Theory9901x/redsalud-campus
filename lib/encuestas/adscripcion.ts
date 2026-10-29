import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { capacitacionesParaEncuesta, encuestaSoloDeArea } from "@/lib/encuestas/adscripcion-policy";

export async function alcanceAdscripcion(user: { id: string; role: Role }) {
  const tieneArea = user.role === "ADMIN" && (await prisma.trainingArea.count({ where: { tutorId: user.id } })) > 0;
  const soloDeArea = encuestaSoloDeArea(user.role, tieneArea);
  return { soloDeArea, actividades: capacitacionesParaEncuesta(user.id, soloDeArea) };
}

/** Una encuesta de área siempre queda vinculada a una sola capacitación propia. */
export async function resolverAdscripcion(
  user: { id: string; role: Role }, actividadId: string | null, planId: string | null, actividadActual?: string | null,
): Promise<{ error: string } | { trainingActivityId: string | null; trainingPlanId: string | null }> {
  const alcance = await alcanceAdscripcion(user);
  if (alcance.soloDeArea && !actividadId) return { error: "Selecciona una capacitación concreta de tu área. La encuesta no se asigna a todo el plan." };
  if (actividadId) {
    const actividad = await prisma.trainingActivity.findFirst({
      where: { ...alcance.actividades, id: actividadId, ...(actividadId !== actividadActual ? { status: { not: "CLOSED" } } : {}) },
      select: { planId: true },
    });
    if (!actividad) return { error: "La capacitación no está disponible o no pertenece a tu área." };
    if (planId && planId !== actividad.planId) return { error: "El plan no corresponde a la capacitación seleccionada." };
    return { trainingActivityId: actividadId, trainingPlanId: actividad.planId };
  }
  if (planId) {
    const plan = await prisma.trainingPlan.findUnique({ where: { id: planId }, select: { id: true } });
    if (!plan) return { error: "El plan elegido no existe." };
  }
  return { trainingActivityId: null, trainingPlanId: planId };
}
