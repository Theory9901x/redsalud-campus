import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarRange, Users2, ClipboardList, ClipboardCheck, TrendingUp, BookOpen, UserPlus, Plus, Radio } from "lucide-react";
import { requireTrainingActivityAccess } from "@/lib/auth-helpers";
import {
  getTrainingActivityDetail,
  getActivityAdherence,
  getActivityAttendanceCounts,
  getActivityAttendancePage,
  getActivityCompletionRoster,
  getAutomaticAttendanceRoster,
} from "@/lib/training-plans";
import { getSurveysForActivity } from "@/lib/surveys";
import { getLinkableCoursesForUser, getMunicipioOptions, getPresaberPostsaberSummary, getCycleResults, getExternosDeActividad, fichaCompletaParaPublicar } from "@/lib/training-plans";
import {
  uploadTrainingActivityDocumentAction,
  hideActivityAction,
  showActivityAction,
  closeActivityAction,
  reopenActivityAction,
  linkCourseToActivityAction,
  unlinkCourseFromActivityAction,
  createTrainingSessionAction,
  enableTrainingSessionAction,
  closeTrainingSessionAction,
  deleteTrainingSessionAction,
  openPresaberAction,
  closePresaberAction,
  openPostsaberAction,
  closePostsaberAction,
} from "@/app/admin/planes-capacitacion/actions";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { COURSE_AUDIENCE_LABELS } from "@/components/cursos/labels";
import { TrainingDocumentList } from "@/components/training-plans/training-document-list";
import { TrainingDocumentUploadForm } from "@/components/training-plans/training-document-upload-form";
import { ActivityAdherencePanel } from "@/components/training-plans/activity-adherence-panel";
import { AttendanceRoster } from "@/components/training-plans/attendance-roster";
import { AutomaticAttendanceList } from "@/components/training-plans/automatic-attendance-list";
import { ActivityLifecycleActions } from "@/components/training-plans/activity-lifecycle-actions";
import { NonAdherentList } from "@/components/training-plans/non-adherent-list";
import { SurveyList } from "@/components/training-plans/survey-list";
import { ActivityPlanCard } from "@/components/training-plans/activity-plan-card";
import { LinkCourseForm } from "@/components/training-plans/link-course-form";
import { TrainingSessionForm } from "@/components/training-plans/training-session-form";
import { TrainingSessionList } from "@/components/training-plans/training-session-list";
import { PresaberPostsaberPanel } from "@/components/training-plans/presaber-postsaber-panel";
import { CycleResults } from "@/components/training-plans/cycle-results";
import { ActivityQrPanel, type EnlaceQr } from "@/components/training-plans/activity-qr-panel";
import { ActivityReportPanel } from "@/components/training-plans/activity-report-panel";
import { RegistroConexiones } from "@/components/training-plans/registro-conexiones";
import { ExternalParticipantsPanel } from "@/components/training-plans/external-participants-panel";
import QRCode from "qrcode";
import { DeleteEntityButton } from "@/components/admin/delete-entity-button";
import {
  TRAINING_ACTIVITY_TYPE_LABELS,
  TRAINING_ACTIVITY_STATUS_LABELS,
  TRAINING_ACTIVITY_STATUS_CLASSES,
  etiquetaProgramacion,
  etiquetaJornada,
} from "@/components/training-plans/labels";

const BASE_PATH = "/tutor/planes-capacitacion";
const DATETIME_FORMAT = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" });

export default async function TutorActividadDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; activityId: string }>;
  searchParams: Promise<{ asistencia?: string; pagina?: string }>;
}) {
  const { id, activityId } = await params;
  const { asistencia: buscarAsistencia = "", pagina: paginaParam } = await searchParams;
  const { session } = await requireTrainingActivityAccess(activityId);

  const activity = await getTrainingActivityDetail(activityId);
  if (!activity || activity.planId !== id) notFound();

  const activityForAdherence = {
    id: activity.id,
    courseId: activity.courseId,
    targetAudience: activity.targetAudience,
    plan: { targetDepartment: activity.plan.targetDepartment },
  };
  const isClosed = activity.status === "CLOSED";

  const [adherence, conteosAsistencia, roster, completionRoster, surveys, asistenciasAutomaticas] = await Promise.all([
    getActivityAdherence(activityForAdherence),
    getActivityAttendanceCounts(activityForAdherence),
    activity.courseId
      ? Promise.resolve(null)
      : getActivityAttendancePage(activityForAdherence, { buscar: buscarAsistencia, pagina: Number(paginaParam) || 1 }),
    activity.courseId && isClosed
      ? getActivityCompletionRoster({ ...activityForAdherence, courseId: activity.courseId })
      : Promise.resolve(null),
    getSurveysForActivity(activityId),
    activity.courseId ? getAutomaticAttendanceRoster(activityId) : Promise.resolve([]),
  ]);

  const nonAdherentUsers = activity.courseId
    ? (completionRoster ?? []).filter((u) => !u.completed)
    : (roster?.filas ?? []).filter((u) => !u.attended);

  const uploadDocumentAction = uploadTrainingActivityDocumentAction.bind(null, BASE_PATH, id, activityId);
  const hideAction = hideActivityAction.bind(null, BASE_PATH, id, activityId);
  const showAction = showActivityAction.bind(null, BASE_PATH, id, activityId);
  const closeAction = closeActivityAction.bind(null, BASE_PATH, id, activityId);
  const reopenAction = reopenActivityAction.bind(null, BASE_PATH, id, activityId);
  const linkCourseAction = linkCourseToActivityAction.bind(null, BASE_PATH, id, activityId);
  const unlinkCourseAction = unlinkCourseFromActivityAction.bind(null, BASE_PATH, id, activityId);
  const linkableCourses = activity.course ? [] : await getLinkableCoursesForUser(session.user.role, session.user.id);
  const municipios = await getMunicipioOptions();
  const resumenCiclo = activity.courseId ? await getPresaberPostsaberSummary(activityId) : null;
  const resultadosCiclo = activity.courseId ? await getCycleResults(activityId) : null;

  // Enlaces estables de la jornada, como QR. Se generan aquí -en servidor-
  // porque el QR es una imagen determinista del enlace; el cliente solo
  // los muestra e imprime.
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  // Presaber/postsaber viven en el curso vinculado: sin curso (comités,
  // eventos externos) esos dos QR llevarían a una página vacía.
  const definicionQr = [
    { url: `${baseUrl}/c/${activityId}/meet`, titulo: "Sesión virtual", descripcion: "Abre la sala vigente de esta capacitación." },
    ...(activity.courseId
      ? [
          { url: `${baseUrl}/c/${activityId}/presaber`, titulo: "Presaber", descripcion: "Lleva a la evaluación en su momento presaber. Pide iniciar sesión." },
          { url: `${baseUrl}/c/${activityId}/postsaber`, titulo: "Postsaber", descripcion: "Lleva a la evaluación en su momento postsaber. Pide iniciar sesión." },
        ]
      : []),
    { url: `${baseUrl}/invitado/${activityId}`, titulo: "Acceso externo (invitados)", descripcion: "Para gente de otras entidades: registro breve de nombre y empresa, sin cuenta. Solo ven la sala y el presaber/postsaber." },
  ];
  const enlacesQr: EnlaceQr[] = await Promise.all(
    definicionQr.map(async (d) => ({
      titulo: d.titulo,
      descripcion: d.descripcion,
      url: d.url,
      qrDataUrl: await QRCode.toDataURL(d.url, { width: 320, margin: 1 }),
    }))
  );
  const externos = await getExternosDeActividad(activityId);
  const etiquetasCiclo = {
    presaberOpened: activity.presaberOpenedAt ? DATETIME_FORMAT.format(activity.presaberOpenedAt) : null,
    presaberClosed: activity.presaberClosedAt ? DATETIME_FORMAT.format(activity.presaberClosedAt) : null,
    postsaberOpened: activity.postsaberOpenedAt ? DATETIME_FORMAT.format(activity.postsaberOpenedAt) : null,
    postsaberClosed: activity.postsaberClosedAt ? DATETIME_FORMAT.format(activity.postsaberClosedAt) : null,
  };

  const openPresaber = openPresaberAction.bind(null, BASE_PATH, id, activityId);
  const closePresaber = closePresaberAction.bind(null, BASE_PATH, id, activityId);
  const openPostsaber = openPostsaberAction.bind(null, BASE_PATH, id, activityId);
  const closePostsaber = closePostsaberAction.bind(null, BASE_PATH, id, activityId);

  const createSessionAction = createTrainingSessionAction.bind(null, BASE_PATH, id, activityId);
  const enableSessionAction = enableTrainingSessionAction.bind(null, BASE_PATH, id, activityId);
  const closeSessionAction = closeTrainingSessionAction.bind(null, BASE_PATH, id, activityId);
  const deleteSessionAction = deleteTrainingSessionAction.bind(null, BASE_PATH, id, activityId);

  // Indicadores de la jornada, en vivo. Antes estas cifras estaban repartidas
  // por media página -el % de adherencia en un panel, la asistencia en otro,
  // los externos más abajo- y no se podía saber cómo iba la jornada sin
  // recorrerla entera.
  const kpis = [
    {
      etiqueta: "Adherencia",
      valor: `${adherence.percentage}%`,
      detalle: `${adherence.adherentCount} de ${adherence.totalExpected} convocados`,
      Icono: TrendingUp,
      chip: "bg-success/15 text-success",
      destacar: false,
    },
    {
      etiqueta: "Asistencia",
      valor: String(conteosAsistencia.asistieron),
      detalle: `${conteosAsistencia.porcentaje}% del personal objetivo`,
      Icono: Users2,
      chip: "bg-primary/12 text-primary",
      destacar: false,
    },
    {
      etiqueta: "Presaber",
      valor: String(resumenCiclo?.presaberCantidad ?? 0),
      detalle:
        resumenCiclo?.presaberPromedio != null
          ? `promedio ${resumenCiclo.presaberPromedio}%`
          : "sin presentaciones todavía",
      Icono: ClipboardCheck,
      chip: "bg-warning/18 text-warning-foreground",
      destacar: (resumenCiclo?.presaberCantidad ?? 0) > 0,
    },
    {
      etiqueta: "Postsaber",
      valor: String(resumenCiclo?.postsaberCantidad ?? 0),
      detalle:
        resumenCiclo?.postsaberPromedio != null
          ? `promedio ${resumenCiclo.postsaberPromedio}%`
          : "se abre al cerrar el presaber",
      Icono: ClipboardList,
      chip: "bg-primary/12 text-primary",
      destacar: (resumenCiclo?.postsaberCantidad ?? 0) > 0,
    },
    {
      etiqueta: "Jornadas",
      valor: String(activity.sessions.length),
      detalle: activity.sessions.length === 1 ? "agendada" : "agendadas",
      Icono: CalendarRange,
      chip: "bg-success/15 text-success",
      destacar: false,
    },
    {
      etiqueta: "Externos",
      valor: String(externos.length),
      detalle: externos.length === 1 ? "invitado registrado" : "invitados registrados",
      Icono: UserPlus,
      chip: "bg-primary/12 text-primary",
      destacar: false,
    },
  ];

  return (
    <div className="space-y-8">
      <Link
        href={`${BASE_PATH}/${id}`}
        className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {activity.plan.title}
      </Link>

      <header className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
            {activity.area?.name ?? "Capacitación del plan"}
            {activity.programa ? ` · ${activity.programa}` : ""}
          </p>
          <h1 className="mt-2 font-display text-[clamp(1.6rem,3.2vw,2.15rem)] font-extrabold leading-[1.12] tracking-tight text-foreground">
            {activity.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/70 px-3 py-1.5 text-[13px] font-medium text-muted-foreground backdrop-blur-sm">
              <CalendarRange className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
              {etiquetaProgramacion(activity)}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/70 px-3 py-1.5 text-[13px] font-medium text-muted-foreground backdrop-blur-sm">
              <Users2 className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
              {COURSE_AUDIENCE_LABELS[activity.targetAudience]}
            </span>
            <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/60 bg-card/70 px-3 py-1.5 text-[13px] font-medium text-muted-foreground backdrop-blur-sm">
              <BookOpen className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
              {activity.course ? (
                <Link href={`/cursos/${activity.course.slug}`} target="_blank" className="truncate text-primary hover:underline">
                  {activity.course.title}
                </Link>
              ) : (
                <span className="truncate">
                  {activity.type === "EXTERNAL_EVENT"
                    ? TRAINING_ACTIVITY_TYPE_LABELS.EXTERNAL_EVENT
                    : "Sin curso · gestión directa"}
                </span>
              )}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
            <Badge className={TRAINING_ACTIVITY_STATUS_CLASSES[activity.status]}>
              {TRAINING_ACTIVITY_STATUS_LABELS[activity.status]}
            </Badge>
            {activity.status !== "DRAFT" && (
              <Link
                href={`${BASE_PATH}/${id}/actividades/${activityId}/en-vivo`}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary/15"
              >
                <Radio className="h-3.5 w-3.5" aria-hidden="true" />
                Panel en vivo
              </Link>
            )}
            <ActivityLifecycleActions
              status={activity.status}
              closedAtLabel={activity.closedAt ? DATETIME_FORMAT.format(activity.closedAt) : null}
              puedeReabrir={session.user.role === "ADMIN"}
              fichaCompleta={fichaCompletaParaPublicar(activity)}
              onClose={closeAction}
              onReopen={reopenAction}
              onHide={hideAction}
              onShow={showAction}
            />
        </div>
      </header>

      {/* Cómo va la jornada, de un vistazo. */}
      <section aria-label="Indicadores de la jornada" className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <div key={k.etiqueta} className="surface-lumen flex flex-col justify-between gap-3 p-5">
            <span className={cn("relative flex h-9 w-9 items-center justify-center rounded-xl", k.chip)}>
              <k.Icono className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              {k.destacar && (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-warning" aria-hidden="true" />
              )}
            </span>
            <div className="min-w-0">
              <p className="font-display text-[1.75rem] font-extrabold leading-none tracking-tight text-foreground">
                {k.valor}
              </p>
              <p className="mt-1 text-[12px] font-semibold leading-tight text-foreground/80">{k.etiqueta}</p>
              <p className="mt-0.5 truncate text-[11px] leading-tight text-muted-foreground" title={k.detalle}>
                {k.detalle}
              </p>
            </div>
          </div>
        ))}
      </section>

      <ActivityPlanCard activity={activity} responsibleUserName={activity.responsibleUser?.fullName ?? null} />

      {activity.courseId && resumenCiclo && (
        <PresaberPostsaberPanel
          ventanas={activity}
          resumen={resumenCiclo}
          onOpenPresaber={openPresaber}
          onClosePresaber={closePresaber}
          etiquetas={etiquetasCiclo}
          onOpenPostsaber={openPostsaber}
          onClosePostsaber={closePostsaber}
        />
      )}

      {resultadosCiclo && <CycleResults resultados={resultadosCiclo} activityId={activityId} />}

      <ActivityReportPanel activityId={activityId} cerrada={isClosed} />

      <ActivityQrPanel enlaces={enlacesQr} />

      {externos.length > 0 && (
        <ExternalParticipantsPanel
          externos={externos.map((e) => ({ ...e, registradoEtiqueta: DATETIME_FORMAT.format(e.registradoEl) }))}
        />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* El formulario va PRIMERO (izquierda) y en vidrio: es la acción de
            esta sección; la lista de jornadas la acompaña al lado. */}
        <div className="surface-lumen h-fit space-y-3 p-6">
          <h3 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">Agendar jornada</h3>
          <TrainingSessionForm action={createSessionAction} municipios={municipios} salaIntegradaUrl={`${baseUrl}/sala/${activityId}`} />
        </div>
        <div className="space-y-3 lg:col-span-2">
          <h2 className="font-display text-xl font-bold tracking-tight text-foreground">Jornadas agendadas</h2>
          <TrainingSessionList
            sessions={activity.sessions.map((ses) => ({ ...ses, etiqueta: etiquetaJornada(ses) }))}
            onEnable={enableSessionAction}
            onClose={closeSessionAction}
            onDelete={deleteSessionAction}
            vivoBaseUrl={`/tutor/planes-capacitacion/${id}/actividades/${activityId}/sesion`}
          />
        </div>
      </div>

      <RegistroConexiones activityId={activityId} />

      <div className="space-y-3">
        <h2 className="font-display text-xl font-bold tracking-tight text-foreground">Adherencia y cumplimiento</h2>
        {activity.courseId ? (
          <div className="space-y-4">
            <ActivityAdherencePanel adherence={adherence} />
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Quién ya entró a la evaluación</h3>
              <AutomaticAttendanceList asistencias={asistenciasAutomaticas} />
            </div>
          </div>
        ) : (
          <AttendanceRoster
            activityId={activity.id}
            roster={roster!.filas}
            conteos={conteosAsistencia}
            paginacion={{ pagina: roster!.pagina, porPagina: roster!.porPagina, total: roster!.total }}
            buscar={buscarAsistencia}
            locked={isClosed}
          />
        )}
        {isClosed && <NonAdherentList users={nonAdherentUsers} />}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold tracking-tight text-foreground">Contenido del curso</h2>
          {activity.course && (
            <DeleteEntityButton
              action={unlinkCourseAction}
              nombre="El vínculo con el curso"
              descripcion="La capacitación vuelve a quedar «sin contenido todavía». El curso en sí no se toca."
              etiquetaBoton="Desvincular"
              size="sm"
            />
          )}
        </div>
        {activity.course ? (
          <p className="surface-lumen p-5 text-sm text-muted-foreground">
            Esta capacitación se desarrolla con{" "}
            <Link href={`/cursos/${activity.course.slug}`} target="_blank" className="font-medium text-primary hover:underline">
              {activity.course.title}
            </Link>
            .
          </p>
        ) : (
          <div className="surface-lumen p-5">
            <LinkCourseForm action={linkCourseAction} courses={linkableCourses} />
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="font-display text-xl font-bold tracking-tight text-foreground">Documentos de la actividad</h2>
        <TrainingDocumentList documents={activity.documents} />
        <div className="surface-lumen p-5">
          <TrainingDocumentUploadForm action={uploadDocumentAction} />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            <h2 className="font-display text-xl font-bold tracking-tight text-foreground">Encuestas de esta actividad</h2>
          </div>
          <Link
            href={`${BASE_PATH}/${id}/encuestas/nueva?actividad=${activityId}`}
            className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
          >
            <Plus className="h-4 w-4" />
            Nueva encuesta
          </Link>
        </div>
        <SurveyList surveys={surveys} basePath={BASE_PATH} planId={id} showActivityScope={false} />
      </div>
    </div>
  );
}
