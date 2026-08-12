/**
 * Cierra las capacitaciones del PIC 2026 que solo estaban programadas para el
 * I y/o II trimestre: esos trimestres ya pasaron, así que sus jornadas quedan
 * en consulta -informativas- hasta que la entidad las vuelva a programar el
 * año entrante.
 *
 * Criterio, y es la parte que importa: se cierra solo lo que NO alcanza el III
 * ni el IV trimestre. Una actividad marcada "T1,2,3" sigue vigente y no se
 * toca, aunque su primer trimestre haya pasado; cerrarla dejaría al personal
 * sin poder presentarla en el trimestre que corre.
 *
 * Cerrar congela el informe de las que tienen curso vinculado (queda como acta
 * de lo que alcanzó a ocurrir). Un administrador puede reabrir cualquiera de
 * ellas desde la ficha si hiciera falta.
 *
 *   npx tsx --env-file=.env prisma/cerrar-trimestres-i-ii.ts            (simulación)
 *   npx tsx --env-file=.env prisma/cerrar-trimestres-i-ii.ts --commit   (aplica)
 */
import { prisma } from "../lib/prisma";
import { freezeActivityReport } from "../lib/training-plans";
import { registrarAuditoria } from "../lib/audit";

async function main() {
  const commit = process.argv.includes("--commit");

  const candidatas = await prisma.trainingActivity.findMany({
    where: {
      plan: { title: { contains: "Institucional" }, year: 2026 },
      status: { not: "CLOSED" },
    },
    select: { id: true, title: true, quarters: true, status: true, courseId: true, area: { select: { name: true } } },
    orderBy: [{ area: { name: "asc" } }, { title: "asc" }],
  });

  // Solo las que se agotan en I/II: sin trimestre no se toca nada (no hay
  // forma de saber si ya pasó), y basta un 3 o un 4 para dejarla abierta.
  const aCerrar = candidatas.filter((a) => a.quarters.length > 0 && a.quarters.every((q) => q <= 2));
  const siguenAbiertas = candidatas.filter((a) => a.quarters.some((q) => q >= 3));
  const sinTrimestre = candidatas.filter((a) => a.quarters.length === 0);

  console.log(`PIC 2026 · ${candidatas.length} capacitaciones no cerradas${commit ? "" : "   (SIMULACIÓN)"}`);
  console.log(`  A cerrar (solo I y/o II): ${aCerrar.length}`);
  console.log(`  Siguen abiertas (llegan a III o IV): ${siguenAbiertas.length}`);
  if (sinTrimestre.length > 0) console.log(`  Sin trimestre definido, no se tocan: ${sinTrimestre.length}`);
  console.log("");

  const admin = await prisma.user.findFirstOrThrow({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  let cerradas = 0;
  let congelados = 0;
  for (const a of aCerrar) {
    if (!commit) {
      console.log(`  · [${a.status}] T${a.quarters.join(",")} ${a.area?.name ?? "—"} · ${a.title.slice(0, 68)}`);
      continue;
    }

    await prisma.trainingActivity.update({
      where: { id: a.id },
      data: { status: "CLOSED", closedAt: new Date() },
    });
    cerradas++;

    // El informe se congela después del cierre, igual que en la acción del
    // panel, para que el acta registre el estado definitivo. Sin curso
    // vinculado no hay informe que congelar y devuelve null.
    let detalle = "sin curso vinculado";
    if (a.courseId) {
      const informe = await freezeActivityReport(a.id);
      if (informe) {
        congelados++;
        detalle =
          `informe congelado: ${informe.personas.length} evaluados, ` +
          `${informe.indicadores.asistentes} asistentes, ` +
          `pre ${informe.indicadores.promedioPre ?? "—"}% → post ${informe.indicadores.promedioPost ?? "—"}%`;
      }
    }

    await registrarAuditoria({
      userId: admin.id,
      action: "UPDATE",
      entity: "TrainingActivity",
      entityId: a.id,
      description:
        `Cierre por vigencia de trimestre: «${a.title}» (T${a.quarters.join(",")}) queda en consulta ` +
        `hasta la próxima programación. ${detalle}.`,
    });

    console.log(`  ✓ T${a.quarters.join(",")} ${a.title.slice(0, 58)} — ${detalle}`);
  }

  if (commit) {
    console.log(`\n${cerradas} capacitaciones cerradas, ${congelados} con informe congelado.`);
    const resumen = await prisma.trainingActivity.groupBy({
      by: ["status"],
      where: { plan: { title: { contains: "Institucional" }, year: 2026 } },
      _count: true,
    });
    console.log(`Estado final del PIC: ${resumen.map((r) => `${r.status} ${r._count}`).join(" · ")}`);
  } else {
    console.log(`\nNada se escribió. Vuelve a correr con --commit para aplicar.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
