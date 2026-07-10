import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ClipboardList, Building2, Users2, Plus } from "lucide-react";
import { requireSurveyAccess } from "@/lib/auth-helpers";
import { getSurveyDetail, getSurveyResults } from "@/lib/surveys";
import { createSurveyQuestionAction, deleteSurveyQuestionAction } from "@/app/admin/planes-capacitacion/survey-actions";
import { Button } from "@/components/ui/button";
import { COURSE_AUDIENCE_LABELS } from "@/components/cursos/labels";
import { SurveyQuestionList } from "@/components/training-plans/survey-question-list";
import { SurveyQuestionFormDialog } from "@/components/training-plans/survey-question-form-dialog";
import { SurveyResults } from "@/components/training-plans/survey-results";

const BASE_PATH = "/admin/planes-capacitacion";

export default async function AdminEncuestaDetallePage({
  params,
}: {
  params: Promise<{ id: string; surveyId: string }>;
}) {
  const { id, surveyId } = await params;
  await requireSurveyAccess(surveyId);

  const survey = await getSurveyDetail(surveyId);
  if (!survey || survey.trainingPlanId !== id) notFound();

  const results = await getSurveyResults(surveyId);

  const addQuestionAction = createSurveyQuestionAction.bind(null, BASE_PATH, id, surveyId);
  const deleteQuestionAction = deleteSurveyQuestionAction.bind(null, BASE_PATH, id, surveyId);

  return (
    <div className="space-y-6">
      <Link
        href={
          survey.trainingActivity
            ? `${BASE_PATH}/${id}/actividades/${survey.trainingActivity.id}`
            : `${BASE_PATH}/${id}`
        }
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {survey.trainingActivity ? survey.trainingActivity.title : survey.trainingPlan.title}
      </Link>

      <div className="surface surface-accent-top p-6">
        <h1 className="font-display text-2xl font-extrabold text-foreground">{survey.title}</h1>
        {survey.description && <p className="mt-1 text-sm text-muted-foreground">{survey.description}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Building2 className="h-4 w-4 text-primary" />
            {survey.targetDepartment ?? "Todo el personal"}
          </span>
          <span className="flex items-center gap-1.5">
            <Users2 className="h-4 w-4 text-primary" />
            {COURSE_AUDIENCE_LABELS[survey.targetAudience]}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
            <ClipboardList className="h-4 w-4 text-primary" />
            Preguntas
          </h2>
          <SurveyQuestionFormDialog
            action={addQuestionAction}
            trigger={
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                Agregar pregunta
              </Button>
            }
          />
        </div>
        <SurveyQuestionList questions={survey.questions} onDelete={deleteQuestionAction} />
      </div>

      <div className="space-y-3">
        <h2 className="font-display text-lg font-bold text-foreground">Resultados</h2>
        <SurveyResults
          targetCount={results.targetCount}
          respondedCount={results.respondedCount}
          missing={results.missing}
          questionResults={results.questionResults}
        />
      </div>
    </div>
  );
}
