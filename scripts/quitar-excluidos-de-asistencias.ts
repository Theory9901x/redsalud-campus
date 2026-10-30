import "dotenv/config";
import { prisma } from "../lib/prisma";

/**
 * Borra el rastro que ya dejaron en asistencias y conexiones las cuentas con
 * excludeFromAttendance (entraron a revisar, no a asistir). Sin --aplicar solo
 * cuenta. Solo toca las filas de esas cuentas.
 */
async function main() {
  const aplicar = process.argv.includes("--aplicar");
  const cuentas = await prisma.user.findMany({
    where: { excludeFromAttendance: true },
    select: { id: true, fullName: true, email: true, role: true, position: true },
  });
  console.log("cuentas excluidas:", cuentas);
  if (cuentas.length === 0) return;
  const where = { userId: { in: cuentas.map((c) => c.id) } };
  const conteo = {
    conexiones: await prisma.callConnectionLog.count({ where }),
    asistenciasJornada: await prisma.asistenciaSesion.count({ where }),
    asistenciasCapacitacion: await prisma.trainingAttendance.count({ where }),
  };
  console.log(aplicar ? "a borrar:" : "se borrarían (sin --aplicar no se toca nada):", conteo);
  if (!aplicar) return;
  await prisma.$transaction([
    prisma.callConnectionLog.deleteMany({ where }),
    prisma.asistenciaSesion.deleteMany({ where }),
    prisma.trainingAttendance.deleteMany({ where }),
  ]);
  console.log("listo");
}
main().finally(() => prisma.$disconnect());
