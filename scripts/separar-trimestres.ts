import { prisma } from "../lib/prisma";
import { rangoTrimestre, trimestreActual } from "../lib/training-plans";

/**
 * Separa en INSTANCIAS TRIMESTRALES las capacitaciones del PIC programadas
 * en varios trimestres: "Capacitación X" con T1, T2 y T3 pasa a ser tres
 * capacitaciones, una por trimestre, cada una con su asistencia, jornadas,
 * QR, adherencia e informe. Así ningún indicador mezcla trimestres.
 *
 * Qué pasa con lo que ya existe:
 *   - La actividad original se queda con el trimestre donde están sus
 *     registros (asistencias, jornadas, conexiones, externos). Si no tiene
 *     ninguno, con el trimestre más reciente que tenga programado: es el que
 *     se está ejecutando y al que apuntan los QR que ya circulan.
 *   - Los registros que caen en OTRO de sus trimestres se mueven a la
 *     instancia de ese trimestre. Encuestas, documentos y el ciclo
 *     presaber/postsaber se quedan con la original.
 *   - Las instancias nuevas copian la ficha (título, área, objetivo,
 *     metodología, dirigido a, responsable, curso, modalidad…) sin registros.
 *
 *   npx tsx --env-file=.env scripts/separar-trimestres.ts            (vista previa, no cambia nada)
 *   npx tsx --env-file=.env scripts/separar-trimestres.ts --aplicar  (aplica, en una transacción)
 */
const APLICAR = process.argv.includes("--aplicar");

function trimestreDe(fecha: Date, anio: number): number | null {
  for (const t of [1, 2, 3, 4]) {
    const { desde, hasta } = rangoTrimestre(anio, t);
    if (fecha >= desde && fecha < hasta) return t;
  }
  return null;
}

async function main() {
  const actividades = await prisma.trainingActivity.findMany({
    where: { plan: { kind: "CAPACITACION", status: { not: "ARCHIVED" } } },
    include: {
      plan: { select: { title: true, year: true } },
      attendances: { select: { id: true, registeredAt: true } },
      sessions: { select: { id: true, startsAt: true } },
      externalParticipants: { select: { id: true, createdAt: true } },
      callConnections: { select: { id: true, joinedAt: true } },
    },
    orderBy: [{ planId: "asc" }, { title: "asc" }],
  });
  const multi = actividades.filter((a) => a.quarters.length > 1);
  const ahora = trimestreActual();

  type Movimiento = { modelo: "attendance" | "session" | "external" | "connection"; id: string; trimestre: number };
  const planes = multi.map((a) => {
    const anio = a.plan.year;
    const registros: Movimiento[] = [
      ...a.attendances.map((r) => ({ modelo: "attendance" as const, id: r.id, fecha: r.registeredAt })),
      ...a.sessions.map((r) => ({ modelo: "session" as const, id: r.id, fecha: r.startsAt })),
      ...a.externalParticipants.map((r) => ({ modelo: "external" as const, id: r.id, fecha: r.createdAt })),
      ...a.callConnections.map((r) => ({ modelo: "connection" as const, id: r.id, fecha: r.joinedAt })),
    ].map((r) => ({ modelo: r.modelo, id: r.id, trimestre: trimestreDe(r.fecha, anio) ?? 0 }));

    // Trimestre de la original: donde más registros hay (entre los suyos).
    const conteo = new Map<number, number>();
    for (const r of registros) if (a.quarters.includes(r.trimestre)) conteo.set(r.trimestre, (conteo.get(r.trimestre) ?? 0) + 1);
    const masReciente = [...a.quarters].sort((x, y) => y - x).find((t) => anio < ahora.anio || t <= ahora.trimestre) ?? Math.min(...a.quarters);
    const casa = conteo.size > 0 ? [...conteo.entries()].sort((x, y) => y[1] - x[1] || y[0] - x[0])[0][0] : masReciente;
    const nuevas = a.quarters.filter((t) => t !== casa).sort((x, y) => x - y);
    // Registros fuera de los trimestres programados se quedan con la original.
    const mover = registros.filter((r) => r.trimestre !== casa && nuevas.includes(r.trimestre));
    return { a, casa, nuevas, mover, registros: registros.length };
  });

  console.log(`${multi.length} capacitaciones con varios trimestres -> ${planes.reduce((s, p) => s + p.nuevas.length, 0)} instancias nuevas.`);
  for (const p of planes) {
    console.log(
      `- [${p.a.plan.title}] ${p.a.title.slice(0, 70)} | T${p.a.quarters.join(",T")} -> original T${p.casa}, nuevas T${p.nuevas.join(",T")}` +
        (p.registros ? ` | registros ${p.registros}, se mueven ${p.mover.length}` : "")
    );
  }
  if (!APLICAR) {
    console.log("\nVista previa: no se cambió nada. Para aplicar: --aplicar");
    return;
  }

  await prisma.$transaction(
    async (tx) => {
      for (const p of planes) {
        const {
          id, createdAt, updatedAt, quarters, plan, attendances, sessions, externalParticipants, callConnections,
          presaberOpenedAt, presaberClosedAt, postsaberOpenedAt, postsaberClosedAt, reportSnapshot, reportSnapshotAt,
          closedAt, enabledAt, status, ...ficha
        } = p.a;
        void createdAt; void updatedAt; void quarters; void plan; void attendances; void sessions; void externalParticipants; void callConnections;
        void presaberOpenedAt; void presaberClosedAt; void postsaberOpenedAt; void postsaberClosedAt; void reportSnapshot; void reportSnapshotAt; void closedAt;

        await tx.trainingActivity.update({ where: { id }, data: { quarters: [p.casa] } });
        for (const t of p.nuevas) {
          // Una instancia cerrada no cierra las de otros trimestres.
          const estado = status === "CLOSED" ? "OPEN" : status;
          const nueva = await tx.trainingActivity.create({
            data: { ...ficha, quarters: [t], status: estado, enabledAt: estado === "OPEN" ? enabledAt ?? new Date() : enabledAt },
            select: { id: true },
          });
          const de = (m: Movimiento["modelo"]) => p.mover.filter((r) => r.modelo === m && r.trimestre === t).map((r) => r.id);
          await tx.trainingAttendance.updateMany({ where: { id: { in: de("attendance") } }, data: { activityId: nueva.id } });
          await tx.trainingSession.updateMany({ where: { id: { in: de("session") } }, data: { activityId: nueva.id } });
          await tx.externalParticipant.updateMany({ where: { id: { in: de("external") } }, data: { activityId: nueva.id } });
          await tx.callConnectionLog.updateMany({ where: { id: { in: de("connection") } }, data: { activityId: nueva.id } });
        }
      }
    },
    { timeout: 120_000 }
  );
  const despues = await prisma.trainingActivity.count({ where: { plan: { kind: "CAPACITACION", status: { not: "ARCHIVED" } } } });
  console.log(`\nAplicado. Capacitaciones del PIC ahora: ${despues} (antes ${actividades.length}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
