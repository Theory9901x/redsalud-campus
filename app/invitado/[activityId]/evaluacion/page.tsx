import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { momentoActivo, MOMENTO_LABEL } from "@/lib/presaber-postsaber";
import { EvaluacionExternaForm, type PreguntaExterna } from "@/components/invitado/evaluacion-externa-form";
import { getParticipanteDeCookie, presentarEvaluacionExternaAction } from "@/app/invitado/[activityId]/actions";

/**
 * Evaluación del INVITADO externo: mismas preguntas del curso, momento
 * dictado por las mismas ventanas del área. Un intento por momento. Las
 * opciones llegan SIN la marca de correcta: la calificación vive en el
 * servidor.
 */
export default async function EvaluacionInvitadoPage({ params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = await params;

  const participante = await getParticipanteDeCookie(activityId);
  if (!participante) redirect(`/invitado/${activityId}`);

  const actividad = await prisma.trainingActivity.findUnique({
    where: { id: activityId },
    select: {
      title: true,
      courseId: true,
      presaberOpenedAt: true,
      presaberClosedAt: true,
      postsaberOpenedAt: true,
      postsaberClosedAt: true,
    },
  });
  if (!actividad?.courseId) notFound();

  const momento = momentoActivo(actividad);
  if (!momento) redirect(`/invitado/${activityId}`);
  const yaPresentado = participante.attempts.some((a) => a.moment === momento);
  if (yaPresentado) redirect(`/invitado/${activityId}`);

  const quiz = await prisma.quiz.findFirst({
    where: { courseId: actividad.courseId, moduleId: null, isActive: true },
    select: {
      title: true,
      passingScore: true,
      questions: {
        where: { isActive: true, type: { not: "OPEN_TEXT" } },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          statement: true,
          type: true,
          options: { orderBy: { sortOrder: "asc" }, select: { id: true, text: true } },
        },
      },
    },
  });
  if (!quiz || quiz.questions.length === 0) redirect(`/invitado/${activityId}`);

  const presentar = presentarEvaluacionExternaAction.bind(null, activityId);
  const preguntas = quiz.questions as PreguntaExterna[];

  return (
    <main className="aula-canvas min-h-screen">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <Link
          href={`/invitado/${activityId}`}
          className="mb-4 flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a la jornada
        </Link>

        <div className="surface-glass surface-accent-top mb-5 px-6 py-5">
          <span className="inline-flex rounded-full bg-warning/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-warning-foreground">
            {MOMENTO_LABEL[momento]}
          </span>
          <h1 className="mt-2 font-display text-xl font-extrabold leading-snug text-foreground">{quiz.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {participante.fullName} ({participante.company}) · {quiz.questions.length} preguntas · mínimo para aprobar{" "}
            {quiz.passingScore}%
          </p>
        </div>

        <EvaluacionExternaForm
          action={presentar}
          preguntas={preguntas}
          momentoLabel={MOMENTO_LABEL[momento]}
          volverHref={`/invitado/${activityId}`}
        />
      </div>
    </main>
  );
}
