/**
 * Publica las capacitaciones que llevaban en BORRADOR solo porque nadie había
 * pulsado «Habilitar»: ahora una ficha completa se publica sola.
 *
 * Se corre una vez tras desplegar. No toca las cerradas ni las que un
 * administrador retiró de la vista a propósito (manuallyHidden).
 *
 *   npx tsx --env-file=.env prisma/publicar-fichas-completas.ts            (simulación)
 *   npx tsx --env-file=.env prisma/publicar-fichas-completas.ts --commit   (aplica)
 */
import { prisma } from "../lib/prisma";
import { fichaCompletaParaPublicar, sincronizarVisibilidadDelPlan } from "../lib/training-plans";

async function main() {
  const commit = process.argv.includes("--commit");

  const borradores = await prisma.trainingActivity.findMany({
    where: { status: "DRAFT", manuallyHidden: false },
    select: {
      id: true, planId: true, title: true, quarters: true, startDate: true,
      courseId: true, area: { select: { name: true } }, plan: { select: { title: true } },
    },
    orderBy: [{ plan: { title: "asc" } }, { title: "asc" }],
  });

  const publicables = borradores.filter((a) => fichaCompletaParaPublicar(a));
  const incompletas = borradores.filter((a) => !fichaCompletaParaPublicar(a));

  console.log(`Borradores: ${borradores.length}${commit ? "" : "   (SIMULACIÓN)"}`);
  console.log(`  Se publican (ficha completa): ${publicables.length}`);
  console.log(`  Se quedan (ficha incompleta): ${incompletas.length}\n`);

  for (const a of publicables) {
    console.log(`  ${commit ? "✓" : "·"} T${a.quarters.join(",") || "—"} ${a.courseId ? "con curso" : "sin curso"} · ${a.area?.name ?? "—"} · ${a.title.slice(0, 58)}`);
  }
  for (const a of incompletas) {
    console.log(`  ✗ sin trimestre ni fecha · ${a.title.slice(0, 58)}`);
  }

  if (!commit) {
    console.log("\nNada se escribió. Vuelve a correr con --commit para aplicar.");
    return;
  }

  const planes = [...new Set(publicables.map((a) => a.planId))];
  let total = 0;
  for (const planId of planes) total += await sincronizarVisibilidadDelPlan(planId);

  const resumen = await prisma.trainingActivity.groupBy({ by: ["status"], _count: true });
  console.log(`\n${total} capacitaciones publicadas.`);
  console.log(`Estado global: ${resumen.map((r) => `${r.status} ${r._count}`).join(" · ")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
