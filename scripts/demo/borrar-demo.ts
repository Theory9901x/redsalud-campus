/**
 * Borra TODO lo que creó scripts/demo/montar-demo.ts y nada más.
 *
 * Se apoya en la marca [DEMO] y en la dependencia de demostración: no toca
 * ningún dato real ni los antiguos registros [PRUEBA]. Las filas dependientes
 * (intentos, respuestas, progreso, asistencia, conexiones, certificados) caen
 * solas por las cascadas del esquema.
 *
 *   npx tsx --env-file=.env scripts/demo/borrar-demo.ts
 */
import { prisma } from "../../lib/prisma";

const MARCA = "[DEMO]";
const DEPENDENCIA = "[DEMO] Dependencia de demostración";

async function main() {
  const planes = await prisma.trainingPlan.findMany({ where: { title: { startsWith: MARCA } }, select: { id: true, title: true } });
  const cursos = await prisma.course.findMany({ where: { title: { startsWith: MARCA } }, select: { id: true, title: true } });
  const usuarios = await prisma.user.findMany({ where: { department: DEPENDENCIA }, select: { id: true, fullName: true } });
  const areas = await prisma.trainingArea.findMany({ where: { name: { startsWith: MARCA } }, select: { id: true, name: true } });

  console.log("Se va a borrar:");
  planes.forEach((p) => console.log(`   plan     ${p.title}`));
  cursos.forEach((c) => console.log(`   curso    ${c.title}`));
  usuarios.forEach((u) => console.log(`   usuario  ${u.fullName}`));
  areas.forEach((a) => console.log(`   área     ${a.name}`));

  if (planes.length === 0 && cursos.length === 0 && usuarios.length === 0 && areas.length === 0) {
    console.log("   (no hay nada del ejercicio de demostración)");
    return;
  }

  // Orden: primero lo que cuelga de otras cosas, luego los contenedores.
  // El certificado no cae por cascada desde Course, así que va explícito.
  await prisma.certificate.deleteMany({ where: { OR: [{ courseId: { in: cursos.map((c) => c.id) } }, { userId: { in: usuarios.map((u) => u.id) } }] } });
  await prisma.trainingPlan.deleteMany({ where: { id: { in: planes.map((p) => p.id) } } });
  await prisma.course.deleteMany({ where: { id: { in: cursos.map((c) => c.id) } } });
  await prisma.user.deleteMany({ where: { id: { in: usuarios.map((u) => u.id) } } });
  await prisma.trainingArea.deleteMany({ where: { id: { in: areas.map((a) => a.id) } } });

  console.log("\n✔ Ejercicio de demostración eliminado por completo.");
}

main()
  .catch((e) => {
    console.error("FALLÓ:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
