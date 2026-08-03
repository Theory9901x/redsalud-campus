import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarRange,
  Building2,
  User,
  ClipboardList,
  CheckCircle2,
  CalendarClock,
  FileQuestion,
  ClipboardCheck,
  TrendingUp,
} from "lucide-react";
import { auth } from "@/auth";
import {
  getTrainingPlanDetailForStudent,
  getStudentCourseProgress,
  getStudentCycleInfo,
  getSessionsForPlan,
} from "@/lib/training-plans";
import { getSurveysForUser } from "@/lib/surveys";
import { estadoPresaber, estadoPostsaber } from "@/lib/presaber-postsaber";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrainingDocumentList } from "@/components/training-plans/training-document-list";
import {
  CronogramaEstudiante,
  type FilaCronograma,
  type AccionProxima,
  type SesionVirtual,
} from "@/components/training-plans/cronograma-estudiante";
import { MetricCard } from "@/components/admin/metric-card";
import { StaggerGrid } from "@/components/brand/stagger-grid";
import { EmptyState } from "@/components/brand/empty-state";
import { StaggerSections } from "@/components/brand/stagger-sections";
import { COURSE_AUDIENCE_LABELS } from "@/components/cursos/labels";
import {
  TRAINING_PLAN_STATUS_LABELS,
  TRAINING_PLAN_STATUS_CLASSES,
  TRAINING_MODALITY_LABELS,
  etiquetaProgramacion,
  etiquetaJornada,
} from "@/components/training-plans/labels";

/**
 * Avisos con los que aterrizan los enlaces QR (/c/...) cuando el momento que
 * pedían no está abierto: cada enlace responde por SU momento -escanear el
 * QR de postsaber nunca abre el presaber, aunque sea la misma evaluación-.
 */
const AVISOS_QR: Record<string, string> = {
  "presaber-sin-habilitar": "El presaber de esta capacitación todavía no está habilitado. El área lo abre al iniciar la jornada; vuelve a escanear el código cuando lo anuncien.",
  "presaber-cerrado": "El presaber de esta capacitación ya cerró. Si la jornada continúa, el siguiente paso es el postsaber cuando el área lo habilite.",
  "postsaber-sin-habilitar": "El postsaber todavía no está habilitado. Se abre después de la capacitación; vuelve a escanear el código cuando el área lo anuncie.",
  "postsaber-cerrado": "El postsaber de esta capacitación ya cerró. Tu resultado quedó registrado con los intentos que presentaste.",
};

export default async function MiCapacitacionDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aviso?: string }>;
}) {
  const { id } = await params;
  const { aviso } = await searchParams;
  const avisoQr = aviso ? AVISOS_QR[aviso] ?? null : null;
  const session = await auth();
  const userId = session!.user.id;
  const personnelType = session!.user.personnelType;

  const plan = await getTrainingPlanDetailForStudent(id, userId);
  if (!plan) notFound();

  // Solo lo que le aplica a ESTA persona: su cronograma, no el del área de
  // gestión. Lo dirigido exclusivamente al otro grupo poblacional no es una
  // capacitación suya y mostrarla solo confundiría ("¿debo hacer esto?").
  const aplicables = plan.activities.filter(
    (a) => a.targetAudience === "AMBOS" || a.targetAudience === personnelType
  );

  const courseIds = aplicables.map((a) => a.courseId).filter((x): x is string => !!x);
  const [{ pending, answered }, progresoPorCurso, ciclo, sesiones] = await Promise.all([
    getSurveysForUser(userId, id),
    getStudentCourseProgress(courseIds, userId),
    getStudentCycleInfo(courseIds, userId),
    getSessionsForPlan(id),
  ]);

  // ---- Cada fila del cronograma, resuelta con datos reales ----------------
  const filas: FilaCronograma[] = aplicables.map((a) => {
    const avance = a.courseId ? progresoPorCurso.get(a.courseId) : undefined;
    const cyc = a.courseId ? ciclo.get(a.courseId) : undefined;
    const conContenido = !!avance;
    const inscrito = !!avance?.enrollment;
    const completada = avance?.enrollment?.status === "COMPLETED";
    const progreso = inscrito ? avance!.enrollment!.progressPercentage : null;

    const ventanaPre = estadoPresaber(a);
    const ventanaPost = estadoPostsaber(a);

    const presaber = !conContenido
      ? null
      : cyc?.presaberDone
        ? ("Realizado" as const)
        : ventanaPre === "DISPONIBLE"
          ? ("Disponible" as const)
          : ventanaPre === "CERRADO"
            ? ("Cerrado" as const)
            : ("Pendiente" as const);

    const postsaber = !conContenido
      ? null
      : cyc?.postsaberDone
        ? ("Realizado" as const)
        : ventanaPost === "DISPONIBLE"
          ? ("Disponible" as const)
          : ventanaPost === "CERRADO"
            ? ("Cerrado" as const)
            : ("Bloqueado" as const);

    const estadoGeneral: FilaCronograma["estadoGeneral"] = !conContenido
      ? "Sin contenido"
      : completada
        ? "Completada"
        : presaber === "Disponible"
          ? "Presaber disponible"
          : postsaber === "Disponible"
            ? "Postsaber disponible"
            : progreso !== null && progreso > 0
              ? "En curso"
              : "Programada";

    let accion: FilaCronograma["accion"] = null;
    if (conContenido) {
      if (inscrito && presaber === "Disponible" && cyc) {
        accion = { etiqueta: "Presentar presaber", href: `/aula/${a.courseId}/quiz/${cyc.quizId}` };
      } else if (inscrito && postsaber === "Disponible" && cyc) {
        accion = { etiqueta: "Presentar postsaber", href: `/aula/${a.courseId}/quiz/${cyc.quizId}` };
      } else if (inscrito && !completada) {
        accion = { etiqueta: progreso && progreso > 0 ? "Continuar" : "Empezar", href: `/aula/${a.courseId}` };
      } else if (inscrito && completada) {
        accion = { etiqueta: "Ver de nuevo", href: `/aula/${a.courseId}` };
      } else {
        accion = { etiqueta: "Ver curso", href: `/cursos/${avance!.course.slug}` };
      }
    }

    return {
      id: a.id,
      titulo: a.title,
      programa: a.programa,
      area: a.area?.name ?? "Sin área",
      areaOrden: a.area?.sortOrder ?? 99,
      trimestre: a.quarters.length > 0 ? Math.min(...a.quarters) : 0,
      programacion: etiquetaProgramacion(a),
      modalidad: a.modality ? TRAINING_MODALITY_LABELS[a.modality] : null,
      publico: COURSE_AUDIENCE_LABELS[a.targetAudience],
      conContenido,
      inscrito,
      progreso,
      estadoGeneral,
      presaber,
      postsaber,
      accion,
    };
  });

  // ---- KPI reales ---------------------------------------------------------
  const ahora = new Date();
  const en30Dias = new Date(ahora.getTime() + 30 * 86400000);
  const proximasJornadas = sesiones.filter((s) => s.startsAt >= ahora && s.startsAt <= en30Dias);
  const presaberesDisponibles = filas.filter((f) => f.presaber === "Disponible").length;
  const postsaberesDisponibles = filas.filter((f) => f.postsaber === "Disponible").length;
  const completadas = filas.filter((f) => f.estadoGeneral === "Completada").length;
  const inscritas = filas.filter((f) => f.progreso !== null);
  const progresoGeneral =
    inscritas.length > 0 ? Math.round(inscritas.reduce((s, f) => s + (f.progreso ?? 0), 0) / inscritas.length) : 0;

  // ---- Próximas acciones y sesiones virtuales, reales ---------------------
  const acciones: AccionProxima[] = [
    ...filas
      .filter((f) => f.presaber === "Disponible")
      .map((f) => ({ tipo: "Presaber disponible", titulo: f.titulo, detalle: f.area, href: f.accion?.href ?? null })),
    ...filas
      .filter((f) => f.postsaber === "Disponible")
      .map((f) => ({ tipo: "Postsaber disponible", titulo: f.titulo, detalle: f.area, href: f.accion?.href ?? null })),
    ...proximasJornadas.slice(0, 3).map((s) => ({
      tipo: "Jornada próxima",
      titulo: s.activity.title,
      detalle: etiquetaJornada(s),
      href: null,
    })),
  ].slice(0, 5);

  const sesionesVirtuales: SesionVirtual[] = sesiones
    .filter((s) => s.meetingUrl && s.startsAt >= ahora && s.status !== "CLOSED")
    .slice(0, 3)
    .map((s) => ({ titulo: s.activity.title, fecha: etiquetaJornada(s), meetingUrl: s.meetingUrl! }));

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
      <StaggerSections className="space-y-6">
        <Link
          href="/mis-capacitaciones"
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Mis capacitaciones
        </Link>

        {avisoQr && (
          <div className="surface flex items-start gap-3 border-l-4 border-l-warning p-4" role="status">
            <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
            <p className="text-sm text-foreground">{avisoQr}</p>
          </div>
        )}

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
        </div>

        <StaggerGrid className="grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          <MetricCard label="Capacitaciones asignadas" value={filas.length} icon={ClipboardList} accent="primary" />
          <MetricCard label="Próximas jornadas" value={proximasJornadas.length} icon={CalendarClock} accent="warning" />
          <MetricCard label="Presaberes disponibles" value={presaberesDisponibles} icon={FileQuestion} accent="warning" />
          <MetricCard label="Postsaberes disponibles" value={postsaberesDisponibles} icon={ClipboardCheck} accent="primary" />
          <MetricCard label="Completadas" value={completadas} icon={CheckCircle2} accent="success" />
          <MetricCard label="Progreso general" value={progresoGeneral} suffix="%" icon={TrendingUp} accent="success" />
        </StaggerGrid>

        <Tabs defaultValue="cronograma">
          <TabsList>
            <TabsTrigger value="cronograma">Cronograma</TabsTrigger>
            <TabsTrigger value="documentos">Documentos</TabsTrigger>
            <TabsTrigger value="encuestas">Evaluaciones</TabsTrigger>
          </TabsList>

          <TabsContent value="cronograma" className="pt-4">
            <CronogramaEstudiante filas={filas} acciones={acciones} sesionesVirtuales={sesionesVirtuales} />
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
