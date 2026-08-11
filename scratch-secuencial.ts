import { prisma } from "./lib/prisma";

async function main() {
  const cursos = await prisma.course.findMany({
    where: { isSequential: true },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });
  for (const c of cursos) console.log(`${c.id}  ${c.title}`);
}

main().finally(() => prisma.$disconnect());
