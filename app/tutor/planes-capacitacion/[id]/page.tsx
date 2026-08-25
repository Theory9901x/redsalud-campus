import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarRange,
  Building2,
  User,
  FileText,
  Gauge,
  ClipboardList,
  Plus,
  Info,
  PhoneCall,
} from "lucide-react";
import { requireTrainingPlanRead } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import {
  getTrainingPlanDetail,
  getLinkableCourses,
  getSessionsForPlan,
  getPlanAdherenceSummary,
} from "@/lib/training-plans";
import { getSurveysForPlan } from "@/lib/surveys";
import { getPlanMetricsData } from "@/lib/plan-metrics";
import { getPlanAttendanceOverview } from "@/lib/training-plans";
import {
  createTrainingActivityAction,
  uploadTrainingPlanDocumentAction,
  bulkImportActivitiesAction,
  closeTrainingPlanAction,
  reopenTrainingPlanAction,
  getPlanCloseBlockers,
} from "@/app/admin/planes-capacitacion/actions";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CronogramaView } from "@/components/training-plans/cronograma-view";
import { ClosePlanPanel } from "@/components/training-plans/close-plan-panel";
import { PlanAttendanceTab } from "@/components/training-plans/plan-attendance-tab";
import { TrainingActivityForm } from "@/components/training-plans/training-activity-form";
import { ImportScheduleDialog } from "@/components/training-plans/import-schedule-dialog";
import { TrainingDocumentList } from "@/components/training-plans/training-document-list";
import { TrainingDocumentUploadForm } from "@/components/training-plans/training-document-upload-form";
import { SurveyList } from "@/components/training-plans/survey-list";
import { PlanMetricsView } from "@/components/training-plans/plan-metrics-view";
import { TRAINING_PLAN_STATUS_LABELS, TRAINING_PLAN_STATUS_CLASSES } from "@/components/training-plans/labels";

const FORMATO_HORA_SESION = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit" });

const BASE_PATH = "/tutor/planes-capacitacion";

export default async function TutorPlanCapacitacionDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sesion = await requireTrainingPlanRead(id);

  const [plan, courses, surveys] = await Promise.all([
    getTrainingPlanDetail(id),
    getLinkableCourses(),
    getSurveysForPlan(id),
  ]);
  const sessions = await getSessionsForPlan(id);
  if (!plan) notFound();

  // El área entra a consultar y a gestionar SUS capacitaciones; el plan en sí
  // -agregar líneas, importar el cronograma- lo maneja quien responde por él.
  // Mostrarle un formulario que el servidor le va a rechazar sería una trampa.
  const puedeEditarPlan = sesion.user.role === "ADMIN" || plan.tutorId === sesion.user.id;

  // Gestión adscrita: cada área gestiona SOLO lo suyo. El cronograma completo
  // se ve -la institución entera necesita saber dónde está parada-, pero la
  // puerta de gestión de una capacitación solo se le abre a su propia área.
  const areasGestionables = puedeEditarPlan
    ? null
    : (
        await prisma.trainingArea.findMany({
          where: { tutorId: sesion.user.id },
          select: { id: true },
        })
      ).map((a) => a.id);

  // Decisión revisada por la administración: un tutor de área NO ve las
  // capacitaciones de las demás áreas -ni siquiera en lectura-. El plan que
  // recorre de aquí en adelante es SOLO su parte; el institucional completo
  // es del administrador y del responsable del plan.
  const actividadesVisibles = areasGestionables
    ? plan.activities.filter((act) => act.area && areasGestionables.includes(act.area.id))
    : plan.activities;

  // Mismo criterio para las encuestas: el tutor de área solo ve y gestiona
  // las de SUS actividades. La encuesta general y las de otras áreas son del
  // responsable del plan; la puerta de crear la general (botón "Nueva
  // encuesta" del plan) también se le cierra; la suya la crea desde la ficha
  // de su capacitación.
  const idsActividadesVisibles = new Set(actividadesVisibles.map((a) => a.id));
  const encuestasVisibles = areasGestionables
    ? surveys.filter((s) => s.trainingActivity && idsActividadesVisibles.has(s.trainingActivity.id))
    : surveys;

  const adherenceSummary = await getPlanAdherenceSummary({
    targetDepartment: plan.targetDepartment,
    activities: actividadesVisibles,
  });
  const adherenceByActivity = Object.fromEntries(
    adherenceSummary.perActivity.map((a) => [a.activityId, a.percentage])
  );


  const metricas = await getPlanMetricsData(id, areasGestionables);
  const asistenciaPlan = await getPlanAttendanceOverview(id, areasGestionables);
  const bloqueosCierre = plan.status === "ACTIVE" ? await getPlanCloseBlockers(id) : [];
  const acta =
    plan.status === "CLOSED" && plan.closedAt
      ? {
          fecha: new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric" }).format(plan.closedAt),
          por: plan.closedByUser?.fullName ?? "—",
          observaciones: plan.closeObservations ?? "",
        }
      : null;
  const closePlan = closeTrainingPlanAction.bind(null, BASE_PATH, id);
  const reopenPlan = reopenTrainingPlanAction.bind(null, BASE_PATH, id);

  const addActivityAction = createTrainingActivityAction.bind(null, BASE_PATH, id);
  const uploadDocumentAction = uploadTrainingPlanDocumentAction.bind(null, BASE_PATH, id);
  const importScheduleAction = bulkImportActivitiesAction.bind(null, BASE_PATH, id);

  return (
    <div className="space-y-6">
      <Link
        href={BASE_PATH}
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Planes de capacitación
      </Link>

      <div className="surface surface-accent-top p-6">
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
          <Link
            href={`${BASE_PATH}/${id}/indicadores`}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold text-primary transition-colors hover:bg-primary/15"
          >
            <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
            Ver indicadores
          </Link>
          <Link
            href={`${BASE_PATH}/${id}/conexiones`}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold text-primary transition-colors hover:bg-primary/15"
          >
            <PhoneCall className="h-3.5 w-3.5" aria-hidden="true" />
            Conexiones a llamada
          </Link>
          <span className="flex items-center gap-1.5">
            <Gauge className="h-4 w-4 text-primary" />
            {adherenceSummary.overallPercentage !== null
              ? `${adherenceSummary.overallPercentage}% de cumplimiento`
              : "Sin datos de cumplimiento aún"}
          </span>
        </div>
      </div>

      {puedeEditarPlan && (
        <ClosePlanPanel
          estado={plan.status}
          resumen={{
            totalActividades: plan.activities.length,
            conCurso: plan.activities.filter((a) => a.courseId).length,
            jornadasCerradas: plan.activities.filter((a) => a.status === "CLOSED").length,
            cumplimiento: adherenceSummary.overallPercentage,
          }}
          bloqueos={bloqueosCierre}
          acta={acta}
          puedeReabrir={sesion.user.role === "ADMIN"}
          onClose={closePlan}
          onReopen={reopenPlan}
        />
      )}
      {!puedeEditarPlan && plan.status === "CLOSED" && acta && (
        <p className="surface border-l-4 border-l-navy p-4 text-sm text-muted-foreground">
          Plan cerrado el {acta.fecha}. Solo consulta y exportación.
        </p>
      )}

      <Tabs defaultValue="cronograma">
        <TabsList>
          <TabsTrigger value="cronograma">Cronograma</TabsTrigger>
          <TabsTrigger value="informacion">Información</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="asistencia">Asistencia</TabsTrigger>
          <TabsTrigger value="encuestas">Encuestas</TabsTrigger>
          <TabsTrigger value="metricas">Métricas</TabsTrigger>
        </TabsList>

        <TabsContent value="cronograma" className="space-y-6 pt-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className={puedeEditarPlan ? "space-y-3 lg:col-span-2" : "space-y-3 lg:col-span-3"}>
              <CronogramaView
                activities={actividadesVisibles}
                sessions={(areasGestionables
                  ? sessions.filter((x) => x.activity.area && areasGestionables.includes(x.activity.area.id))
                  : sessions
                ).map((x) => ({ ...x, horaEtiqueta: FORMATO_HORA_SESION.format(x.startsAt) }))}
                basePath={BASE_PATH}
                planId={id}
                adherenceByActivity={adherenceByActivity}
                areasGestionables={areasGestionables}
              />
            </div>

            {puedeEditarPlan && plan.status !== "CLOSED" && (
              <div className="surface h-fit space-y-4 p-5 lg:sticky lg:top-6">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
                    Agregar actividad
                  </h2>
                  <ImportScheduleDialog action={importScheduleAction} />
                </div>
                <TrainingActivityForm action={addActivityAction} courses={courses} />
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="informacion" className="space-y-4 pt-4">
          <div className="surface space-y-4 p-6">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Info className="h-4 w-4 text-primary" />
              <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
                Información del plan
              </h2>
            </div>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Título</dt>
                <dd className="text-sm text-foreground">{plan.title}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Año</dt>
                <dd className="text-sm text-foreground">{plan.year}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Dependencia objetivo</dt>
                <dd className="text-sm text-foreground">{plan.targetDepartment ?? "Todo el personal"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Tutor responsable</dt>
                <dd className="flex items-center gap-1.5 text-sm text-foreground">
                  <User className="h-3.5 w-3.5 text-primary" />
                  {plan.tutor.fullName}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Estado</dt>
                <dd className="text-sm text-foreground">{TRAINING_PLAN_STATUS_LABELS[plan.status]}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Actividades</dt>
                <dd className="text-sm text-foreground">{plan.activities.length}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-muted-foreground">Descripción</dt>
                <dd className="text-sm text-foreground">{plan.description || "Sin descripción."}</dd>
              </div>
            </dl>
          </div>
        </TabsContent>

        <TabsContent value="documentos" className="space-y-3 pt-4">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg font-bold text-foreground">Documentos del plan</h2>
          </div>
          <TrainingDocumentList documents={plan.documents} />
          <div className="surface p-4">
            <TrainingDocumentUploadForm action={uploadDocumentAction} />
          </div>
        </TabsContent>

        <TabsContent value="asistencia" className="pt-4">
          <PlanAttendanceTab datos={asistenciaPlan} />
        </TabsContent>

        <TabsContent value="encuestas" className="space-y-3 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              <h2 className="font-display text-lg font-bold text-foreground">Encuestas</h2>
            </div>
            {puedeEditarPlan && (
              <Link
                href={`${BASE_PATH}/${id}/encuestas/nueva`}
                className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
              >
                <Plus className="h-4 w-4" />
                Nueva encuesta
              </Link>
            )}
          </div>
          <SurveyList surveys={encuestasVisibles} basePath={BASE_PATH} planId={id} showActivityScope />
        </TabsContent>

        <TabsContent value="metricas" className="pt-4">
          {metricas && <PlanMetricsView data={metricas} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
