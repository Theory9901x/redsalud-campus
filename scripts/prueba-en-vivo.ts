import { prisma } from "../lib/prisma";

/**
 * Capacitación DE PRUEBA para ver el panel «En vivo». Queda marcada [PRUEBA]:
 * solo la ve el personal (admin y tutores), nunca los estudiantes, y se borra
 * con el botón de eliminar plan de prueba. Idempotente: si ya existe, solo
 * vuelve a poner su jornada en vivo (desde ahora, por 3 días).
 *
 *   npx tsx --env-file=.env scripts/prueba-en-vivo.ts
 */
const TITULO_PLAN = "[PRUEBA] Panel en vivo";

async function main() {
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN", status: "ACTIVE" }, orderBy: { createdAt: "asc" }, select: { id: true } });
  const area = await prisma.trainingArea.findFirst({ orderBy: { sortOrder: "asc" }, select: { id: true } });
  const ahora = new Date();
  const desde = new Date(ahora.getTime() - 10 * 60_000);
  const hasta = new Date(ahora.getTime() + 3 * 24 * 3600_000);

  let plan = await prisma.trainingPlan.findFirst({ where: { title: TITULO_PLAN }, select: { id: true } });
  if (!plan) {
    plan = await prisma.trainingPlan.create({
      data: { title: TITULO_PLAN, year: ahora.getFullYear(), kind: "CAPACITACION", status: "ACTIVE", tutorId: admin.id, description: "Plan de prueba del panel en vivo. Se puede eliminar." },
      select: { id: true },
    });
  }

  let actividad = await prisma.trainingActivity.findFirst({ where: { planId: plan.id }, select: { id: true } });
  if (!actividad) {
    actividad = await prisma.trainingActivity.create({
      data: {
        planId: plan.id,
        areaId: area?.id ?? null,
        title: "[PRUEBA] Humanización en la atención y trato digno",
        type: "EXTERNAL_EVENT",
        status: "OPEN",
        enabledAt: ahora,
        modality: "VIRTUAL",
        isRequired: false,
        targetAudience: "ASISTENCIAL",
        targetAudienceNote: "Médicos, enfermería y auxiliares de las IPS",
        programa: "SIAU",
        objective: "Fortalecer las competencias del personal asistencial en trato digno, comunicación asertiva y humanización del servicio.",
        responsibleLabel: "Profesional líder SIAU",
        responsibleUserId: admin.id,
        quarters: [Math.floor(ahora.getMonth() / 3) + 1],
      },
      select: { id: true },
    });
  }

  const sesion = await prisma.trainingSession.findFirst({ where: { activityId: actividad.id }, select: { id: true } });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  if (sesion) {
    await prisma.trainingSession.update({ where: { id: sesion.id }, data: { startsAt: desde, endsAt: hasta, status: "OPEN" } });
  } else {
    await prisma.trainingSession.create({
      data: { activityId: actividad.id, startsAt: desde, endsAt: hasta, modality: "VIRTUAL", status: "OPEN", meetingUrl: `${appUrl}/sala/${actividad.id}`, facilitador: "Profesional líder SIAU" },
    });
  }
  console.log(`Listo: ${TITULO_PLAN} · actividad ${actividad.id} en vivo hasta ${hasta.toISOString()}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
