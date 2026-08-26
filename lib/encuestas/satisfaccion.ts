import { prisma } from "@/lib/prisma";
import { generarCodigoEncuesta, generarSlug } from "@/lib/encuestas/consultas";

/**
 * ENCUESTA DE SATISFACCIÓN FIJA.
 *
 * Talento Humano definió que TODA capacitación debe medir satisfacción con
 * la misma encuesta institucional (la marcada con `esSatisfaccionFija`).
 * Al cerrar una jornada, ese modelo se CLONA y se publica adscrito a la
 * capacitación: cada jornada obtiene su propia copia para que las
 * respuestas queden modularizadas por capacitación -una encuesta global
 * única no podría distinguir a qué jornada pertenece cada respuesta-.
 *
 * Cuando el modelo definitivo llegue, se sobreescriben las preguntas del
 * modelo marcado y las jornadas que cierren después usan la versión nueva;
 * las copias ya desplegadas no se tocan (son el registro de lo que se
 * preguntó en su momento).
 */
export async function desplegarEncuestaSatisfaccion(
  activityId: string
): Promise<{ desplegada: boolean; motivo?: string }> {
  const modelo = await prisma.survey.findFirst({
    where: { esSatisfaccionFija: true },
    include: {
      pages: {
        orderBy: { sortOrder: "asc" },
        include: { questions: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  if (!modelo) return { desplegada: false, motivo: "No hay encuesta de satisfacción fija configurada." };

  const actividad = await prisma.trainingActivity.findUnique({
    where: { id: activityId },
    select: { id: true, title: true, planId: true },
  });
  if (!actividad) return { desplegada: false, motivo: "La capacitación no existe." };

  // Idempotente: si la jornada ya tiene su copia (cierres repetidos,
  // reintentos), no se duplica.
  const yaExiste = await prisma.survey.findFirst({
    where: { trainingActivityId: activityId, title: modelo.title, id: { not: modelo.id } },
    select: { id: true },
  });
  if (yaExiste) return { desplegada: false, motivo: "La jornada ya tiene su encuesta de satisfacción." };

  const [code, slug] = [await generarCodigoEncuesta(), generarSlug()];

  await prisma.survey.create({
    data: {
      code,
      slug,
      title: modelo.title,
      description: modelo.description,
      coverImageUrl: modelo.coverImageUrl,
      themeColor: modelo.themeColor,
      estimatedMinutes: modelo.estimatedMinutes,
      audience: modelo.audience,
      status: "PUBLISHED",
      publishedAt: new Date(),
      trainingPlanId: actividad.planId,
      trainingActivityId: actividad.id,
      targetDepartment: modelo.targetDepartment,
      targetAudience: modelo.targetAudience,
      requireLogin: modelo.requireLogin,
      allowMultipleResponses: modelo.allowMultipleResponses,
      showScoreToRespondent: modelo.showScoreToRespondent,
      thankYouMessage: modelo.thankYouMessage,
      createdBy: modelo.createdBy,
      pages: {
        create: modelo.pages.map((p) => ({
          sortOrder: p.sortOrder,
          title: p.title,
          description: p.description,
          attachmentUrl: p.attachmentUrl,
          attachmentName: p.attachmentName,
          questions: {
            create: p.questions.map((q) => ({
              sortOrder: q.sortOrder,
              type: q.type,
              prompt: q.prompt,
              description: q.description,
              imageUrl: q.imageUrl,
              isRequired: q.isRequired,
              config: q.config as object,
            })),
          },
        })),
      },
    },
  });

  return { desplegada: true };
}
