import { prisma } from "../lib/prisma";

/**
 * Segunda jornada (TARDE) de "CONVIVENCIA LABORAL 25 SEPTIEMBRE 2026":
 * 2:00–6:00 p. m. hora Colombia, virtual en la misma sala integrada (mismo
 * enlace, mismo QR de la actividad, mismo enlace de externos). Marca la de
 * la mañana como MAÑANA. Idempotente: no duplica la jornada de la tarde.
 */
const ACTIVIDAD = "cmuh0e3gm0002aml8kw3fi97g";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

async function main() {
  const inicioTarde = new Date("2026-09-25T14:00:00-05:00");
  const finTarde = new Date("2026-09-25T18:00:00-05:00");
  const jornadas = await prisma.trainingSession.findMany({ where: { activityId: ACTIVIDAD }, select: { id: true, startsAt: true } });

  for (const j of jornadas.filter((x) => x.startsAt < new Date("2026-09-25T12:00:00-05:00"))) {
    await prisma.trainingSession.update({ where: { id: j.id }, data: { shift: "MANANA" } });
  }
  const yaTarde = jornadas.find((x) => x.startsAt.getTime() === inicioTarde.getTime());
  const tarde = yaTarde
    ? await prisma.trainingSession.update({ where: { id: yaTarde.id }, data: { shift: "TARDE", endsAt: finTarde, status: "OPEN" }, select: { tokenPublico: true } })
    : await prisma.trainingSession.create({
        data: {
          activityId: ACTIVIDAD, startsAt: inicioTarde, endsAt: finTarde, shift: "TARDE", modality: "VIRTUAL", status: "OPEN",
          meetingUrl: `${APP_URL}/sala/${ACTIVIDAD}`, facilitador: "Laura Johana Moreno Perez",
        },
        select: { tokenPublico: true },
      });
  const total = await prisma.trainingSession.count({ where: { activityId: ACTIVIDAD } });
  console.log(`${yaTarde ? "jornada de la tarde ya existía (actualizada)" : "jornada de la tarde creada"} · 2:00–6:00 p. m. · ${total} jornadas en la capacitación`);
  console.log(`QR jornada tarde: ${APP_URL}/s/${tarde.tokenPublico}`);
}
main().finally(() => prisma.$disconnect());
