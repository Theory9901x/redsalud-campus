import { prisma } from "../lib/prisma";
/** Solo conteos: asistentes de la capacitación de convivencia vs. integrantes del Comité de Convivencia Laboral. */
const ACT = "cmuh0e3gm0002aml8kw3fi97g";
async function main() {
  const comite = await prisma.trainingPlan.findFirstOrThrow({ where: { kind: "COMITE", title: { contains: "Convivencia", mode: "insensitive" } }, select: { id: true, title: true, _count: { select: { members: true } } } });
  const conCuenta = await prisma.committeeMember.count({ where: { planId: comite.id, userId: { not: null } } });
  const asistentes = await prisma.trainingAttendance.findMany({ where: { activityId: ACT, attended: true }, select: { userId: true, source: true } });
  const miembros = new Set((await prisma.committeeMember.findMany({ where: { planId: comite.id, userId: { not: null } }, select: { userId: true } })).map((m) => m.userId));
  const deComite = asistentes.filter((a) => miembros.has(a.userId)).length;
  const conexiones = await prisma.callConnectionLog.groupBy({ by: ["userId", "externalParticipantId"], where: { activityId: ACT } });
  const externos = await prisma.externalParticipant.count({ where: { activityId: ACT } });
  console.log(`comité: ${comite.title} · ${comite._count.members} integrantes (${conCuenta} con cuenta)`);
  console.log(`asistentes marcados: ${asistentes.length} · de ellos integrantes del comité: ${deComite} · no integrantes: ${asistentes.length - deComite}`);
  console.log(`fuentes: ${JSON.stringify(asistentes.reduce((o: Record<string, number>, a) => ((o[a.source] = (o[a.source] ?? 0) + 1), o), {}))}`);
  console.log(`personas con conexión registrada: ${conexiones.length} · invitados externos: ${externos}`);
}
main().finally(() => prisma.$disconnect());
