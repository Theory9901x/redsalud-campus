import { prisma } from "../lib/prisma";
/**
 * La capacitación "CONVIVENCIA LABORAL 25 SEPTIEMBRE 2026" (PIC) va dirigida a
 * los integrantes del Comité de Convivencia Laboral: su adherencia se mide
 * sobre ellos (32), y los demás asistentes se reportan aparte.
 */
const ACT = "cmuh0e3gm0002aml8kw3fi97g";
async function main() {
  const comite = await prisma.trainingPlan.findFirstOrThrow({ where: { kind: "COMITE", title: { contains: "Convivencia", mode: "insensitive" } }, select: { id: true, title: true, resolutionNumber: true, _count: { select: { members: true } } } });
  await prisma.trainingActivity.update({
    where: { id: ACT },
    data: {
      audienceCommitteePlanId: comite.id,
      targetAudienceNote: `Integrantes del ${comite.title}${comite.resolutionNumber ? ` (Resolución ${comite.resolutionNumber})` : ""}`,
      expectedAttendees: comite._count.members,
    },
  });
  console.log(`listo: audiencia = ${comite._count.members} integrantes del ${comite.title}`);
}
main().finally(() => prisma.$disconnect());
