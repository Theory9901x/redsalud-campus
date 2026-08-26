"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calcularPuntaje, tienePreguntasCalificadas, type BloquePuntuable } from "@/lib/encuestas/puntaje";
import { estaAbierta } from "@/lib/encuestas/consultas";
import type { ValorRespuesta } from "@/lib/encuestas/tipos";

/**
 * ENVÍO DE UNA RESPUESTA. Una sola acción para las dos puertas -enlace
 * público sin sesión y plataforma con sesión-, porque las reglas son las
 * mismas y duplicarlas sería la forma segura de que se desincronicen.
 *
 * Todo se vuelve a verificar en el servidor: que la encuesta esté abierta,
 * que las preguntas obligatorias vengan, que no responda dos veces quien no
 * puede, y el puntaje se calcula AQUÍ con la clave que nunca salió del
 * servidor -jamás se confía en un puntaje enviado por el navegador-.
 */
export type ResultadoEnvio = { error: string | null; responseId?: string; puntaje?: number | null };

export async function enviarRespuestaEncuestaAction(
  surveyId: string,
  respuestasCrudas: Record<string, ValorRespuesta>,
  nombreDeclarado: string | null
): Promise<ResultadoEnvio> {
  const encuesta = await prisma.survey.findUnique({
    where: { id: surveyId },
    include: { pages: { orderBy: { sortOrder: "asc" }, include: { questions: { orderBy: { sortOrder: "asc" } } } } },
  });
  if (!encuesta) return { error: "Esta encuesta no existe." };

  const vigencia = estaAbierta(encuesta);
  if (!vigencia.abierta) return { error: vigencia.motivo ?? "Esta encuesta no está recibiendo respuestas." };
  if (encuesta.isTemplate) return { error: "Una plantilla no se responde: primero hay que crear la encuesta." };

  const sesion = await auth();
  const userId = sesion?.user?.id ?? null;

  if (encuesta.requireLogin && !userId) {
    return { error: "Esta encuesta pide iniciar sesión para responderla." };
  }

  // Una sola respuesta por persona, salvo que la encuesta lo permita.
  if (!encuesta.allowMultipleResponses && userId) {
    const previa = await prisma.surveyResponse.findFirst({
      where: { surveyId, userId, completed: true },
      select: { id: true },
    });
    if (previa) return { error: "Ya respondiste esta encuesta." };
  }

  const preguntas = encuesta.pages.flatMap((p) => p.questions);
  const valores = new Map<string, ValorRespuesta>();
  for (const pregunta of preguntas) {
    const valor = respuestasCrudas[pregunta.id];
    const vacia =
      !valor ||
      (valor.tipo === "texto" && valor.texto.trim().length === 0) ||
      (valor.tipo === "opciones" && valor.opcionIds.length === 0) ||
      (valor.tipo === "relacion" && valor.pares.length === 0) ||
      (valor.tipo === "fecha" && valor.valor.trim().length === 0);

    if (vacia) {
      if (pregunta.isRequired) return { error: `Falta responder: «${pregunta.prompt}»` };
      continue;
    }
    valores.set(pregunta.id, valor);
  }

  // ---- puntaje, con la clave que solo conoce el servidor ----
  const bloques: BloquePuntuable[] = encuesta.pages.map((p) => ({
    id: p.id,
    title: p.title,
    questions: p.questions.map((q) => ({ id: q.id, config: q.config })),
  }));
  const califica = tienePreguntasCalificadas(bloques);
  const puntaje = califica ? calcularPuntaje(bloques, valores) : null;

  const respuesta = await prisma.surveyResponse.create({
    data: {
      surveyId,
      userId,
      // Con sesión el nombre sobra: ya se sabe quién es.
      respondentName: userId ? null : nombreDeclarado?.trim() || null,
      completed: true,
      submittedAt: new Date(),
      channel: userId ? "plataforma" : "publico",
      scorePercent: puntaje?.porcentaje ?? null,
      scoreEarned: puntaje?.obtenido ?? null,
      scorePossible: puntaje?.posible ?? null,
      answers: {
        create: [...valores.entries()].map(([questionId, valor]) => ({
          questionId,
          value: valor as unknown as object,
          // El texto se duplica fuera del JSON a propósito: así se puede
          // buscar y exportar sin desarmar el JSON en SQL.
          textValue: valor.tipo === "texto" ? valor.texto.trim() : null,
        })),
      },
    },
    select: { id: true },
  });

  return {
    error: null,
    responseId: respuesta.id,
    puntaje: encuesta.showScoreToRespondent ? (puntaje?.porcentaje ?? null) : null,
  };
}
