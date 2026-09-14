import { prisma } from "../lib/prisma";

/**
 * FASE 1 · Depuración del módulo de encuestas: queda únicamente la
 * Encuesta de Atención al Usuario (SIAU, PM-7-SIAU-PR-02). Las demás
 * -satisfacción fija de capacitaciones, clones por jornada, pruebas- se
 * eliminan con sus respuestas (cascada). Se reporta antes de borrar.
 *
 * Uso: npx tsx --env-file=.env scripts/depurar-encuestas-siau.ts [--dry]
 */
async function main() {
  const dry = process.argv.includes("--dry");
  const conservar = await prisma.survey.findMany({ where: { code: { startsWith: "PM-7-SIAU" } }, select: { id: true, code: true, title: true } });
  if (conservar.length === 0) throw new Error("No existe la encuesta SIAU: no se borra nada.");
  const borrar = await prisma.survey.findMany({
    where: { id: { notIn: conservar.map((c) => c.id) } },
    select: { id: true, code: true, title: true, _count: { select: { responses: true } } },
  });
  console.log(`conservar: ${conservar.map((c) => `${c.code} · ${c.title}`).join(" | ")}`);
  for (const b of borrar) console.log(`${dry ? "SE BORRARÍA" : "BORRADA"}: ${b.code} · ${b.title} · ${b._count.responses} respuestas`);
  if (!dry && borrar.length > 0) {
    await prisma.survey.deleteMany({ where: { id: { in: borrar.map((b) => b.id) } } });
  }
  console.log(`${dry ? "simulación" : "listo"} · eliminadas ${borrar.length} · queda ${conservar.length}`);
}
main().finally(() => prisma.$disconnect());
