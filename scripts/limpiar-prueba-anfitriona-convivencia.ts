import { prisma } from "../lib/prisma";

/**
 * Borra el rastro de la PRUEBA de verificación del 25-sep: la entrada de
 * Laura (anfitriona) a su propia sala quedó registrada como asistencia y
 * conexión. Solo toca las filas de Laura en esa actividad.
 */
const ACTIVIDAD = "cmuh0e3gm0002aml8kw3fi97g";
async function main() {
  const laura = await prisma.user.findUniqueOrThrow({ where: { email: "laura.moreno@positiva.gov.co" }, select: { id: true } });
  const a = await prisma.trainingAttendance.deleteMany({ where: { activityId: ACTIVIDAD, userId: laura.id } });
  const c = await prisma.callConnectionLog.deleteMany({ where: { activityId: ACTIVIDAD, userId: laura.id } });
  console.log(`borradas: ${a.count} asistencia(s), ${c.count} conexión(es) de prueba de la anfitriona`);
}
main().finally(() => prisma.$disconnect());
