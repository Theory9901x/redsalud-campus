/**
 * Siembra el Plan Institucional de Capacitaciones 2026 desde el PIC real.
 *
 * La fuente es prisma/data/pic-2026.json, extraído del Excel de Talento
 * Humano por prisma/extraer-pic.ts. No hay datos de relleno: cada actividad
 * corresponde a una fila del PIC firmado, y lo que el Excel no dice queda
 * nulo (fechas, cupos, responsable como usuario).
 *
 *   node --env-file=.env node_modules/tsx/dist/cli.mjs prisma/seed-pic-2026.ts
 *
 * Es idempotente en lo que puede serlo: las áreas se reconcilian por nombre,
 * y el plan no se vuelve a poblar si ya tiene actividades -reimportar encima
 * duplicaría el cronograma y borraría el trabajo que se le haya hecho
 * después desde la plataforma-.
 */
import type { CourseAudience, TrainingModality } from "@prisma/client";
import { prisma } from "../lib/prisma";
import pic from "./data/pic-2026.json";

const TITULO_PLAN = "Plan Institucional de Capacitaciones 2026";

/**
 * Deriva el grupo poblacional desde el "Dirigido A" del PIC.
 *
 * Es una lectura conservadora a propósito: solo se compromete cuando el
 * texto menciona exclusivamente perfiles de un lado. "Todos los
 * colaboradores", "talento humano asistencial y administrativo" o cualquier
 * mezcla caen en AMBOS. El texto original se conserva íntegro en
 * targetAudienceNote, que es mucho más preciso que este enum de tres
 * valores, y quien administre puede afinarlo desde la plataforma.
 */
function derivarAudiencia(dirigidoA: string | null): CourseAudience {
  if (!dirigidoA) return "AMBOS";
  // Sin tildes: el PIC las escribe de forma inconsistente ("enfermeria",
  // "enfermería") y una coincidencia perdida cambiaría la audiencia.
  const t = dirigidoA.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

  const asistencial = /medic|enfermer|vacunador|asistencial|salud de todos los perfiles|brigadist|laboratorio|odontolog/.test(t);
  const administrativo = /administrativ|archivo|planeacion|talento humano|coordinador|jefes de area|mandos medios|lider/.test(t);

  if (asistencial && !administrativo) return "ASISTENCIAL";
  if (administrativo && !asistencial) return "ADMINISTRATIVO";
  return "AMBOS";
}

function derivarModalidad(modalidades: string[]): TrainingModality | null {
  const virtual = modalidades.includes("VIRTUAL");
  const presencial = modalidades.includes("PRESENCIAL");
  if (virtual && presencial) return "MIXTA";
  if (virtual) return "VIRTUAL";
  if (presencial) return "PRESENCIAL";
  return null;
}

async function main() {
  // ---- Responsable del plan -------------------------------------------
  // TrainingPlan.tutorId es obligatorio y el PIC no nombra a una persona,
  // sino a oficinas ("Oficina de Talento Humano"). Se cuelga del admin
  // principal, que es quien lo administra hoy; el responsable real de cada
  // actividad queda en responsibleLabel, literal del Excel.
  const responsable = await prisma.user.findFirstOrThrow({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { id: true, fullName: true },
  });

  // ---- Áreas ------------------------------------------------------------
  const areas = new Map<string, string>();
  for (const [i, nombre] of pic.areas.entries()) {
    const area = await prisma.trainingArea.upsert({
      where: { name: nombre },
      update: { sortOrder: i + 1 },
      create: { name: nombre, sortOrder: i + 1 },
    });
    areas.set(nombre, area.id);
  }
  console.log(`Áreas reconciliadas: ${areas.size}`);

  // ---- Plan -------------------------------------------------------------
  const existente = await prisma.trainingPlan.findFirst({
    where: { title: TITULO_PLAN, year: pic.anio },
    include: { _count: { select: { activities: true } } },
  });

  if (existente && existente._count.activities > 0) {
    console.log(
      `\nEl plan «${TITULO_PLAN}» ya tiene ${existente._count.activities} actividades. No se toca.\n` +
        `Para reimportar desde cero hay que borrarlas antes, a conciencia.`
    );
    return;
  }

  const plan =
    existente ??
    (await prisma.trainingPlan.create({
      data: {
        title: TITULO_PLAN,
        year: pic.anio,
        description:
          "Plan Institucional de Capacitaciones de Red Salud Casanare E.S.E. para la vigencia 2026, " +
          "tomado del cronograma consolidado por la Oficina de Talento Humano.",
        targetDepartment: null, // aplica a toda la red, sin restricción de dependencia
        tutorId: responsable.id,
        status: "ACTIVE",
      },
    }));

  // ---- Actividades ------------------------------------------------------
  const conteoAudiencia = { ASISTENCIAL: 0, ADMINISTRATIVO: 0, AMBOS: 0 };

  for (const a of pic.actividades) {
    const targetAudience = derivarAudiencia(a.dirigidoA);
    conteoAudiencia[targetAudience] += 1;

    await prisma.trainingActivity.create({
      data: {
        planId: plan.id,
        areaId: areas.get(a.area) ?? null,
        title: a.titulo,
        programa: a.programa,
        // Del catálogo de la plataforma: hoy sin curso vinculado, se le
        // asocia uno a medida que cada área entregue su presentación y su
        // evaluación.
        type: "COURSE",
        courseId: null,
        startDate: null, // el PIC programa por trimestre, no por fecha
        quarters: a.trimestres,
        targetAudience,
        targetAudienceNote: a.dirigidoA,
        isRequired: true,
        status: "DRAFT",
        objective: a.objetivo,
        methodology: a.metodologia,
        modality: derivarModalidad(a.modalidades) ?? "VIRTUAL",
        expectedAttendeesNote: a.cupoTexto,
        expectedAttendees: a.cupo,
        responsibleLabel: a.responsable,
        followUpEvidence: a.seguimiento,
        sourceRow: a.filaExcel,
      },
    });
  }

  console.log(`\nPlan «${plan.title}» · responsable de registro: ${responsable.fullName}`);
  console.log(`Actividades creadas: ${pic.actividades.length}`);
  console.log(
    `Audiencia derivada -> asistencial ${conteoAudiencia.ASISTENCIAL} · ` +
      `administrativo ${conteoAudiencia.ADMINISTRATIVO} · ambos ${conteoAudiencia.AMBOS}`
  );
  console.log(`Sin fecha (programadas por trimestre): ${pic.actividades.length}`);
  console.log(`Sin curso vinculado todavía: ${pic.actividades.length}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("FALLÓ la siembra:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
