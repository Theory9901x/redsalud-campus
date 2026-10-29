"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireTutorOrAdmin, requireTrainingActivityAccess } from "@/lib/auth-helpers";
import { alcanceAdscripcion } from "@/lib/encuestas/adscripcion";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  title: z.string().trim().min(5, "Escribe un título de al menos 5 caracteres."),
  areaId: z.string().min(1, "Selecciona tu área."),
  planId: z.string().min(1, "Selecciona un plan activo."),
  objective: z.string().trim().min(10, "Describe el objetivo de la capacitación."),
  modality: z.enum(["VIRTUAL", "PRESENCIAL", "MIXTA"]),
  targetAudience: z.enum(["AMBOS", "ASISTENCIAL", "ADMINISTRATIVO"]),
  quarter: z.coerce.number().int().min(1).max(4),
});

export async function crearCapacitacionAreaAction(_prev: { error: string | null }, fd: FormData): Promise<{ error: string | null }> {
  const session = await requireTutorOrAdmin();
  if (!["ADMIN", "TUTOR"].includes(session.user.role)) return { error: "No tienes permiso de escritura." };
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  const data = parsed.data;
  const area = await prisma.trainingArea.findFirst({ where: { id: data.areaId, tutorId: session.user.id, isActive: true }, select: { id: true, name: true } });
  if (!area) return { error: "Solo puedes crear capacitaciones de tu propia área." };
  const plan = await prisma.trainingPlan.findFirst({ where: {
    id: data.planId, kind: "CAPACITACION", status: "ACTIVE",
    NOT: [{ title: { startsWith: "[PRUEBA]" } }, { title: { startsWith: "[DEMO]" } }],
    OR: [{ targetDepartment: null }, { targetDepartment: { equals: area.name, mode: "insensitive" } }],
  }, select: { id: true } });
  if (!plan) return { error: "Selecciona un plan de capacitaciones activo." };
  const actividad = await prisma.$transaction(async (tx) => {
    const created = await tx.trainingActivity.create({ data: {
      planId: plan.id, areaId: area.id, title: data.title, objective: data.objective,
      modality: data.modality, targetAudience: data.targetAudience, type: "EXTERNAL_EVENT",
      responsibleUserId: session.user.id, status: "DRAFT", isRequired: true,
      manuallyHidden: true, quarters: [data.quarter],
    }, select: { id: true } });
    await tx.auditLog.create({ data: { userId: session.user.id, action: "CREATE", entity: "TrainingActivity", entityId: created.id, description: `Capacitación creada por su área: ${data.title}` } });
    return created;
  });
  revalidatePath("/tutor/planes-capacitacion");
  revalidatePath(`/tutor/planes-capacitacion/${plan.id}`);
  redirect(`/tutor/planes-capacitacion/${plan.id}/actividades/${actividad.id}`);
}

export async function guardarAudienciaCapacitacionAction(activityId: string, _prev: { error: string | null; ok?: string }, fd: FormData): Promise<{ error: string | null; ok?: string }> {
  const { session } = await requireTrainingActivityAccess(activityId);
  if (!["ADMIN", "TUTOR"].includes(session.user.role)) return { error: "No tienes permiso de escritura." };
  const alcance = await alcanceAdscripcion(session.user);
  const activity = await prisma.trainingActivity.findFirst({ where: { ...alcance.actividades, id: activityId }, select: { planId: true, status: true, quarters: true, startDate: true, plan: { select: { status: true } } } });
  if (!activity) return { error: "Solo puedes habilitar capacitaciones de tu propia área." };
  if (activity.status === "CLOSED" || activity.plan.status !== "ACTIVE") return { error: "La capacitación o el plan no están disponibles para edición." };
  const parsed = z.enum(["ADMINISTRATIVO", "ASISTENCIAL", "AMBOS"]).safeParse(fd.get("targetAudience"));
  if (!parsed.success) return { error: "Selecciona administrativos, asistenciales o ambos." };
  const habilitar = fd.get("habilitar") === "on";
  if (habilitar && !activity.quarters.length && !activity.startDate) return { error: "Define primero el trimestre o fecha de la capacitación." };
  await prisma.$transaction([
    prisma.trainingActivity.update({ where: { id: activityId }, data: { targetAudience: parsed.data, ...(habilitar ? { status: "OPEN", manuallyHidden: false, enabledAt: new Date() } : {}) } }),
    prisma.auditLog.create({ data: { userId: session.user.id, action: "UPDATE", entity: "TrainingActivity", entityId: activityId, description: `Audiencia definida por el área: ${parsed.data}. ${habilitar ? "Capacitación habilitada." : "Audiencia guardada."}` } }),
  ]);
  for (const base of ["/tutor/planes-capacitacion", "/admin/planes-capacitacion"]) {
    revalidatePath(`${base}/${activity.planId}/actividades/${activityId}`);
    revalidatePath(`${base}/${activity.planId}`);
  }
  revalidatePath("/mis-capacitaciones");
  revalidatePath("/mis-capacitaciones/en-vivo");
  revalidatePath(`/mis-capacitaciones/${activity.planId}`);
  return { error: null, ok: habilitar ? "Capacitación habilitada para el personal seleccionado." : "Audiencia actualizada." };
}
