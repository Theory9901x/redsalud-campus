import { notFound } from "next/navigation";
import { AudienciaCapacitacion } from "@/components/training-plans/audiencia-capacitacion";
import Link from "next/link";
import QRCode from "qrcode";
import {
  UsersRound,
  FileText,
  ScrollText,
  FileBarChart,
  CalendarRange,
  Users2,
  ClipboardList,
  ClipboardCheck,
  TrendingUp,
  UserPlus,
  Plus,
  Radio,
} from "lucide-react";
import { VistaActividad, SeccionActividad, type PestanaActividad } from "@/components/training-plans/vista-actividad";
import { PanelDeslizable } from "@/components/training-plans/panel-deslizable";
import { requireTrainingActivityAccess } from "@/lib/auth-helpers";
import {
  getTrainingActivityDetail,
  getActivityAttendanceCounts,
  getActivityAttendancePage,
  getMunicipioOptions,
  getPresaberPostsaberSummary,
  getCycleResults,
  getExternosDeActividad,
  fichaCompletaParaPublicar,
  trimestresDeActividad,
} from "@/lib/training-plans";
import { getSurveysForActivity } from "@/lib/surveys";
import { getEvaluacionCapacitacion } from "@/lib/evaluacion-capacitacion";
import { accesosDeJornada, getConteosPorJornada, resolverJornadaVigente } from "@/lib/jornadas";
import { compararAdherencia } from "@/lib/presaber-postsaber";
import {
  uploadTrainingActivityDocumentAction,
  hideActivityAction,
  showActivityAction,
  closeActivityAction,
  reopenActivityAction,
  createTrainingSessionAction,
  enableTrainingSessionAction,
  closeTrainingSessionAction,
  deleteTrainingSessionAction,
  openPresaberAction,
  closePresaberAction,
  openPostsaberAction,
  closePostsaberAction,
  crearEvaluacionCapacitacionAction,
} from "@/app/admin/planes-capacitacion/actions";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { COURSE_AUDIENCE_LABELS } from "@/components/cursos/labels";
import { TrainingDocumentList } from "@/components/training-plans/training-document-list";
import { TrainingDocumentUploadForm } from "@/components/training-plans/training-document-upload-form";
import { AttendanceRoster } from "@/components/training-plans/attendance-roster";
import { ActivityLifecycleActions } from "@/components/training-plans/activity-lifecycle-actions";
import { NonAdherentList } from "@/components/training-plans/non-adherent-list";
import { SurveyList } from "@/components/training-plans/survey-list";
import { ActivityPlanCard } from "@/components/training-plans/activity-plan-card";
import { TrainingSessionForm } from "@/components/training-plans/training-session-form";
import { TrainingSessionList } from "@/components/training-plans/training-session-list";
import { PresaberPostsaberPanel } from "@/components/training-plans/presaber-postsaber-panel";
import { CycleResults } from "@/components/training-plans/cycle-results";
import { EnlacesGenerales } from "@/components/training-plans/enlaces-generales";
import { EvaluacionCapacitacionEditor } from "@/components/training-plans/evaluacion-capacitacion-editor";
import { ActivityReportPanel } from "@/components/training-plans/activity-report-panel";
import { RegistroConexiones } from "@/components/training-plans/registro-conexiones";
import { ExternalParticipantsPanel } from "@/components/training-plans/external-participants-panel";
import { nombreTrimestre } from "@/components/training-plans/trimestres-chip";
import { etiquetaProgramacion, etiquetaJornada, etiquetaDiaMes, etiquetaHora } from "@/components/training-plans/labels";

const DATETIME_FORMAT = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Bogota",
});

const qr = (url: string) => QRCode.toDataURL(url, { width: 320, margin: 1 });

/**
 * PÁGINA DE UNA CAPACITACIÓN DEL PLAN, compartida por administración y
 * tutor (antes eran dos copias casi idénticas que se desincronizaban).
 *
 * Cada JORNADA trae sus propios accesos (QR + enlace de puerta, sala,
 * presaber, postsaber e invitados) y sus contadores: lo que se registra por
 * sus enlaces queda en ella. La evaluación presaber/postsaber se arma aquí
 * mismo, sin cursos.
 */
export async function PaginaActividad({
  basePath,
  planId,
  activityId,
  buscarAsistencia,
  paginaParam,
  trimestreParam,
  panelEnVivo = false,
}: {
  basePath: "/admin/planes-capacitacion" | "/tutor/planes-capacitacion" | "/tutor/capacitaciones";
  planId: string;
  activityId: string;
  buscarAsistencia: string;
  paginaParam?: string;
  trimestreParam?: string;
  /** Tutor: acceso al panel en vivo de la capacitación. */
  panelEnVivo?: boolean;
}) {
  const id = planId;
  const { session } = await requireTrainingActivityAccess(activityId);

  const activity = await getTrainingActivityDetail(activityId);
  if (!activity || activity.planId !== id) notFound();
  if (basePath === "/tutor/capacitaciones" && !activity.plan.isIndependent) notFound();

  const activityForAudience = {
    id: activity.id,
    targetAudience: activity.targetAudience,
    plan: { id: activity.plan.id, targetDepartment: activity.plan.targetDepartment, kind: activity.plan.kind },
    audienceCommitteePlanId: activity.audienceCommitteePlanId,
  };
  const isClosed = activity.status === "CLOSED";
  const planCerrado = activity.plan.status === "CLOSED";

  // VISTA POR TRIMESTRE: la misma capacitación programada en varios
  // trimestres no se duplica; se elige cuál revisar y todo lo de abajo sale
  // solo de ese trimestre.
  const vistaTrimestre = await trimestresDeActividad(activity, trimestreParam);
  const filtro = vistaTrimestre.filtro;
  const jornadas = activity.sessions.filter((ses) => ses.startsAt >= filtro.desde && ses.startsAt < filtro.hasta);

  const [conteosAsistencia, roster, surveys, evaluacion, conteosJornada, vigente, externos, municipios] = await Promise.all([
    getActivityAttendanceCounts(activityForAudience, filtro),
    getActivityAttendancePage(activityForAudience, {
      buscar: buscarAsistencia,
      pagina: Number(paginaParam) || 1,
      trimestre: filtro.trimestre,
    }),
    getSurveysForActivity(activityId),
    getEvaluacionCapacitacion(activityId),
    getConteosPorJornada(jornadas.map((j) => j.id)),
    resolverJornadaVigente(activityId),
    getExternosDeActividad(activityId, filtro),
    getMunicipioOptions(),
  ]);
  const quiz = evaluacion?.quiz ?? null;
  const conEvaluacion = !!quiz && quiz.questions.length > 0;
  const [resumenCiclo, resultadosCiclo] = activity.courseId
    ? await Promise.all([getPresaberPostsaberSummary(activityId, filtro), getCycleResults(activityId, filtro)])
    : [null, null];

  const nonAdherentUsers = roster.filas.filter((u) => !u.attended);

  const uploadDocumentAction = uploadTrainingActivityDocumentAction.bind(null, basePath, id, activityId);
  const hideAction = hideActivityAction.bind(null, basePath, id, activityId);
  const showAction = showActivityAction.bind(null, basePath, id, activityId);
  const closeAction = closeActivityAction.bind(null, basePath, id, activityId);
  const reopenAction = reopenActivityAction.bind(null, basePath, id, activityId);
  const crearEvaluacion = crearEvaluacionCapacitacionAction.bind(null, basePath, id, activityId);
  const openPresaber = openPresaberAction.bind(null, basePath, id, activityId);
  const closePresaber = closePresaberAction.bind(null, basePath, id, activityId);
  const openPostsaber = openPostsaberAction.bind(null, basePath, id, activityId);
  const closePostsaber = closePostsaberAction.bind(null, basePath, id, activityId);
  const createSessionAction = createTrainingSessionAction.bind(null, basePath, id, activityId);
  const enableSessionAction = enableTrainingSessionAction.bind(null, basePath, id, activityId);
  const closeSessionAction = closeTrainingSessionAction.bind(null, basePath, id, activityId);
  const deleteSessionAction = deleteTrainingSessionAction.bind(null, basePath, id, activityId);

  // ACCESOS POR JORNADA, como QR. Se generan aquí -en servidor- porque el QR
  // es una imagen determinista del enlace; el cliente solo los muestra.
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const sesionesUrl = `${basePath}/${id}/actividades/${activityId}/sesion`;
  const jornadasConAccesos = await Promise.all(
    jornadas.map(async (ses) => {
      const accesos = accesosDeJornada(baseUrl, activityId, ses.tokenPublico, { conEvaluacion, modalidad: ses.modality, audience: ses.audience });
      return {
        ...ses,
        etiqueta: etiquetaJornada(ses),
        ficha: etiquetaDiaMes(ses.startsAt),
        horario: `${etiquetaHora(ses.startsAt)}${ses.endsAt ? ` – ${etiquetaHora(ses.endsAt)}` : ""}`,
        conteo: conteosJornada.get(ses.id),
        accesos: await Promise.all(accesos.map(async (a) => ({ ...a, qrDataUrl: await qr(a.url) }))),
        salaHref: `/c/${activityId}/meet?s=${ses.tokenPublico}`,
        fichaHref: `${sesionesUrl}/${ses.id}/ficha`,
        vigente: vigente?.id === ses.id,
      };
    })
  );

  // Enlaces GENERALES (QR ya impresos): siguen funcionando y llevan a la
  // jornada vigente.
  const enlacesGenerales = await Promise.all(
    [
      { clave: "sala", titulo: "Sala / ingreso", descripcion: "Lleva a la sala de la jornada vigente.", url: `${baseUrl}/c/${activityId}/meet` },
      ...(conEvaluacion
        ? [
            { clave: "presaber", titulo: "Presaber", descripcion: "Evaluación antes de la capacitación, en la jornada vigente.", url: `${baseUrl}/c/${activityId}/presaber` },
            { clave: "postsaber", titulo: "Postsaber", descripcion: "Evaluación después de la capacitación, en la jornada vigente.", url: `${baseUrl}/c/${activityId}/postsaber` },
          ]
        : []),
      { clave: "invitados", titulo: "Invitados externos", descripcion: "Registro breve de invitados, en la jornada vigente.", url: `${baseUrl}/invitado/${activityId}` },
    ].filter((e) => e.clave === "invitados" ? vigente?.audience !== "INTERNAL" : vigente?.audience !== "EXTERNAL").map(async (e) => ({ ...e, qrDataUrl: await qr(e.url) }))
  );

  const etiquetasCiclo = {
    presaberOpened: activity.presaberOpenedAt ? DATETIME_FORMAT.format(activity.presaberOpenedAt) : null,
    presaberClosed: activity.presaberClosedAt ? DATETIME_FORMAT.format(activity.presaberClosedAt) : null,
    postsaberOpened: activity.postsaberOpenedAt ? DATETIME_FORMAT.format(activity.postsaberOpenedAt) : null,
    postsaberClosed: activity.postsaberClosedAt ? DATETIME_FORMAT.format(activity.postsaberClosedAt) : null,
  };

  const conocimiento =
    resumenCiclo?.presaberPromedio != null && resumenCiclo.postsaberPromedio != null
      ? compararAdherencia(resumenCiclo.presaberPromedio, resumenCiclo.postsaberPromedio)
      : null;

  // Cifras de la capacitación en el trimestre. La ADHERENCIA es asistencia
  // sobre la población objetivo; el conocimiento (pre → post) es la cifra
  // del ciclo, aparte.
  const kpis = [
    {
      etiqueta: "Asistencia",
      valor: `${conteosAsistencia.porcentaje}%`,
      detalle: `${conteosAsistencia.asistieron} de ${conteosAsistencia.totalAudiencia} del personal objetivo`,
    },
    {
      etiqueta: "Presaber",
      valor: String(resumenCiclo?.presaberCantidad ?? 0),
      detalle: resumenCiclo?.presaberPromedio != null ? `promedio ${resumenCiclo.presaberPromedio}%` : conEvaluacion ? "sin presentaciones todavía" : "sin evaluación",
    },
    {
      etiqueta: "Postsaber",
      valor: String(resumenCiclo?.postsaberCantidad ?? 0),
      detalle: resumenCiclo?.postsaberPromedio != null ? `promedio ${resumenCiclo.postsaberPromedio}%` : conEvaluacion ? "después del presaber" : "sin evaluación",
    },
    {
      etiqueta: "Conocimiento",
      valor: conocimiento ? `${conocimiento.diferencia > 0 ? "+" : ""}${conocimiento.diferencia} pp` : "—",
      detalle: conocimiento ? "de presaber a postsaber" : "falta presaber y postsaber",
    },
    {
      etiqueta: "Jornadas",
      valor: String(jornadas.length),
      detalle: jornadas.length === 1 ? "agendada en el trimestre" : "agendadas en el trimestre",
    },
    {
      etiqueta: "Invitados",
      valor: String(externos.length),
      detalle: externos.length === 1 ? "invitado registrado" : "invitados registrados",
    },
  ];

  const pestanas: PestanaActividad[] = [
    {
      valor: "jornadas",
      etiqueta: "Jornadas y accesos",
      Icono: CalendarRange,
      conteo: jornadas.length,
      contenido: (
        <div className="space-y-4">
          {!isClosed && !planCerrado && activity.plan.kind === "CAPACITACION" && <AudienciaCapacitacion activityId={activityId} audience={activity.targetAudience} visible={activity.status === "OPEN"} />}
          <SeccionActividad
            titulo="Jornadas agendadas"
            bajada="Cada jornada tiene sus propios enlaces y QR; lo que se registre por ellos queda en esa jornada."
            accion={
              <PanelDeslizable
                etiqueta="Agendar jornada"
                icono="agendar"
                titulo="Agendar jornada"
                descripcion="Fecha, hora y modalidad. Al guardarla, la jornada recibe sus propios enlaces y QR."
              >
                <TrainingSessionForm action={createSessionAction} municipios={municipios} salaIntegradaUrl={`${baseUrl}/sala/${activityId}`} />
              </PanelDeslizable>
            }
          >
            <TrainingSessionList
              sessions={jornadasConAccesos}
              onEnable={enableSessionAction}
              onClose={closeSessionAction}
              onDelete={deleteSessionAction}
              vivoBaseUrl={sesionesUrl}
              conEvaluacion={conEvaluacion}
            />
          </SeccionActividad>
          <EnlacesGenerales enlaces={enlacesGenerales} jornadaVigente={vigente ? etiquetaJornada(vigente) : null} />
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
            titulo="Asistencia y adherencia"
            bajada="Se registra sola con la conexión a la sala y los enlaces de cada jornada; también puedes marcar a alguien a mano."
          >
            <AttendanceRoster
              activityId={activity.id}
              roster={roster.filas}
              conteos={conteosAsistencia}
              paginacion={{ pagina: roster.pagina, porPagina: roster.porPagina, total: roster.total }}
              buscar={buscarAsistencia}
              locked={isClosed}
              trimestre={filtro.trimestre}
            />
            {isClosed && <NonAdherentList users={nonAdherentUsers} />}
          </SeccionActividad>
          <RegistroConexiones activityId={activityId} desde={filtro.desde} hasta={filtro.hasta} />
          {externos.length > 0 && (
            <ExternalParticipantsPanel
              externos={externos.map((e) => ({
                ...e,
                registradoEtiqueta: DATETIME_FORMAT.format(e.registradoEl),
                jornada: e.jornadaInicio ? etiquetaJornada({ startsAt: e.jornadaInicio, endsAt: null }) : null,
              }))}
              etiquetaEntidad={activity.plan.kind === "REUNION" ? "Cargo" : undefined}
            />
          )}
        </>
      ),
    },
    {
      valor: "evaluacion",
      etiqueta: "Evaluación",
      Icono: ClipboardCheck,
      conteo: quiz?.questions.length ?? 0,
      contenido: (
        <div className="space-y-6">
          <SeccionActividad
            titulo="Evaluación presaber / postsaber"
            bajada="La misma evaluación se presenta antes de la capacitación (presaber) y después (postsaber). La arma el área aquí mismo."
          >
            <EvaluacionCapacitacionEditor evaluacion={evaluacion} onCrear={crearEvaluacion} bloqueada={planCerrado} />
          </SeccionActividad>
          {quiz && resumenCiclo && (
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
          {resultadosCiclo && <CycleResults resultados={resultadosCiclo} activityId={activityId} trimestre={filtro.trimestre} />}
        </div>
      ),
    },
    {
      valor: "contenido",
      etiqueta: "Documentos",
      Icono: FileText,
      conteo: activity.documents.length,
      contenido: (
        <SeccionActividad titulo="Documentos de la capacitación" bajada="Presentaciones, listas firmadas, grabaciones y evidencias. Van como anexos en el informe.">
          <TrainingDocumentList documents={activity.documents} />
          <div className="barra-modulo form-premium p-5">
            <TrainingDocumentUploadForm action={uploadDocumentAction} />
          </div>
        </SeccionActividad>
      ),
    },
    {
      valor: "encuestas",
      etiqueta: "Encuestas",
      Icono: ClipboardList,
      conteo: surveys.length,
      contenido: (
        <SeccionActividad
          titulo="Encuestas de esta capacitación"
          bajada="Encuesta de satisfacción de la capacitación. Es opcional: aplícala solo si el área así lo quiere."
          accion={
            <Link href={`/encuestas/nueva?plan=${id}&actividad=${activityId}`} className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}>
              <Plus className="h-4 w-4" />
              Nueva encuesta
            </Link>
          }
        >
          <SurveyList surveys={surveys} basePath={basePath} planId={id} showActivityScope={false} />
        </SeccionActividad>
      ),
    },
    {
      valor: "ficha",
      etiqueta: basePath === "/tutor/capacitaciones" ? "Ficha de la capacitación" : "Ficha del plan",
      Icono: ScrollText,
      contenido: <ActivityPlanCard independiente={basePath === "/tutor/capacitaciones"} activity={activity} responsibleUserName={activity.responsibleUser?.fullName ?? null} />,
    },
    {
      valor: "informe",
      etiqueta: "Informe",
      Icono: FileBarChart,
      contenido: (
        <ActivityReportPanel
          activityId={activityId}
          cerrada={isClosed}
          trimestre={vistaTrimestre.opciones.length > 1 ? filtro.trimestre : undefined}
          trimestreTerminado={filtro.hasta <= new Date()}
        />
      ),
    },
  ];

  return (
    <VistaActividad
      volver={{ href: basePath === "/tutor/capacitaciones" ? basePath : `${basePath}/${id}`, etiqueta: basePath === "/tutor/capacitaciones" ? "Capacitaciones independientes" : activity.plan.title }}
      eyebrow={`${activity.area?.name ?? "Capacitación"}${activity.programa ? ` · ${activity.programa}` : ""} · ${activity.plan.isIndependent ? "Capacitación independiente" : nombreTrimestre(filtro.trimestre, false)}`}
      titulo={activity.title}
      chips={[
        { Icono: CalendarRange, contenido: etiquetaProgramacion(activity) },
        { Icono: Users2, contenido: COURSE_AUDIENCE_LABELS[activity.targetAudience] },
        {
          Icono: conEvaluacion ? ClipboardCheck : TrendingUp,
          contenido: conEvaluacion
            ? `Evaluación presaber / postsaber · ${quiz!.questions.length} ${quiz!.questions.length === 1 ? "pregunta" : "preguntas"}`
            : "Sin evaluación todavía · se mide por asistencia",
        },
        ...(externos.length > 0 ? [{ Icono: UserPlus, contenido: `${externos.length} invitados` }] : []),
      ]}
      estado={activity.status}
      trimestres={activity.plan.isIndependent ? undefined : { opciones: vistaTrimestre.opciones, elegido: filtro.trimestre, enCurso: vistaTrimestre.enCurso }}
      acciones={
        <>
          <ActivityLifecycleActions
            status={activity.status}
            closedAtLabel={activity.closedAt ? DATETIME_FORMAT.format(activity.closedAt) : null}
            puedeReabrir={session.user.role === "ADMIN"}
            fichaCompleta={activity.plan.isIndependent || fichaCompletaParaPublicar(activity)}
            onClose={closeAction}
            onReopen={reopenAction}
            onHide={hideAction}
            onShow={showAction}
          />
          {panelEnVivo && activity.status !== "DRAFT" && (
            <Link
              href={`${basePath}/${id}/actividades/${activityId}/en-vivo${vigente ? `?s=${encodeURIComponent(vigente.tokenPublico)}` : ""}`}
              className="inline-flex items-center gap-1.5 rounded-[10px] border border-primary/35 bg-primary/8 px-3.5 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary/15"
            >
              <Radio className="h-3.5 w-3.5" aria-hidden="true" />
              Panel en vivo
            </Link>
          )}
        </>
      }
      kpis={kpis}
      pestanas={pestanas}
      pestanaInicial={buscarAsistencia || paginaParam ? "asistencia" : "jornadas"}
    />
  );
}
