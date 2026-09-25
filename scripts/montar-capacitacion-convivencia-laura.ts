import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";

/**
 * CAPACITACIÓN "CONVIVENCIA LABORAL 25 SEPTIEMBRE 2026" dictada por Laura
 * Johana Moreno Pérez (Positiva), dentro del Plan Institucional 2026.
 *
 * - Crea (o actualiza) a Laura como TUTORA.
 * - Crea el área "CONVIVENCIA LABORAL" con Laura como responsable: así, en su
 *   panel, ve y gestiona SOLO esta capacitación (el acceso del tutor es por área).
 * - Si en el plan ya hay una capacitación de convivencia laboral SIN evidencia
 *   (asistencia o conexiones), la reutiliza con sus datos del PIC y la
 *   renombra; si tiene evidencia no la toca y crea una nueva.
 * - Deja la actividad ABIERTA con una jornada VIRTUAL en la sala integrada
 *   (llamada, grabación, QR, enlace y enlace de externos /invitado/{id}).
 *
 * Uso:
 *   npx tsx --env-file=.env scripts/montar-capacitacion-convivencia-laura.ts            (solo muestra)
 *   npx tsx --env-file=.env scripts/montar-capacitacion-convivencia-laura.ts --aplicar [HH:MM-HH:MM]
 */
const EMAIL = "laura.moreno@positiva.gov.co";
const USERNAME = "laura.moreno";
const DOCUMENTO = "1116797606";
const NOMBRE = "Laura Johana Moreno Perez";
const CLAVE = "Laura2026*";
const TITULO = "CONVIVENCIA LABORAL 25 SEPTIEMBRE 2026";
const FECHA = "2026-09-25";
const AREA = "CONVIVENCIA LABORAL";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

async function main() {
  const args = process.argv.slice(2);
  const aplicar = args.includes("--aplicar");
  const franja = args.find((a) => /^\d{2}:\d{2}-\d{2}:\d{2}$/.test(a)) ?? "08:00-12:00";
  const [hIni, hFin] = franja.split("-");
  // Hora de Colombia explícita: el servidor corre en UTC.
  const startsAt = new Date(`${FECHA}T${hIni}:00-05:00`);
  const endsAt = new Date(`${FECHA}T${hFin}:00-05:00`);

  const plan = await prisma.trainingPlan.findFirstOrThrow({
    where: { kind: "CAPACITACION", title: { contains: "Plan Institucional de Capacitaciones 2026", mode: "insensitive" } },
    select: { id: true, title: true },
  });
  const usuarioExistente = await prisma.user.findFirst({
    where: { OR: [{ email: EMAIL }, { username: USERNAME }, { documentNumber: DOCUMENTO }] },
    select: { id: true, email: true, role: true, fullName: true },
  });
  const areaExistente = await prisma.trainingArea.findUnique({ where: { name: AREA }, select: { id: true, tutor: { select: { fullName: true } } } });
  const existentes = await prisma.trainingActivity.findMany({
    where: { planId: plan.id, title: { contains: "convivencia", mode: "insensitive" } },
    select: {
      id: true, title: true, status: true, courseId: true, manuallyHidden: true,
      area: { select: { name: true, tutor: { select: { fullName: true } } } },
      _count: { select: { sessions: true, attendances: { where: { attended: true } }, callConnections: true } },
    },
  });

  console.log(`plan: ${plan.title} (${plan.id})`);
  console.log(`usuario: ${usuarioExistente ? `YA EXISTE ${usuarioExistente.fullName} <${usuarioExistente.email}> rol ${usuarioExistente.role}` : "no existe, se crea"}`);
  console.log(`área ${AREA}: ${areaExistente ? `existe (tutor: ${areaExistente.tutor?.fullName ?? "ninguno"})` : "no existe, se crea"}`);
  console.log(`capacitaciones de convivencia en el plan: ${existentes.length}`);
  for (const a of existentes) {
    console.log(`  - ${a.title} · ${a.status}${a.manuallyHidden ? " (oculta)" : ""} · área ${a.area?.name ?? "—"} (${a.area?.tutor?.fullName ?? "sin tutor"}) · curso ${a.courseId ? "sí" : "no"} · jornadas ${a._count.sessions} · asistencias ${a._count.attendances} · conexiones ${a._count.callConnections} · ${a.id}`);
  }
  console.log(`jornada: ${FECHA} ${hIni}–${hFin} (hora Colombia), virtual en sala integrada`);
  if (!aplicar) { console.log("\n(solo lectura: agrega --aplicar para ejecutar)"); return; }

  // 1) Laura, tutora
  const passwordHash = await bcrypt.hash(CLAVE, 10);
  const datosUsuario = {
    fullName: NOMBRE, email: EMAIL, username: USERNAME, role: "TUTOR" as const, status: "ACTIVE" as const,
    department: "POSITIVA ARL", position: "Facilitadora · Convivencia laboral", tipoVinculacion: "OTRO" as const,
    mustChangePassword: false, passwordHash,
  };
  const laura = usuarioExistente
    ? await prisma.user.update({ where: { id: usuarioExistente.id }, data: datosUsuario, select: { id: true } })
    : await prisma.user.create({ data: { ...datosUsuario, documentType: "CC", documentNumber: DOCUMENTO }, select: { id: true } });

  // 2) Área propia con Laura como responsable
  const maxOrden = await prisma.trainingArea.aggregate({ _max: { sortOrder: true } });
  const area = await prisma.trainingArea.upsert({
    where: { name: AREA },
    update: { tutorId: laura.id, isActive: true },
    create: { name: AREA, sortOrder: (maxOrden._max.sortOrder ?? 0) + 1, tutorId: laura.id },
    select: { id: true },
  });

  // 3) Actividad: reutiliza la existente sin evidencia, o crea una nueva
  const reutilizable = existentes.find((a) => a._count.attendances === 0 && a._count.callConnections === 0);
  const comun = {
    title: TITULO, areaId: area.id, responsibleUserId: laura.id, status: "OPEN" as const, enabledAt: new Date(),
    manuallyHidden: false, modality: "VIRTUAL" as const, startDate: new Date(`${FECHA}T00:00:00-05:00`),
  };
  let actividadId: string;
  if (reutilizable) {
    const previa = await prisma.trainingActivity.findUniqueOrThrow({ where: { id: reutilizable.id }, select: { quarters: true } });
    await prisma.trainingActivity.update({
      where: { id: reutilizable.id },
      data: { ...comun, quarters: previa.quarters.includes(3) ? previa.quarters : [...previa.quarters, 3].sort() },
    });
    // Jornadas previas vacías (sin asistentes) se retiran para que no compitan con la de hoy.
    const vacias = await prisma.trainingSession.deleteMany({ where: { activityId: reutilizable.id, asistencias: { none: {} } } });
    actividadId = reutilizable.id;
    console.log(`capacitación existente reutilizada y renombrada (${vacias.count} jornadas vacías retiradas)`);
  } else {
    const nueva = await prisma.trainingActivity.create({
      data: {
        ...comun, planId: plan.id, type: "EXTERNAL_EVENT", quarters: [3], targetAudience: "AMBOS", isRequired: true,
        programa: "Convivencia laboral", responsibleLabel: "Positiva ARL · Laura Johana Moreno Pérez",
        objective: "Fortalecer la convivencia laboral y la prevención del acoso laboral en Red Salud Casanare E.S.E.",
      },
      select: { id: true },
    });
    actividadId = nueva.id;
    console.log("capacitación nueva creada");
  }
  // Las que tienen evidencia no se tocan, pero se retiran de la vista para no duplicar.
  for (const a of existentes.filter((x) => x.id !== actividadId && !x.manuallyHidden)) {
    await prisma.trainingActivity.update({ where: { id: a.id }, data: { manuallyHidden: true } });
    console.log(`retirada de la vista (conserva su evidencia): ${a.title}`);
  }

  // 4) Jornada virtual en la sala integrada
  const sesion = await prisma.trainingSession.create({
    data: {
      activityId: actividadId, startsAt, endsAt, modality: "VIRTUAL", status: "OPEN",
      meetingUrl: `${APP_URL}/sala/${actividadId}`, facilitador: NOMBRE,
    },
    select: { tokenPublico: true },
  });

  console.log("\n=== LISTO ===");
  console.log(`Acceso Laura: ${APP_URL}/login · usuario ${EMAIL} (o "${USERNAME}") · contraseña ${CLAVE}`);
  console.log(`Gestión (panel de Laura): ${APP_URL}/tutor/planes-capacitacion/${plan.id}/actividades/${actividadId}`);
  console.log(`Sala (funcionarios con cuenta): ${APP_URL}/sala/${actividadId}`);
  console.log(`Externos (sin cuenta): ${APP_URL}/invitado/${actividadId}`);
  console.log(`QR de la jornada: ${APP_URL}/s/${sesion.tokenPublico}`);
}
main().finally(() => prisma.$disconnect());
