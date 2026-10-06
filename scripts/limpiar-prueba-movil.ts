import { prisma } from "../lib/prisma";
/** Borra los invitados de verificación (nombre "PRUEBA …", cargo/empresa "PRUEBA") de una actividad: uso … limpiar-prueba-movil.ts [activityId]. */
const ACT = process.argv[2] ?? "cmsf7tncf0008x1l81ryzymoc";
async function main() {
  const act = await prisma.trainingActivity.findUniqueOrThrow({ where: { id: ACT }, select: { title: true } });
  
  const siho = await prisma.user.findUnique({ where: { email: "siho@redsaludteforma.com" }, select: { id: true } });
  const externos = await prisma.externalParticipant.findMany({ where: { activityId: ACT, fullName: { startsWith: "PRUEBA " }, company: "PRUEBA" }, select: { id: true } });
  const ids = externos.map((e) => e.id);
  const c = await prisma.callConnectionLog.deleteMany({ where: { activityId: ACT, OR: [{ externalParticipantId: { in: ids } }, ...(siho ? [{ userId: siho.id }] : [])] } });
  const a = siho ? await prisma.trainingAttendance.deleteMany({ where: { activityId: ACT, userId: siho.id } }) : { count: 0 };
  const e = await prisma.externalParticipant.deleteMany({ where: { id: { in: ids } } });
  console.log(`borrados: ${e.count} invitados de prueba, ${c.count} conexiones, ${a.count} asistencias`);
}
main().finally(() => prisma.$disconnect());
