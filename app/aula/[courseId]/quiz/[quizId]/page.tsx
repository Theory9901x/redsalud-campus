import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAulaQuiz } from "@/lib/aula";
import { seededShuffle } from "@/lib/quiz";
import { QuizTakingForm } from "@/components/aula/quiz-taking-form";

export default async function AulaQuizPage({
  params,
}: {
  params: Promise<{ courseId: string; quizId: string }>;
}) {
  const { courseId, quizId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const data = await getAulaQuiz(courseId, quizId, session.user.id);
  if (!data) notFound();
  const { quizSummary } = data;

  // El bloqueo por secuencia no cambia durante la propia sesión del quiz
  // (depende de lecciones/otros módulos), así que sí puede resolverse aquí.
  if (!quizSummary.unlocked) redirect(`/aula/${courseId}`);

  // El quiz ya viene completo dentro de data.course.quizzes (getAulaData lo
  // trae sin `select`, así que incluye todos los campos): evita una segunda
  // consulta idéntica a la que ya se hizo para armar quizSummary.
  const quiz = data.course.quizzes.find((q) => q.id === quizId);
  if (!quiz || !quiz.isActive) notFound();

  const rawQuestions = await prisma.question.findMany({
    where: { quizId, isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      type: true,
      statement: true,
      imageUrl: true,
      score: true,
      options: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, text: true },
      },
    },
  });

  const nextAttemptNumber = quizSummary.attemptsUsed + 1;
  const seed = `${quizId}:${session.user.id}:${nextAttemptNumber}`;
  let questions = rawQuestions;
  if (quiz.randomizeQuestions) {
    questions = seededShuffle(questions, `${seed}:questions`);
  }
  if (quiz.randomizeAnswers) {
    questions = questions.map((q) => ({ ...q, options: seededShuffle(q.options, `${seed}:options:${q.id}`) }));
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/*
        Importante: esta página SIEMPRE renderiza QuizTakingForm (nunca una
        rama servidor alternativa tipo "ya aprobaste"). El envío de la
        respuesta llama revalidatePath, lo que hace que Next.js vuelva a
        ejecutar este árbol de Server Components; si aquí hubiera una rama
        condicional que devolviera un JSX distinto al detectar "aprobado",
        reemplazaría por completo la pantalla de resultado del componente
        cliente justo después de enviar. Por eso el estado inicial
        (aprobado / sin intentos / formulario) se pasa como props y es el
        propio cliente quien decide qué mostrar, priorizando el resultado
        de un envío que acaba de ocurrir en esta misma sesión.
      */}
      <QuizTakingForm
        courseId={courseId}
        quizId={quizId}
        title={quiz.title}
        description={quiz.description}
        passingScore={quiz.passingScore}
        timeLimitMinutes={quiz.timeLimitMinutes}
        attemptNumber={nextAttemptNumber}
        maxAttempts={quiz.maxAttempts}
        questions={questions}
        initiallyPassed={quizSummary.passed}
        initialBestScore={quizSummary.bestScore}
        initialAttemptsRemaining={quizSummary.attemptsRemaining}
      />
    </div>
  );
}
