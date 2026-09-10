import { prisma } from "../lib/prisma";

/**
 * La reunión del 2 de septiembre fue una prueba de plataforma, no una
 * sesión formal del Comité de Convivencia Laboral: se OCULTA (no se borra:
 * su asistencia y conexiones siguen siendo evidencia consultable) y deja de
 * contar en los indicadores del comité. Idempotente.
 */
const TITULO_PRUEBA = "Reunión comité convivencia laboral";

async function main() {
  const comite = await prisma.trainingPlan.findFirst({ where: { kind: "COMITE", title: "Comité de Convivencia Laboral" }, select: { id: true } });
  if (!comite) throw new Error("No existe el comité.");
  const r = await prisma.trainingActivity.updateMany({
    where: { planId: comite.id, title: TITULO_PRUEBA, manuallyHidden: false },
    data: { manuallyHidden: true, title: `[PRUEBA] ${TITULO_PRUEBA}` },
  });
  console.log(`reuniones de prueba ocultas: ${r.count}`);
}

main().finally(() => prisma.$disconnect());
