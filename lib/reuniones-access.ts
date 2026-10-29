import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { alcanceReuniones, puedeEscribirReuniones } from "@/lib/reuniones-policy";
import { notFound } from "next/navigation";

export async function accesoReuniones(escritura = false) {
  const session = await auth();
  if (!session?.user) throw new Error("No autorizado.");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, status: true, canManageAllMeetings: true, restrictedAdminSections: true },
  });
  if (!user || user.status !== "ACTIVE" || !["ADMIN", "TUTOR", "SEGUIMIENTO"].includes(user.role)) throw new Error("No autorizado.");
  if (user.role === "ADMIN" && user.restrictedAdminSections.includes("PLANES_CAPACITACION")) throw new Error("No autorizado.");
  if (escritura && !puedeEscribirReuniones(user)) throw new Error("Acceso de solo lectura.");
  return { session, user, where: alcanceReuniones(user) };
}

export async function requireReunionAccess(planId: string, activityId?: string, escritura = false) {
  const acceso = await accesoReuniones(escritura);
  const plan = await prisma.trainingPlan.findFirst({
    where: { ...acceso.where, id: planId, ...(activityId ? { activities: { some: { id: activityId } } } : {}) },
    select: { id: true },
  });
  if (!plan) notFound();
  return acceso.session;
}
