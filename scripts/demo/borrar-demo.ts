/**
 * Borra TODO lo marcado como demostración ([DEMO]) y nada más.
 *
 * Se apoya en la marca [DEMO] (planes, cursos, áreas, encuestas) y en la
 * dependencia de demostración (usuarios): no toca datos reales ni los
 * registros [PRUEBA]. Las filas dependientes (inscripciones, intentos,
 * respuestas, progreso, asistencia, conexiones) caen por las cascadas del
 * esquema; los certificados van explícitos porque no cuelgan en cascada.
 *
 * Por defecto SOLO MUESTRA lo que borraría. Para borrar:
 *   npx tsx --env-file=.env scripts/demo/borrar-demo.ts --aplicar
 * Todo en una sola transacción: o se borra completo o no se borra nada.
 */
import { prisma } from "../../lib/prisma";

const MARCA = "[DEMO]";
const DEPENDENCIA = "[DEMO] Dependencia de demostración";

async function main() {
  const aplicar = process.argv.includes("--aplicar");

  const [planes, cursos, usuarios, areas, encuestas] = await Promise.all([
    prisma.trainingPlan.findMany({ where: { title: { startsWith: MARCA } }, select: { id: true, title: true, _count: { select: { activities: true } } } }),
    prisma.course.findMany({ where: { title: { startsWith: MARCA } }, select: { id: true, title: true, _count: { select: { enrollments: true } } } }),
    prisma.user.findMany({ where: { OR: [{ department: DEPENDENCIA }, { fullName: { startsWith: MARCA } }] }, select: { id: true, fullName: true } }),
    prisma.trainingArea.findMany({ where: { name: { startsWith: MARCA } }, select: { id: true, name: true } }),
    prisma.survey.findMany({ where: { title: { startsWith: MARCA } }, select: { id: true, title: true } }),
  ]);
  const idsCursos = cursos.map((c) => c.id);
  const idsUsuarios = usuarios.map((u) => u.id);

  const certificados = await prisma.certificate.findMany({
    where: { OR: [{ courseId: { in: idsCursos } }, { userId: { in: idsUsuarios } }] },
    select: { id: true, certificateCode: true, user: { select: { fullName: true, department: true } } },
  });
  const certificadosDePersonasReales = certificados.filter((c) => c.user.department !== DEPENDENCIA && !c.user.fullName.startsWith(MARCA));

  console.log(aplicar ? "SE BORRA:" : "SE BORRARÍA (solo lectura; agrega --aplicar para borrar):");
  planes.forEach((p) => console.log(`   plan      ${p.title} · ${p._count.activities} actividades`));
  cursos.forEach((c) => console.log(`   curso     ${c.title} · ${c._count.enrollments} inscripciones`));
  usuarios.forEach((u) => console.log(`   usuario   ${u.fullName}`));
  areas.forEach((a) => console.log(`   área      ${a.name}`));
  encuestas.forEach((e) => console.log(`   encuesta  ${e.title}`));
  console.log(`   certificados: ${certificados.length} (de personas reales en cursos DEMO: ${certificadosDePersonasReales.length})`);
  certificadosDePersonasReales.forEach((c) => console.log(`      · ${c.certificateCode} · ${c.user.fullName}`));

  const nada = planes.length + cursos.length + usuarios.length + areas.length + encuestas.length === 0;
  if (nada) {
    console.log("   (no hay nada de demostración)");
    return;
  }
  if (!aplicar) return;

  // Orden: lo que cuelga de otras cosas primero, luego los contenedores.
  await prisma.$transaction([
    prisma.certificate.deleteMany({ where: { id: { in: certificados.map((c) => c.id) } } }),
    prisma.survey.deleteMany({ where: { id: { in: encuestas.map((e) => e.id) } } }),
    prisma.trainingPlan.deleteMany({ where: { id: { in: planes.map((p) => p.id) } } }),
    prisma.course.deleteMany({ where: { id: { in: idsCursos } } }),
    prisma.user.deleteMany({ where: { id: { in: idsUsuarios } } }),
    prisma.trainingArea.deleteMany({ where: { id: { in: areas.map((a) => a.id) } } }),
  ]);
  console.log("\nDemostración eliminada por completo.");
}

main()
  .catch((e) => {
    console.error("FALLÓ (no se borró nada: la transacción se revirtió):", e instanceof Error ? e.message.slice(0, 400) : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
