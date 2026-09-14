import { prisma } from "../lib/prisma";
import { getActivityAdherence, getActivityAttendanceCounts } from "../lib/training-plans";

/** Solo lectura: muestra "X de Y" de cada reunión de comité con la audiencia = integrantes. */
async function main() {
  const reuniones = await prisma.trainingActivity.findMany({
    where: { plan: { kind: "COMITE" } },
    select: { id: true, title: true, courseId: true, targetAudience: true, plan: { select: { id: true, title: true, targetDepartment: true, kind: true } } },
  });
  for (const r of reuniones) {
    const [c, a] = await Promise.all([getActivityAttendanceCounts(r), getActivityAdherence(r)]);
    console.log(`${r.plan.title} · ${r.title}: ${c.asistieron} de ${c.totalAudiencia} (${c.porcentaje}%) · adherencia ${a.adherentCount}/${a.totalExpected} = ${a.percentage}%`);
  }
}
main().finally(() => prisma.$disconnect());
