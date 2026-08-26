/**
 * ENCUESTA DE DEMOSTRACIÓN sobre el entorno demo ya montado: una encuesta de
 * satisfacción de la jornada de higiene de manos, con dos bloques, varios
 * tipos de pregunta (incluida una calificada y una de relacionar), publicada
 * con su enlace público, y con las respuestas de los dos usuarios demo -una
 * por la plataforma y una por el enlace público sin sesión-.
 *
 * Idempotente. Se borra junto con el resto del entorno demo (borrar-demo.ts
 * la elimina por el prefijo y por cascada del plan).
 *
 *   npx tsx --env-file=.env scripts/demo/montar-encuesta-demo.ts
 */
import { prisma } from "../../lib/prisma";
import { generarCodigoEncuesta, generarSlug } from "../../lib/encuestas/consultas";
import { calcularPuntaje, type BloquePuntuable } from "../../lib/encuestas/puntaje";
import type { ValorRespuesta } from "../../lib/encuestas/tipos";

const MARCA = "[DEMO]";

async function main() {
  const actividad = await prisma.trainingActivity.findFirstOrThrow({
    where: { title: `${MARCA} Jornada de higiene de manos` },
    select: { id: true, planId: true },
  });
  const tutora = await prisma.user.findFirstOrThrow({ where: { documentNumber: "DEMO-TUTOR-0001" } });
  const ana = await prisma.user.findFirstOrThrow({ where: { documentNumber: "DEMO-1000000001" } });

  let encuesta = await prisma.survey.findFirst({ where: { title: `${MARCA} Satisfacción de la jornada` } });
  if (!encuesta) {
    encuesta = await prisma.survey.create({
      data: {
        code: await generarCodigoEncuesta(),
        slug: generarSlug(),
        title: `${MARCA} Satisfacción de la jornada`,
        description:
          "Encuesta de demostración: mide la satisfacción con la jornada de higiene de manos y verifica dos conceptos clave.",
        audience: "MIXTA",
        status: "PUBLISHED",
        publishedAt: new Date(),
        themeColor: "#0D9488",
        estimatedMinutes: 3,
        showScoreToRespondent: true,
        thankYouMessage: "¡Gracias! Tu opinión mejora las próximas jornadas.",
        trainingPlanId: actividad.planId,
        trainingActivityId: actividad.id,
        createdBy: tutora.id,
        pages: {
          create: [
            {
              sortOrder: 1,
              title: "Tu experiencia",
              description: "Cuéntanos cómo estuvo la jornada.",
              questions: {
                create: [
                  {
                    sortOrder: 1,
                    type: "SCALE",
                    prompt: "¿Qué tan útil te pareció la jornada?",
                    isRequired: true,
                    config: { escalaMin: 1, escalaMax: 5, etiquetaMin: "Nada útil", etiquetaMax: "Muy útil" },
                  },
                  {
                    sortOrder: 2,
                    type: "SINGLE_CHOICE",
                    prompt: "¿La duración de la sesión fue adecuada?",
                    isRequired: true,
                    config: {
                      opciones: [
                        { id: "corta", texto: "Muy corta" },
                        { id: "adecuada", texto: "Adecuada" },
                        { id: "larga", texto: "Muy larga" },
                      ],
                    },
                  },
                  {
                    sortOrder: 3,
                    type: "LONG_TEXT",
                    prompt: "¿Qué mejorarías de la próxima jornada?",
                    isRequired: false,
                  },
                ],
              },
            },
            {
              sortOrder: 2,
              title: "Verificación de conceptos",
              description: "Dos preguntas rápidas sobre lo visto. Esta parte califica.",
              questions: {
                create: [
                  {
                    sortOrder: 1,
                    type: "YES_NO",
                    prompt: "¿El uso de guantes reemplaza la higiene de manos?",
                    isRequired: true,
                    config: { opcionCorrectaId: "no", puntos: 2 },
                  },
                  {
                    sortOrder: 2,
                    type: "MATCHING",
                    prompt: "Relaciona cada momento con su grupo",
                    isRequired: true,
                    config: {
                      opciones: [
                        { id: "antes-contacto", texto: "Antes del contacto con el paciente" },
                        { id: "despues-fluidos", texto: "Después de exposición a fluidos" },
                        { id: "firmar-historia", texto: "Firmar la historia clínica" },
                      ],
                      grupos: [
                        { id: "requiere", titulo: "Requiere higiene de manos", color: "#0D9488" },
                        { id: "no-requiere", titulo: "No la requiere", color: "#64748B" },
                      ],
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    });
    console.log(`✔ Encuesta creada: ${encuesta.code} · /e/${encuesta.slug}`);
  } else {
    console.log(`= Encuesta ya existía: ${encuesta.code} · /e/${encuesta.slug}`);
  }

  // ---- respuestas de demostración, por el mismo camino que el envío real --
  const completa = await prisma.survey.findUniqueOrThrow({
    where: { id: encuesta.id },
    include: { pages: { orderBy: { sortOrder: "asc" }, include: { questions: { orderBy: { sortOrder: "asc" } } } } },
  });
  const porOrden = completa.pages.flatMap((p) => p.questions);
  const bloques: BloquePuntuable[] = completa.pages.map((p) => ({
    id: p.id,
    title: p.title,
    questions: p.questions.map((q) => ({ id: q.id, config: q.config })),
  }));

  async function responder(opciones: {
    userId?: string;
    nombre?: string;
    canal: "plataforma" | "publico";
    valores: ValorRespuesta[];
    haceMinutos: number;
  }) {
    const yaExiste = await prisma.surveyResponse.findFirst({
      where: opciones.userId
        ? { surveyId: encuesta!.id, userId: opciones.userId }
        : { surveyId: encuesta!.id, respondentName: opciones.nombre },
    });
    if (yaExiste) return;

    const porPregunta = new Map(porOrden.map((q, i) => [q.id, opciones.valores[i]]));
    const puntaje = calcularPuntaje(bloques, porPregunta);
    const inicio = new Date(Date.now() - opciones.haceMinutos * 60000);
    await prisma.surveyResponse.create({
      data: {
        surveyId: encuesta!.id,
        userId: opciones.userId ?? null,
        respondentName: opciones.userId ? null : opciones.nombre,
        completed: true,
        startedAt: inicio,
        submittedAt: new Date(inicio.getTime() + 4 * 60000),
        channel: opciones.canal,
        scorePercent: puntaje.porcentaje,
        scoreEarned: puntaje.obtenido,
        scorePossible: puntaje.posible,
        answers: {
          create: [...porPregunta.entries()].map(([questionId, valor]) => ({
            questionId,
            value: valor as unknown as object,
            textValue: valor.tipo === "texto" ? valor.texto : null,
          })),
        },
      },
    });
  }

  // Ana responde desde la plataforma: todo bien y acierta la calificada.
  await responder({
    userId: ana.id,
    canal: "plataforma",
    haceMinutos: 60 * 26,
    valores: [
      { tipo: "escala", valor: 5 },
      { tipo: "opcion", opcionId: "adecuada" },
      { tipo: "texto", texto: "Más ejemplos prácticos con casos reales del hospital." },
      { tipo: "opcion", opcionId: "no" },
      {
        tipo: "relacion",
        pares: [
          { elementoId: "antes-contacto", grupoId: "requiere" },
          { elementoId: "despues-fluidos", grupoId: "requiere" },
          { elementoId: "firmar-historia", grupoId: "no-requiere" },
        ],
      },
    ],
  });

  // Un externo responde por el enlace público, sin cuenta, y falla la calificada.
  await responder({
    nombre: "Visitante de la ESE municipal",
    canal: "publico",
    haceMinutos: 60 * 3,
    valores: [
      { tipo: "escala", valor: 4 },
      { tipo: "opcion", opcionId: "corta" },
      { tipo: "texto", texto: "" },
      { tipo: "opcion", opcionId: "si" },
      {
        tipo: "relacion",
        pares: [
          { elementoId: "antes-contacto", grupoId: "requiere" },
          { elementoId: "despues-fluidos", grupoId: "no-requiere" },
          { elementoId: "firmar-historia", grupoId: "no-requiere" },
        ],
      },
    ],
  });

  const totales = await prisma.surveyResponse.count({ where: { surveyId: encuesta.id } });
  console.log(`✔ Respuestas de demostración: ${totales} (una por plataforma, una por enlace público)`);
  console.log(`\nDónde verla:`);
  console.log(`   Espacio de trabajo  /encuestas   (admin: todas · tutora demo: la suya)`);
  console.log(`   Enlace público      /e/${encuesta.slug}`);
  console.log(`   Resultados          /encuestas/${encuesta.id}/resultados`);
}

main()
  .catch((e) => {
    console.error("FALLÓ:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
