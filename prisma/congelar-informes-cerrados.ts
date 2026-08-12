/**
 * Congela el informe de las jornadas que ya estaban CERRADAS antes de que
 * existiera el congelado.
 *
 * Sin esto, una jornada cerrada el mes pasado seguiría recalculándose en vivo
 * para siempre. Se corre UNA vez tras desplegar; es idempotente (salta las que
 * ya tienen snapshot) y no toca jornadas abiertas, donde el cálculo en vivo es
 * justo lo que se quiere.
 *
 *   npx tsx --env-file=.env prisma/congelar-informes-cerrados.ts          (simulación)
 *   npx tsx --env-file=.env prisma/congelar-informes-cerrados.ts --commit (aplica)
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { freezeActivityReport } from "../lib/training-plans";

async function main() {
  const commit = process.argv.includes("--commit");

  const cerradas = await prisma.trainingActivity.findMany({
    where: { status: "CLOSED", reportSnapshot: { equals: Prisma.DbNull } },
    select: { id: true, title: true, courseId: true, closedAt: true },
    orderBy: { closedAt: "asc" },
  });

  console.log(`Jornadas cerradas sin informe congelado: ${cerradas.length}${commit ? "" : "  (simulación)"}\n`);

  let congeladas = 0;
  let sinCurso = 0;
  for (const a of cerradas) {
    if (!a.courseId) {
      sinCurso++;
      console.log(`  – «${a.title}»: sin curso vinculado, no hay informe que congelar.`);
      continue;
    }
    if (!commit) {
      console.log(`  · «${a.title}» (cerrada ${a.closedAt?.toISOString().slice(0, 10) ?? "—"}) se congelaría.`);
      continue;
    }
    const data = await freezeActivityReport(a.id);
    if (data) {
      congeladas++;
      console.log(
        `  ✓ «${a.title}»: ${data.personas.length} personas · pre ${data.indicadores.promedioPre ?? "—"}% ` +
          `→ post ${data.indicadores.promedioPost ?? "—"}% · ${data.asistencia.length} asistentes`
      );
    }
  }

  console.log(
    `\n${commit ? `${congeladas} informes congelados` : `${cerradas.length - sinCurso} por congelar`}` +
      `${sinCurso > 0 ? `, ${sinCurso} sin curso vinculado` : ""}.`
  );
  if (!commit) console.log("Nada se escribió. Vuelve a correr con --commit para aplicar.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
