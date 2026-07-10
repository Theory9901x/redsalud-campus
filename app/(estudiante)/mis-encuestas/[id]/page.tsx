import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getSurveyForStudent } from "@/lib/surveys";
import { submitSurveyResponseAction } from "@/app/(estudiante)/mis-encuestas/actions";
import { SurveyAnswerForm } from "@/components/student/survey-answer-form";

export default async function MisEncuestasDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const userId = session!.user.id;

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { department: true, personnelType: true },
  });

  const { survey, alreadyAnswered } = await getSurveyForStudent(id, userId, user.department, user.personnelType);
  if (!survey) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
      <Link
        href="/mis-encuestas"
        className="mb-6 flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Mis encuestas
      </Link>

      {alreadyAnswered ? (
        <div className="surface flex flex-col items-center gap-3 p-10 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success/15 text-success">
            <CheckCircle2 className="h-7 w-7" />
          </span>
          <h1 className="font-display text-lg font-bold text-foreground">Ya respondiste esta encuesta</h1>
          <p className="text-sm text-muted-foreground">Gracias por tu opinión. Solo se admite una respuesta por persona.</p>
        </div>
      ) : (
        <SurveyAnswerForm
          surveyId={survey.id}
          title={survey.title}
          description={survey.description}
          questions={survey.questions}
          action={submitSurveyResponseAction.bind(null, survey.id)}
        />
      )}
    </main>
  );
}
