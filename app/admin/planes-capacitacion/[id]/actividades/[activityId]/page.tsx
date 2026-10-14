import { notFound } from "next/navigation";
import { VistaActividad, SeccionActividad, type PestanaActividad } from "@/components/training-plans/vista-actividad";
import { PanelDeslizable } from "@/components/training-plans/panel-deslizable";
import { UsersRound, FileText, ScrollText, FileBarChart } from "lucide-react";
import Link from "next/link";
import { CalendarRange, Users2, ClipboardList, ClipboardCheck, TrendingUp, BookOpen, UserPlus, Plus } from "lucide-react";
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
  etiquetaProgramacion,
  etiquetaJornada,
  etiquetaDiaMes,
  etiquetaHora,
} from "@/components/training-plans/labels";

const BASE_PATH = "/admin/planes-capacitacion";
const DATETIME_FORMAT = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" });

export default async function AdminActividadDetallePage({
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
    plan: { id: activity.plan.id, targetDepartment: activity.plan.targetDepartment, kind: activity.plan.kind },
    audienceCommitteePlanId: activity.audienceCommitteePlanId,
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

  const pestanas: PestanaActividad[] = [
    {
      valor: "jornadas",
      etiqueta: "Jornadas y acceso",
      Icono: CalendarRange,
      conteo: activity.sessions.length,
      contenido: (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
          <SeccionActividad
            titulo="Jornadas agendadas"
            bajada="El plan programa por trimestre; aquí se agenda el día y la hora exactos de cada jornada."
            accion={
              <PanelDeslizable
                etiqueta="Agendar jornada"
                icono="agendar"
                titulo="Agendar jornada"
                descripcion="Fecha, hora y modalidad. La sala integrada registra la asistencia sola."
              >
                <TrainingSessionForm action={createSessionAction} municipios={municipios} salaIntegradaUrl={`${baseUrl}/sala/${activityId}`} />
              </PanelDeslizable>
            }
          >
            <TrainingSessionList
              sessions={activity.sessions.map((ses) => ({
                ...ses,
                etiqueta: etiquetaJornada(ses),
                ficha: etiquetaDiaMes(ses.startsAt),
                horario: `${etiquetaHora(ses.startsAt)}${ses.endsAt ? ` – ${etiquetaHora(ses.endsAt)}` : ""}`,
              }))}
              onEnable={enableSessionAction}
              onClose={closeSessionAction}
              onDelete={deleteSessionAction}
              vivoBaseUrl={`/admin/planes-capacitacion/${id}/actividades/${activityId}/sesion`}
            />
          </SeccionActividad>
          <div className="xl:sticky xl:top-6 xl:h-fit">
            <ActivityQrPanel enlaces={enlacesQr} />
          </div>
        </div>
      ),
    },
    {
      valor: "asistencia",
      etiqueta: "Asistencia",
      Icono: UsersRound,
      conteo: conteosAsistencia.asistieron,
      contenido: (
        <>
          <SeccionActividad
            titulo="Adherencia y cumplimiento"
            bajada={activity.courseId ? "Se calcula sola con quienes completan el curso vinculado." : "Se marca con la conexión real a la sala; también puedes marcar a alguien a mano."}
          >
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
          </SeccionActividad>
          <RegistroConexiones activityId={activityId} />
          {externos.length > 0 && (
            <ExternalParticipantsPanel
              externos={externos.map((e) => ({ ...e, registradoEtiqueta: DATETIME_FORMAT.format(e.registradoEl) }))}
              etiquetaEntidad={activity.plan.kind === "REUNION" ? "Cargo" : undefined}
            />
          )}
        </>
      ),
    },
    ...(activity.courseId && resumenCiclo
      ? [
          {
            valor: "evaluacion",
            etiqueta: "Evaluación",
            Icono: ClipboardCheck,
            contenido: (
              <>
                <PresaberPostsaberPanel
                  ventanas={activity}
                  resumen={resumenCiclo}
                  onOpenPresaber={openPresaber}
                  onClosePresaber={closePresaber}
                  etiquetas={etiquetasCiclo}
                  onOpenPostsaber={openPostsaber}
                  onClosePostsaber={closePostsaber}
                />
                {resultadosCiclo && <CycleResults resultados={resultadosCiclo} activityId={activityId} />}
              </>
            ),
          } satisfies PestanaActividad,
        ]
      : []),
    {
      valor: "contenido",
      etiqueta: "Contenido y documentos",
      Icono: FileText,
      conteo: activity.documents.length,
      contenido: (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <SeccionActividad
            titulo="Contenido del curso"
            bajada="Vincular un curso activa el cálculo automático de adherencia y el ciclo presaber/postsaber."
            accion={
              activity.course ? (
                <DeleteEntityButton
                  action={unlinkCourseAction}
                  nombre="El vínculo con el curso"
                  descripcion="La capacitación vuelve a quedar «sin contenido todavía». El curso en sí no se toca."
                  etiquetaBoton="Desvincular"
                  size="sm"
                />
              ) : undefined
            }
          >
            {activity.course ? (
              <p className="barra-modulo p-5 text-sm text-muted-foreground">
                Esta capacitación se desarrolla con{" "}
                <Link href={`/cursos/${activity.course.slug}`} target="_blank" className="font-semibold text-primary hover:underline">
                  {activity.course.title}
                </Link>
                .
              </p>
            ) : (
              <div className="barra-modulo form-premium p-5">
                <LinkCourseForm action={linkCourseAction} courses={linkableCourses} />
              </div>
            )}
          </SeccionActividad>
          <SeccionActividad titulo="Documentos de la actividad" bajada="Presentaciones, listas firmadas, grabaciones y evidencias.">
            <TrainingDocumentList documents={activity.documents} />
            <div className="barra-modulo form-premium p-5">
              <TrainingDocumentUploadForm action={uploadDocumentAction} />
            </div>
          </SeccionActividad>
        </div>
      ),
    },
    {
      valor: "encuestas",
      etiqueta: "Encuestas",
      Icono: ClipboardList,
      conteo: surveys.length,
      contenido: (
        <SeccionActividad
          titulo="Encuestas de esta actividad"
          bajada="Satisfacción y evaluación de la jornada."
          accion={
            <Link
              href={`${BASE_PATH}/${id}/encuestas/nueva?actividad=${activityId}`}
              className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
            >
              <Plus className="h-4 w-4" />
              Nueva encuesta
            </Link>
          }
        >
          <SurveyList surveys={surveys} basePath={BASE_PATH} planId={id} showActivityScope={false} />
        </SeccionActividad>
      ),
    },
    {
      valor: "ficha",
      etiqueta: "Ficha del plan",
      Icono: ScrollText,
      contenido: (
        <ActivityPlanCard activity={activity} responsibleUserName={activity.responsibleUser?.fullName ?? null} />
      ),
    },
    {
      valor: "informe",
      etiqueta: "Informe",
      Icono: FileBarChart,
      contenido: <ActivityReportPanel activityId={activityId} cerrada={isClosed} />,
    },
  ];

  return (
    <VistaActividad
      volver={{ href: `${BASE_PATH}/${id}`, etiqueta: activity.plan.title }}
      eyebrow={`${activity.area?.name ?? "Capacitación del plan"}${activity.programa ? ` · ${activity.programa}` : ""}`}
      titulo={activity.title}
      chips={[
        { Icono: CalendarRange, contenido: etiquetaProgramacion(activity) },
        { Icono: Users2, contenido: COURSE_AUDIENCE_LABELS[activity.targetAudience] },
        {
          Icono: BookOpen,
          contenido: activity.course
            ? activity.course.title
            : activity.type === "EXTERNAL_EVENT"
              ? TRAINING_ACTIVITY_TYPE_LABELS.EXTERNAL_EVENT
              : "Sin curso · gestión directa",
        },
      ]}
      estado={activity.status}
      acciones={
        <>
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
        </>
      }
      kpis={kpis.map((k) => ({ valor: k.valor, etiqueta: k.etiqueta, detalle: k.detalle }))}
      pestanas={pestanas}
      pestanaInicial={buscarAsistencia || paginaParam ? "asistencia" : "jornadas"}
    />
  );
}
