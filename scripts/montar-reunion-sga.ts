import { prisma } from "../lib/prisma";

/**
 * REUNIÓN ABIERTA "Sistema Global Armonizado" (martes 6 de octubre de 2026),
 * fuera del Plan de Capacitaciones y de los comités (PlanKind REUNION).
 *
 * Dos reuniones independientes -cada una con su enlace, su QR y su lista de
 * asistencia, sin mezclarse-:
 *   · Mañana 9:00–10:00 a. m. — Zona Sur y Zona Centro
 *   · Tarde 2:00–3:00 p. m.  — Zona Norte y Sede Administrativa
 *
 * Acceso abierto: el enlace /invitado/{id} pide solo nombre completo y cargo.
 * Responsable: SST y ARL Positiva. Anfitriones de la sala (moderan y graban):
 * Laura Moreno (ARL Positiva), el tutor del área de SST si existe, y la
 * administración.
 *
 *   npx tsx --env-file=.env scripts/montar-reunion-sga.ts            (solo muestra)
 *   npx tsx --env-file=.env scripts/montar-reunion-sga.ts --aplicar
 */
const TITULO = "Sistema Global Armonizado";
const FECHA = "2026-10-06";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const SESIONES = [
  { franja: "Mañana", zonas: "Zona Sur y Zona Centro", inicio: "09:00", fin: "10:00", shift: "MANANA" as const },
  { franja: "Tarde", zonas: "Zona Norte y Sede Administrativa", inicio: "14:00", fin: "15:00", shift: "TARDE" as const },
];

async function main() {
  const aplicar = process.argv.includes("--aplicar");
  const laura = await prisma.user.findUniqueOrThrow({ where: { email: "laura.moreno@positiva.gov.co" }, select: { id: true, fullName: true } });
  const areaSst = await prisma.trainingArea.findFirst({
    where: { OR: [{ name: { contains: "SST", mode: "insensitive" } }, { name: { contains: "SEGURIDAD Y SALUD", mode: "insensitive" } }] },
    select: { id: true, name: true, tutor: { select: { fullName: true } } },
  });
  const existente = await prisma.trainingPlan.findFirst({ where: { kind: "REUNION", title: TITULO }, select: { id: true, activities: { select: { id: true, title: true } } } });

  console.log(`responsable en plataforma: ${laura.fullName}`);
  console.log(`área SST: ${areaSst ? `${areaSst.name} (tutor: ${areaSst.tutor?.fullName ?? "sin tutor"})` : "no existe: la reunión queda sin área"}`);
  console.log(`reunión: ${existente ? `ya existe (${existente.activities.length} sesiones), se completa sin duplicar` : "no existe, se crea"}`);
  for (const s of SESIONES) console.log(`  · ${s.franja} ${FECHA} ${s.inicio}–${s.fin} · ${s.zonas}`);
  if (!aplicar) { console.log("\n(solo lectura: agrega --aplicar)"); return; }

  const plan = existente ?? await prisma.trainingPlan.create({
    data: {
      title: TITULO, year: 2026, kind: "REUNION", status: "ACTIVE", tutorId: laura.id,
      description: "Reunión abierta de SST y ARL Positiva. Acceso con nombre completo y cargo.",
    },
    select: { id: true, activities: { select: { id: true, title: true } } },
  });

  console.log("\n=== ENLACES ===");
  for (const s of SESIONES) {
    const titulo = `${TITULO} · ${s.franja} — ${s.zonas}`;
    let actividad = plan.activities.find((a) => a.title === titulo);
    if (!actividad) {
      actividad = await prisma.trainingActivity.create({
        data: {
          planId: plan.id, title: titulo, type: "EXTERNAL_EVENT", status: "OPEN", enabledAt: new Date(), modality: "VIRTUAL",
          isRequired: false, targetAudience: "AMBOS", targetAudienceNote: s.zonas,
          responsibleLabel: "SST y ARL Positiva", responsibleUserId: laura.id, areaId: areaSst?.id ?? null,
          programa: "Sistema Global Armonizado", startDate: new Date(`${FECHA}T00:00:00-05:00`),
        },
        select: { id: true, title: true },
      });
      await prisma.trainingSession.create({
        data: {
          activityId: actividad.id, startsAt: new Date(`${FECHA}T${s.inicio}:00-05:00`), endsAt: new Date(`${FECHA}T${s.fin}:00-05:00`),
          shift: s.shift, modality: "VIRTUAL", status: "OPEN", meetingUrl: `${APP_URL}/sala/${actividad.id}`, facilitador: "SST y ARL Positiva",
        },
      });
    }
    console.log(`\n${s.franja.toUpperCase()} (${s.inicio}–${s.fin}) · ${s.zonas}`);
    console.log(`  Enlace para todos (nombre y cargo): ${APP_URL}/invitado/${actividad.id}`);
    console.log(`  Anfitriones (con cuenta):           ${APP_URL}/sala/${actividad.id}`);
    console.log(`  Gestión y asistencia:               ${APP_URL}/admin/planes-capacitacion/${plan.id}/actividades/${actividad.id}`);
    console.log(`  ID=${actividad.id}`);
  }
}
main().finally(() => prisma.$disconnect());
