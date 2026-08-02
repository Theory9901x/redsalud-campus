import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getEvaluationGate } from "@/lib/training-plans";
import { momentoActivo } from "@/lib/presaber-postsaber";

/**
 * Guardado del borrador de una evaluación.
 *
 * Es una ruta de API y NO una Server Action, y esa es la razón de que exista.
 * Toda Server Action hace que Next vuelva a renderizar la ruta actual y
 * devuelva el árbol entero: aquí eso significaba repintar el hero, el stepper,
 * las diez preguntas, el panel lateral Y el layout del aula con todo el
 * temario, cada vez que alguien marcaba una opción. Las consultas tardaban
 * 10 ms; el render y su transferencia, todo lo demás. Se sentía como lag
 * porque lo era.
 *
 * Una ruta de API responde un JSON de dos campos y no repinta nada.
 *
 * La validación es la misma que antes pero sin cargar el curso completo: para
 * escribir una respuesta no hace falta saber cuántas lecciones tiene cada
 * módulo.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  const userId = session.user.id;

  let cuerpo: {
    courseId?: string;
    quizId?: string;
    questionId?: string;
    selectedOptionIds?: string[];
    textAnswer?: string | null;
    flagged?: boolean;
  };
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Petición mal formada." }, { status: 400 });
  }

  const { courseId, quizId, questionId } = cuerpo;
  if (!courseId || !quizId || !questionId) {
    return NextResponse.json({ ok: false, error: "Faltan datos." }, { status: 400 });
  }

  // Tres comprobaciones en paralelo, todas por clave: la pregunta pertenece a
  // ESTE cuestionario, el cuestionario a ESTE curso, y la persona está
  // inscrita. Sin ellas, un id manipulado escribiría sobre otra evaluación.
  const [quiz, enrollment, pregunta] = await Promise.all([
    prisma.quiz.findUnique({
      where: { id: quizId },
      select: { id: true, courseId: true, isActive: true, maxAttempts: true },
    }),
    prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: { id: true, status: true, deadlineAt: true },
    }),
    prisma.question.findFirst({ where: { id: questionId, quizId, isActive: true }, select: { id: true } }),
  ]);

  if (!quiz || !quiz.isActive || quiz.courseId !== courseId) {
    return NextResponse.json({ ok: false, error: "Cuestionario no disponible." }, { status: 404 });
  }
  if (!enrollment || enrollment.status === "CANCELLED") {
    return NextResponse.json({ ok: false, error: "No estás inscrito en este curso." }, { status: 403 });
  }
  if (!pregunta) {
    return NextResponse.json({ ok: false, error: "Pregunta no encontrada." }, { status: 404 });
  }
  if (enrollment.deadlineAt && enrollment.deadlineAt < new Date()) {
    return NextResponse.json({ ok: false, error: "El plazo de esta formación venció." }, { status: 403 });
  }

  let abierto = await prisma.quizAttempt.findFirst({
    where: { userId, quizId, finishedAt: null },
    select: { id: true, moment: true },
  });

  // Un intento abierto no sobrevive a su ventana. Si se abrió durante el
  // presaber y la ventana activa ya es otra (o ninguna), ese intento se
  // cierra sin puntaje y NO se reutiliza: reutilizarlo haría que respuestas
  // del postsaber quedaran registradas como presaber, mezclando los dos
  // momentos en un solo intento -que es exactamente lo que el ciclo existe
  // para separar-.
  const gateVentana = await getEvaluationGate(quizId);
  if (abierto && gateVentana) {
    const momentoAhora = momentoActivo(gateVentana);
    if (abierto.moment !== momentoAhora) {
      await prisma.quizAttempt.update({ where: { id: abierto.id }, data: { finishedAt: new Date() } });
      abierto = null;
    }
  }

  let attemptId = abierto?.id;
  if (!attemptId) {
    // Ya aprobado o sin intentos: no se abre uno nuevo. Se consulta solo aquí,
    // que es el único punto donde hace falta.
    const previos = await prisma.quizAttempt.findMany({
      where: { userId, quizId },
      select: { passed: true },
    });
    if (previos.some((a) => a.passed)) {
      return NextResponse.json({ ok: false, error: "Ya aprobaste este cuestionario." }, { status: 409 });
    }
    if (previos.length >= quiz.maxAttempts) {
      return NextResponse.json({ ok: false, error: "No te quedan intentos disponibles." }, { status: 409 });
    }

    // Ciclo presaber/postsaber: si esta evaluación es una de las dos ventanas,
    // no se abre un intento nuevo fuera de ellas -alguien no debería poder
    // arrancar un intento, dejarlo a medias, y terminarlo después de que la
    // ventana cerró-. Null para el resto de evaluaciones de la plataforma.
    const momento = gateVentana ? momentoActivo(gateVentana) : null;
    if (gateVentana && !momento) {
      return NextResponse.json({ ok: false, error: "Esta evaluación no está habilitada en este momento." }, { status: 403 });
    }

    try {
      const nuevo = await prisma.quizAttempt.create({
        data: { userId, quizId, enrollmentId: enrollment.id, attemptNumber: previos.length + 1, moment: momento },
        select: { id: true },
      });
      attemptId = nuevo.id;
    } catch (error) {
      // Dos guardados casi simultáneos: el índice único parcial sobre los
      // intentos sin terminar hace perder a uno, que reutiliza el del otro.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existente = await prisma.quizAttempt.findFirst({
          where: { userId, quizId, finishedAt: null },
          select: { id: true },
        });
        if (!existente) {
          return NextResponse.json({ ok: false, error: "No se pudo iniciar el intento." }, { status: 500 });
        }
        attemptId = existente.id;
      } else {
        throw error;
      }
    }
  }

  // isCorrect y scoreObtained quedan en cero: esto es el borrador, no una
  // calificación. Se recalculan al enviar, en el servidor.
  await prisma.quizAnswer.upsert({
    where: { attemptId_questionId: { attemptId, questionId } },
    update: {
      ...(cuerpo.selectedOptionIds !== undefined ? { selectedOptionIds: cuerpo.selectedOptionIds } : {}),
      ...(cuerpo.textAnswer !== undefined ? { textAnswer: cuerpo.textAnswer } : {}),
      ...(cuerpo.flagged !== undefined ? { flagged: cuerpo.flagged } : {}),
    },
    create: {
      attemptId,
      questionId,
      selectedOptionIds: cuerpo.selectedOptionIds ?? [],
      textAnswer: cuerpo.textAnswer ?? null,
      flagged: cuerpo.flagged ?? false,
      isCorrect: false,
      scoreObtained: 0,
    },
  });

  return NextResponse.json({ ok: true });
}
