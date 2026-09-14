import { prisma } from "../lib/prisma";

/** Inventario de solo lectura del módulo de encuestas: qué hay y cuánto pesa cada una. */
async function main() {
  const encuestas = await prisma.survey.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true, code: true, slug: true, title: true, status: true, audience: true, isTemplate: true, esSatisfaccionFija: true,
      trainingPlanId: true, trainingActivityId: true, createdAt: true,
      _count: { select: { responses: true, pages: true } },
    },
  });
  for (const e of encuestas) {
    console.log(JSON.stringify({ ...e, createdAt: e.createdAt.toISOString().slice(0, 10) }));
  }
  console.log(`total: ${encuestas.length}`);
}
main().finally(() => prisma.$disconnect());
