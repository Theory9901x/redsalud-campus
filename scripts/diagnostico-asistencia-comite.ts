import { prisma } from "../lib/prisma";

/** Diagnóstico de lectura: de dónde sale cada cifra de asistencia de las sesiones del comité. */
async function main() {
  const comite = await prisma.trainingPlan.findFirst({ where: { kind: "COMITE" }, select: { id: true, title: true, members: { select: { userId: true, fullName: true } } } });
  if (!comite) throw new Error("sin comité");
  const ids = new Set(comite.members.map((m) => m.userId).filter(Boolean));
  const reuniones = await prisma.trainingActivity.findMany({
    where: { planId: comite.id },
    select: {
      id: true, title: true, status: true, manuallyHidden: true,
      attendances: { select: { userId: true, attended: true, source: true, user: { select: { fullName: true } } } },
      callConnections: { select: { userId: true, externalParticipantId: true, displayName: true, durationSeconds: true } },
    },
  });
  for (const r of reuniones) {
    const asisTotal = r.attendances.filter((a) => a.attended);
    const asisMiembros = asisTotal.filter((a) => ids.has(a.userId));
    const conectadosIds = new Set(r.callConnections.map((c) => c.userId ?? `ext:${c.externalParticipantId ?? c.displayName}`));
    const conectadosMiembros = new Set(r.callConnections.map((c) => c.userId).filter((u) => u && ids.has(u)));
    const asistenciaSinConexion = asisMiembros.filter((a) => !conectadosMiembros.has(a.userId));
    const conexionSinAsistencia = [...conectadosMiembros].filter((u) => !asisMiembros.some((a) => a.userId === u));
    console.log(`\n== ${r.title} (${r.status}${r.manuallyHidden ? ", oculta" : ""})`);
    console.log(`asistencia en firme TOTAL: ${asisTotal.length} (integrantes: ${asisMiembros.length}, otros: ${asisTotal.length - asisMiembros.length})`);
    console.log(`conectados a la sala TOTAL: ${conectadosIds.size} (integrantes: ${conectadosMiembros.size}) · tramos: ${r.callConnections.length}`);
    console.log(`integrantes con asistencia pero sin tramo de conexión: ${asistenciaSinConexion.length} → ${asistenciaSinConexion.map((a) => a.user.fullName).join(", ")}`);
    console.log(`integrantes con conexión pero sin asistencia: ${conexionSinAsistencia.length}`);
    const otros = asisTotal.filter((a) => !ids.has(a.userId)).map((a) => a.user.fullName);
    if (otros.length) console.log(`otros asistentes (no integrantes): ${otros.join(", ")}`);
  }
}
main().finally(() => prisma.$disconnect());
