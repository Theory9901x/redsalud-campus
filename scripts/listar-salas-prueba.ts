import { prisma } from "../lib/prisma";
/** Solo lectura: actividades de PRUEBA (título con [PRUEBA]) para verificar la sala sin tocar jornadas reales. */
prisma.trainingActivity
  .findMany({ where: { title: { contains: "[PRUEBA]" } }, select: { id: true, title: true, status: true, manuallyHidden: true } })
  .then((r) => r.forEach((a) => console.log(`${a.id} · ${a.status}${a.manuallyHidden ? " · oculta" : ""} · ${a.title}`)))
  .finally(() => prisma.$disconnect());
