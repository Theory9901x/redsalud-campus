import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarRange, Building2, User, ClipboardList, CheckCircle2, FileClock, Hourglass } from "lucide-react";
import { auth } from "@/auth";
import { getTrainingPlanDetailForStudent, getStudentCourseProgress } from "@/lib/training-plans";
import { getSurveysForUser } from "@/lib/surveys";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrainingDocumentList } from "@/components/training-plans/training-document-list";
import { CourseStateCard, type CursoTarjeta, type EstadoTarjeta } from "@/components/cursos/course-state-card";
import { EmptyState } from "@/components/brand/empty-state";
import { StaggerSections } from "@/components/brand/stagger-sections";
import {
  TRAINING_PLAN_STATUS_LABELS,
  TRAINING_PLAN_STATUS_CLASSES,
  etiquetaProgramacion,
} from "@/components/training-plans/labels";

type ActividadPlan = Awaited<ReturnType<typeof getTrainingPlanDetailForStudent>> extends { activities: (infer A)[] } | null
  ? A
  : never;

const CTA: Record<EstadoTarjeta, string> = {
  obligatorio: "Ver curso",
  "en-curso": "Continuar",
  completado: "Ver de nuevo",
  disponible: "Empezar",
};

/** Agrupa por área, igual que en el resto del módulo: es la unidad con la que se organiza el plan. */
function agruparPorArea(actividades: ActividadPlan[]) {
  const grupos = new Map<string, { nombre: string; orden: number; items: ActividadPlan[] }>();
  for (const a of actividades) {
    const clave = a.area?.id ?? "sin-area";
    const g = grupos.get(clave) ?? { nombre: a.area?.name ?? "Sin área asignada", orden: a.area?.sortOrder ?? 99, items: [] };
    g.items.push(a);
    grupos.set(clave, g);
  }
  return [...grupos.values()].sort((x, y) => x.orden - y.orden);
}

export default async function MiCapacitacionDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const userId = session!.user.id;

  const plan = await getTrainingPlanDetailForStudent(id, userId);
  if (!plan) notFound();

  const [{ pending, answered }, progresoPorCurso] = await Promise.all([
    getSurveysForUser(userId, id),
    getStudentCourseProgress(
      plan.activities.map((a) => a.courseId).filter((x): x is string => !!x),
      userId
    ),
  ]);
  const areas = agruparPorArea(plan.activities);

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

          <TabsContent value="cronograma" className="space-y-8 pt-4">
            {plan.activities.length === 0 ? (
              <EmptyState
                icon={CalendarRange}
                title="Sin actividades todavía"
                description="El cronograma se está preparando."
              />
            ) : (
              areas.map((grupo) => (
                <div key={grupo.nombre} className="space-y-3">
                  <p className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
                    {grupo.nombre}
                  </p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {grupo.items.map((activity) => {
                      const avance = activity.courseId ? progresoPorCurso.get(activity.courseId) : null;

                      // Con curso montado y la persona ya inscrita: la tarjeta
                      // real de "Mi aula", con su avance de verdad.
                      if (avance) {
                        const estado: EstadoTarjeta = avance.enrollment
                          ? avance.enrollment.status === "COMPLETED"
                            ? "completado"
                            : avance.enrollment.progressPercentage > 0
                              ? "en-curso"
                              : "disponible"
                          : "disponible";
                        const tarjeta: CursoTarjeta = {
                          id: activity.id,
                          href: `/aula/${activity.courseId}`,
                          imageUrl: avance.course.imageUrl,
                          titulo: avance.course.title,
                          descripcion: avance.course.shortDescription,
                          horas: avance.course.durationHours,
                          institucion: grupo.nombre,
                          estado,
                          progreso: estado === "en-curso" ? avance.enrollment!.progressPercentage : undefined,
                          completadoEl: avance.enrollment?.completedAt?.toLocaleDateString("es-CO", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          }),
                          cta: avance.enrollment ? CTA[estado] : "Ver curso",
                        };
                        return <CourseStateCard key={activity.id} curso={tarjeta} />;
                      }

                      // Tiene curso pero esta persona no está inscrita todavía:
                      // se ve, no se inventa un botón que no lleva a nada.
                      if (activity.course) {
                        return (
                          <div key={activity.id} className="surface flex flex-col gap-2 p-4">
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                              <Hourglass className="h-4.5 w-4.5" />
                            </span>
                            <p className="font-display text-sm font-bold text-foreground">{activity.title}</p>
                            <p className="text-xs text-muted-foreground">
                              Contenido listo: <span className="text-foreground">{activity.course.title}</span>. Se
                              te asignará cuando corresponda.
                            </p>
                            <p className="text-xs font-medium text-muted-foreground">{etiquetaProgramacion(activity)}</p>
                          </div>
                        );
                      }

                      // Sin curso todavía: honesto, sin CTA que no lleva a nada.
                      return (
                        <div key={activity.id} className="surface flex flex-col gap-2 p-4 opacity-80">
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                            <FileClock className="h-4.5 w-4.5" />
                          </span>
                          <p className="font-display text-sm font-bold text-foreground">{activity.title}</p>
                          <p className="text-xs text-muted-foreground">El contenido se está preparando.</p>
                          <p className="text-xs font-medium text-muted-foreground">{etiquetaProgramacion(activity)}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
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
