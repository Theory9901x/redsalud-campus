import { prisma } from "../lib/prisma";

/**
 * Borra TODAS las respuestas de la encuesta SIAU (arranque limpio tras
 * cambiar opciones). Reporta antes de borrar. Uso: … [--dry]
 */
async function main() {
  const dry = process.argv.includes("--dry");
  const encuesta = await prisma.survey.findFirstOrThrow({ where: { code: { startsWith: "PM-7-SIAU" } }, select: { id: true, code: true } });
  const n = await prisma.surveyResponse.count({ where: { surveyId: encuesta.id } });
  if (!dry) await prisma.surveyResponse.deleteMany({ where: { surveyId: encuesta.id } });
  console.log(`${dry ? "se borrarían" : "borradas"} ${n} respuestas de ${encuesta.code}`);
}
main().finally(() => prisma.$disconnect());
