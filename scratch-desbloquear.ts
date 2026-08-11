import { prisma } from "./lib/prisma";

async function main() {
  const antes = await prisma.course.findMany({
    where: { isSequential: true },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });
  const r = await prisma.course.updateMany({ where: { isSequential: true }, data: { isSequential: false } });
  console.log(`cursos desbloqueados: ${r.count}`);
  for (const c of antes) console.log(`  - ${c.title}`);

  const quedan = await prisma.course.count({ where: { isSequential: true } });
  console.log(`cursos aún secuenciales: ${quedan}`);
}

main().finally(() => prisma.$disconnect());
