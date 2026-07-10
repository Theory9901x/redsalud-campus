import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarRange, Building2, User, ClipboardList, CheckCircle2 } from "lucide-react";
import { auth } from "@/auth";
import { getTrainingPlanDetailForStudent } from "@/lib/training-plans";
import { getSurveysForUser } from "@/lib/surveys";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrainingDocumentList } from "@/components/training-plans/training-document-list";
import { EmptyState } from "@/components/brand/empty-state";
import { StaggerSections } from "@/components/brand/stagger-sections";
import { COURSE_AUDIENCE_LABELS } from "@/components/cursos/labels";
import {
  TRAINING_PLAN_STATUS_LABELS,
  TRAINING_PLAN_STATUS_CLASSES,
  TRAINING_ACTIVITY_TYPE_LABELS,
  TRAINING_ACTIVITY_TYPE_ICONS,
  TRAINING_ACTIVITY_STATUS_LABELS,
  TRAINING_ACTIVITY_STATUS_CLASSES,
} from "@/components/training-plans/labels";

const DATE_FORMAT = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric" });

export default async function MiCapacitacionDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const userId = session!.user.id;

  const plan = await getTrainingPlanDetailForStudent(id, userId);
  if (!plan) notFound();

  const { pending, answered } = await getSurveysForUser(userId, id);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <StaggerSections className="space-y-6">
        <Link
          href="/mis-capacitaciones"
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Mis capacitaciones
        </Link>

        <div className="surface-panel surface-accent-top p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="font-display text-2xl font-extrabold text-foreground">{plan.title}</h1>
            <Badge className={TRAINING_PLAN_STATUS_CLASSES[plan.status]}>
              {TRAINING_PLAN_STATUS_LABELS[plan.status]}
            </Badge>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CalendarRange className="h-4 w-4 text-primary" />
              {plan.year}
            </span>
            <span className="flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-primary" />
              {plan.targetDepartment ?? "Todo el personal"}
            </span>
            <span className="flex items-center gap-1.5">
              <User className="h-4 w-4 text-primary" />
              {plan.tutor.fullName}
            </span>
          </div>
          {plan.description && (
            <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-foreground/80">
              {plan.description}
            </p>
          )}
        </div>

        <Tabs defaultValue="cronograma">
          <TabsList>
            <TabsTrigger value="cronograma">Cronograma</TabsTrigger>
            <TabsTrigger value="documentos">Documentos</TabsTrigger>
            <TabsTrigger value="encuestas">Evaluaciones</TabsTrigger>
          </TabsList>

          <TabsContent value="cronograma" className="space-y-3 pt-4">
            {plan.activities.length === 0 ? (
              <EmptyState
                icon={CalendarRange}
                title="Sin actividades todavía"
                description="El cronograma se está preparando."
              />
            ) : (
              plan.activities.map((activity) => {
                const TypeIcon = TRAINING_ACTIVITY_TYPE_ICONS[activity.type];
                return (
                  <div
                    key={activity.id}
                    className="surface flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <TypeIcon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-display text-sm font-bold text-foreground">{activity.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {activity.course ? (
                          <Link href={`/cursos/${activity.course.slug}`} className="text-primary hover:underline">
                            {activity.course.title}
                          </Link>
                        ) : (
                          TRAINING_ACTIVITY_TYPE_LABELS[activity.type]
                        )}
                        {" · "}
                        {COURSE_AUDIENCE_LABELS[activity.targetAudience]}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        {DATE_FORMAT.format(activity.startDate)}
                        {activity.endDate ? ` — ${DATE_FORMAT.format(activity.endDate)}` : ""}
                      </span>
                      <Badge className={TRAINING_ACTIVITY_STATUS_CLASSES[activity.status]}>
                        {TRAINING_ACTIVITY_STATUS_LABELS[activity.status]}
                      </Badge>
                    </div>
                  </div>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="documentos" className="pt-4">
            <TrainingDocumentList documents={plan.documents} />
          </TabsContent>

          <TabsContent value="encuestas" className="space-y-6 pt-4">
            <div className="space-y-3">
              <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">Pendientes</h2>
              {pending.length === 0 ? (
                <EmptyState
                  icon={ClipboardList}
                  title="Sin evaluaciones pendientes"
                  description="Cuando tengas una asignada, aparecerá aquí."
                  className="py-10"
                />
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {pending.map((survey) => (
                    <Link
                      key={survey.id}
                      href={`/mis-encuestas/${survey.id}`}
                      className="surface surface-hover flex items-center gap-3 p-4"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <ClipboardList className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-sm font-bold text-foreground">{survey.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {survey._count.questions} {survey._count.questions === 1 ? "pregunta" : "preguntas"}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">Respondidas</h2>
              {answered.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="Aún no respondes ninguna"
                  description="Las que respondas quedarán aquí como constancia."
                  className="py-10"
                />
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {answered.map((survey) => (
                    <div key={survey.id} className="surface flex items-center gap-3 p-4 opacity-80">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/15 text-success">
                        <CheckCircle2 className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-sm font-bold text-foreground">{survey.title}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </StaggerSections>
    </main>
  );
}
