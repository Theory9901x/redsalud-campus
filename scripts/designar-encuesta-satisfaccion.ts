import { prisma } from "../lib/prisma";

/**
 * Designa la encuesta de satisfacción FIJA institucional.
 *
 * Toma la encuesta de demostración, la renombra a "Encuesta de Satisfacción",
 * la marca como modelo fijo (esSatisfaccionFija) y le antepone la pregunta
 * de puntuación por estrellas. Las preguntas actuales son provisionales:
 * cuando Talento Humano entregue el modelo definitivo, se sobreescriben en
 * el constructor y las jornadas que cierren después usan la versión nueva.
 *
 * Idempotente: si ya existe una encuesta marcada, no toca nada.
 */
async function main() {
  const yaFija = await prisma.survey.findFirst({ where: { esSatisfaccionFija: true }, select: { id: true, title: true } });
  if (yaFija) {
    console.log(`Ya hay encuesta fija: "${yaFija.title}" (${yaFija.id}). Sin cambios.`);
    return;
  }

  const demo = await prisma.survey.findFirst({
    where: { title: { contains: "Satisfacción de la jornada" }, isTemplate: false },
    include: { pages: { orderBy: { sortOrder: "asc" }, select: { id: true, title: true } } },
  });
  if (!demo) throw new Error("No se encontró la encuesta de satisfacción de demostración.");

  await prisma.survey.update({
    where: { id: demo.id },
    data: {
      title: "Encuesta de Satisfacción",
      esSatisfaccionFija: true,
      description:
        "Mide la satisfacción del personal con la capacitación. Preguntas provisionales: se reemplazarán por el modelo institucional definitivo.",
    },
  });

  // Pregunta de estrellas al frente del primer bloque (si no está ya).
  const primerBloque = demo.pages[0];
  if (primerBloque) {
    const yaTiene = await prisma.surveyQuestion.findFirst({
      where: { pageId: primerBloque.id, prompt: { contains: "satisfacción general" } },
      select: { id: true },
    });
    if (!yaTiene) {
      await prisma.surveyQuestion.create({
        data: {
          pageId: primerBloque.id,
          sortOrder: 0,
          type: "SCALE",
          prompt: "¿Cómo calificas tu satisfacción general con la capacitación?",
          isRequired: true,
          config: {
            escalaMin: 1,
            escalaMax: 5,
            escalaEstilo: "estrellas",
            etiquetaMin: "Muy insatisfecho",
            etiquetaMax: "Muy satisfecho",
          },
        },
      });
      console.log("Pregunta de estrellas añadida al bloque:", primerBloque.title);
    }
  }

  console.log(`Designada: "${demo.title}" → "Encuesta de Satisfacción" (fija, ${demo.id}).`);
}

main().finally(() => prisma.$disconnect());
