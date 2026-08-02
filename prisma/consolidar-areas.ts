/**
 * Reconcilia las áreas ya sembradas con la estructura real del plan.
 *
 * La primera importación tomó cada celda de la columna ÁREA como un área
 * distinta, y eso partió en pedazos áreas que son una sola: "Calidad" quedó
 * dividida entre IAAS-PROA-PMMHM y Seguridad del Paciente, y "Rutas
 * Integrales" en cinco. Aquí cada capacitación pasa a su área real y el
 * programa deja de confundirse con ella.
 *
 * Se corrige en sitio en vez de volver a sembrar porque las capacitaciones
 * ya tienen cursos colgando: rehacerlas desde cero los desengancharía.
 *
 *   node --env-file=.env node_modules/tsx/dist/cli.mjs prisma/consolidar-areas.ts
 */
import { prisma } from "../lib/prisma";
import pic from "./data/pic-2026.json";

async function main() {
  // ---- Las 8 áreas reales, en el orden del plan -------------------------
  const idPorArea = new Map<string, string>();
  for (const [i, nombre] of pic.areas.entries()) {
    const area = await prisma.trainingArea.upsert({
      where: { name: nombre },
      update: { sortOrder: i + 1 },
      create: { name: nombre, sortOrder: i + 1 },
    });
    idPorArea.set(nombre, area.id);
  }
  console.log(`Áreas reales: ${idPorArea.size}`);

  // ---- Cada capacitación a su área, con su programa ----------------------
  // La fila del Excel es la que identifica de dónde salió cada actividad; el
  // título solo no basta porque una fila puede haber generado varias.
  const porFilaYTitulo = new Map(pic.actividades.map((a) => [`${a.filaExcel}|${a.titulo}`, a]));

  const actividades = await prisma.trainingActivity.findMany({
    where: { sourceRow: { not: null } },
    select: { id: true, title: true, sourceRow: true, areaId: true },
  });

  let movidas = 0;
  let sinReferencia = 0;

  for (const act of actividades) {
    const origen = porFilaYTitulo.get(`${act.sourceRow}|${act.title}`);
    if (!origen) {
      sinReferencia += 1;
      continue;
    }
    const areaId = idPorArea.get(origen.area);
    if (!areaId) continue;

    if (act.areaId !== areaId) movidas += 1;
    await prisma.trainingActivity.update({
      where: { id: act.id },
      data: { areaId, programa: origen.programa },
    });
  }
  console.log(`Capacitaciones reubicadas: ${movidas} · sin correspondencia en el plan: ${sinReferencia}`);

  // ---- Retirar las áreas que eran programas ------------------------------
  const huerfanas = await prisma.trainingArea.findMany({
    where: { name: { notIn: pic.areas } },
    select: { id: true, name: true, _count: { select: { activities: true } } },
  });
  for (const h of huerfanas) {
    if (h._count.activities > 0) {
      console.log(`⚠ «${h.name}» todavía tiene ${h._count.activities} capacitaciones; no se retira.`);
      continue;
    }
    await prisma.trainingArea.delete({ where: { id: h.id } });
    console.log(`  retirada: ${h.name}`);
  }

  // ---- Cómo queda -------------------------------------------------------
  console.log("\n── Áreas del plan ──");
  const resumen = await prisma.trainingArea.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      name: true,
      tutor: { select: { username: true } },
      activities: { select: { programa: true, courseId: true } },
    },
  });
  for (const a of resumen) {
    const programas = [...new Set(a.activities.map((x) => x.programa).filter(Boolean))];
    const conCurso = a.activities.filter((x) => x.courseId).length;
    console.log(
      `${String(conCurso).padStart(2)}/${String(a.activities.length).padEnd(2)}  ${a.name.padEnd(32)} @${(a.tutor?.username ?? "sin tutor").padEnd(17)}${programas.length > 0 ? programas.join(" · ") : ""}`
    );
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("FALLÓ:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
