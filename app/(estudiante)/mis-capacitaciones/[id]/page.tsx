import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth-helpers";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarRange,
  Building2,
  User,
  ClipboardList,
  CheckCircle2,
  CalendarClock,
  FileText,
  GraduationCap,
} from "lucide-react";
import { ModuloHero } from "@/components/training-plans/modulo-hero";
import { AnilloPorcentaje, PildoraEstado, RielTrimestres, conteoPorTrimestre } from "@/components/training-plans/plan-visual";
import {
  getTrainingPlanDetailForStudent,
  getStudentCourseProgress,
  getStudentCycleInfo,
  getSessionsForPlan,
} from "@/lib/training-plans";
import { getSurveysForUser } from "@/lib/surveys";
import { estadoPresaber, estadoPostsaber, cicloEsAutomatico } from "@/lib/presaber-postsaber";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrainingDocumentList } from "@/components/training-plans/training-document-list";
import {
  type FilaCronograma,
  type AccionProxima,
  type SesionVirtual,
} from "@/components/training-plans/cronograma-estudiante";
import { CronogramaEstudianteCompleto } from "@/components/training-plans/cronograma-estudiante-completo";
import { entrarACapacitacionAction } from "@/app/(estudiante)/mis-capacitaciones/actions";
import { EmptyState } from "@/components/brand/empty-state";
import { StaggerSections } from "@/components/brand/stagger-sections";
import { COURSE_AUDIENCE_LABELS } from "@/components/cursos/labels";
import {
  TRAINING_PLAN_STATUS_LABELS,
  TRAINING_MODALITY_LABELS,
  etiquetaProgramacion,
  etiquetaJornada,
  trimestreParaListar,
} from "@/components/training-plans/labels";

/**
 * Avisos con los que aterrizan los enlaces QR (/c/...) cuando el momento que
 * pedían no está abierto: cada enlace responde por SU momento -escanear el
 * QR de postsaber nunca abre el presaber, aunque sea la misma evaluación-.
 */
const FORMATO_HORA_SESION = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit" });

const AVISOS_QR: Record<string, string> = {
  "presaber-sin-habilitar": "El presaber de esta capacitación todavía no está habilitado. El área lo abre al iniciar la jornada; vuelve a escanear el código cuando lo anuncien.",
  "presaber-cerrado": "El presaber de esta capacitación ya cerró. Si la jornada continúa, el siguiente paso es el postsaber cuando el área lo habilite.",
  "postsaber-sin-habilitar": "El postsaber todavía no está habilitado. Se abre después de la capacitación; vuelve a escanear el código cuando el área lo anuncie.",
  "postsaber-cerrado": "El postsaber de esta capacitación ya cerró. Tu resultado quedó registrado con los intentos que presentaste.",
  "postsaber-requiere-presaber": "El postsaber se habilita al presentar primero el presaber: escanea o abre el enlace del presaber y preséntalo; el postsaber se abre solo inmediatamente después.",
  "presaber-ya-presentado": "Ya presentaste el presaber de esta capacitación: tu siguiente paso es el postsaber, con su propio enlace o código QR.",
  // Bloqueos de entrada (mismos para el QR y para el botón del cronograma).
  "sin-contenido": "Esta capacitación todavía no tiene contenido publicado. El área lo está preparando; aparecerá aquí en cuanto lo suba.",
  "no-habilitada": "Esta capacitación todavía no está disponible. Aparecerá en cuanto el área termine de programarla.",
  "jornada-cerrada": "Esta jornada ya se cerró: quedó como consulta y no admite nuevas presentaciones ni registros de asistencia.",
  "fuera-de-audiencia": "Esta capacitación está dirigida a otro grupo de personal, así que no queda registrada en tu plan.",
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
  const session = await requireSession();
  const userId = session.user.id;
  const personnelType = session.user.personnelType;

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

    // Modo AUTOMÁTICO (por defecto): presaber siempre disponible hasta
    // presentarlo; el postsaber se habilita solo al presentar el presaber.
    // Modo MANUAL: las ventanas del área mandan, como siempre. Una jornada
    // CERRADA congela el ciclo en ambos modos.
    const automatico = cicloEsAutomatico(a);
    const jornadaCerrada = a.status === "CLOSED";
    const ventanaPre = estadoPresaber(a);
    const ventanaPost = estadoPostsaber(a);

    const presaber = !conContenido
      ? null
      : cyc?.presaberDone
        ? ("Realizado" as const)
        : automatico
          ? jornadaCerrada
            ? ("Cerrado" as const)
            : ("Disponible" as const)
          : ventanaPre === "DISPONIBLE"
            ? ("Disponible" as const)
            : ventanaPre === "CERRADO"
              ? ("Cerrado" as const)
              : ("Pendiente" as const);

    const postsaber = !conContenido
      ? null
      : cyc?.postsaberDone
        ? ("Realizado" as const)
        : automatico
          ? jornadaCerrada
            ? ("Cerrado" as const)
            : cyc?.presaberDone
              ? ("Disponible" as const)
              : ("Bloqueado" as const)
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

    // La acción entra POR LA MISMA PUERTA que el QR: inscribe bajo demanda y
    // aterriza donde toca. Ya no hay parada intermedia en la ficha del curso
    // para dar un segundo clic en «Inscribirse». Solo las acciones de pura
    // consulta -contenido ya visto, jornada cerrada- siguen siendo enlaces,
    // porque no crean nada y el navegador puede prefetchearlas sin daño.
    let accion: FilaCronograma["accion"] = null;
    if (conContenido) {
      if (jornadaCerrada) {
        accion = inscrito ? { tipo: "enlace", etiqueta: "Ver contenido", href: `/aula/${a.courseId}` } : null;
      } else if (presaber === "Disponible") {
        accion = { tipo: "entrar", etiqueta: "Presentar presaber", activityId: a.id };
      } else if (postsaber === "Disponible") {
        accion = { tipo: "entrar", etiqueta: "Presentar postsaber", activityId: a.id };
      } else if (completada) {
        accion = { tipo: "enlace", etiqueta: "Ver de nuevo", href: `/aula/${a.courseId}` };
      } else {
        accion = { tipo: "entrar", etiqueta: progreso && progreso > 0 ? "Continuar" : "Empezar", activityId: a.id };
      }
    }

    return {
      id: a.id,
      titulo: a.title,
      programa: a.programa,
      area: a.area?.name ?? "Sin área",
      areaOrden: a.area?.sortOrder ?? 99,
      trimestre: trimestreParaListar(a.quarters),
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
      .map((f) => ({ tipo: "Presaber disponible", titulo: f.titulo, detalle: f.area, activityId: f.accion?.tipo === "entrar" ? f.accion.activityId : null })),
    ...filas
      .filter((f) => f.postsaber === "Disponible")
      .map((f) => ({ tipo: "Postsaber disponible", titulo: f.titulo, detalle: f.area, activityId: f.accion?.tipo === "entrar" ? f.accion.activityId : null })),
    ...proximasJornadas.slice(0, 3).map((s) => ({
      tipo: "Jornada próxima",
      titulo: s.activity.title,
      detalle: etiquetaJornada(s),
      activityId: null,
    })),
  ].slice(0, 5);

  const sesionesVirtuales: SesionVirtual[] = sesiones
    .filter((s) => s.meetingUrl && s.startsAt >= ahora && s.status !== "CLOSED")
    .slice(0, 3)
    .map((s) => ({ titulo: s.activity.title, fecha: etiquetaJornada(s), meetingUrl: s.meetingUrl! }));

  // Para el calendario del cronograma: solo jornadas de capacitaciones que le
  // aplican a ESTA persona, con la hora formateada aquí (regla del módulo:
  // nunca Intl en componentes de cliente; hidrata distinto).
  const idsAplicables = new Set(aplicables.map((a) => a.id));
  const sesionesCalendario = sesiones
    .filter((s) => idsAplicables.has(s.activity.id))
    .map((s) => ({ ...s, horaEtiqueta: FORMATO_HORA_SESION.format(s.startsAt) }));

  const metaPlan = [
    { Icono: CalendarRange, texto: String(plan.year) },
    { Icono: Building2, texto: plan.targetDepartment ?? "Todo el personal" },
    { Icono: User, texto: plan.tutor.fullName },
  ];

  return (
    <main className="canvas-formacion min-h-full flex-1">
      <div className="mx-auto w-full max-w-[1480px] px-4 py-8 sm:px-6 lg:px-8">
      <StaggerSections className="space-y-8">
        <Link
          href="/mis-capacitaciones"
          className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Mis capacitaciones
        </Link>

        {avisoQr && (
          <div className="surface-lumen flex items-start gap-3 border-l-4 border-l-warning p-5" role="status">
            <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
            <p className="text-sm text-foreground">{avisoQr}</p>
          </div>
        )}

        {/* Cabecera de mando: lo mismo que ve la gestión, contado desde
            ESTA persona -su progreso, sus evaluaciones disponibles, sus
            jornadas-. Antes eran tarjetas de vidrio casi blanco que sobre
            el lienzo claro no se distinguían. */}
        <ModuloHero
          eyebrow={`Mi plan de formación · ${plan.year}`}
          Icono={GraduationCap}
          titulo={plan.title}
          descripcion={
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <PildoraEstado estado={plan.status}>{TRAINING_PLAN_STATUS_LABELS[plan.status]}</PildoraEstado>
              {metaPlan.slice(1).map((m) => (
                <span key={m.texto} className="inline-flex items-center gap-1.5 text-white/80">
                  <m.Icono className="h-4 w-4" aria-hidden="true" />
                  {m.texto}
                </span>
              ))}
            </div>
          }
          lateral={<AnilloPorcentaje valor={progresoGeneral} tamano={112} grosor={10} oscuro etiqueta="Mi progreso" />}
          cifras={[
            { valor: filas.length, etiqueta: "Asignadas", detalle: `${completadas} completadas` },
            { valor: presaberesDisponibles, etiqueta: "Presaber disponible", detalle: presaberesDisponibles ? "listo para presentar" : "nada pendiente" },
            { valor: postsaberesDisponibles, etiqueta: "Postsaber disponible", detalle: postsaberesDisponibles ? "listo para presentar" : "nada pendiente" },
            { valor: proximasJornadas.length, etiqueta: "Próximas jornadas", detalle: "en los próximos 30 días" },
          ]}
          pie={
            aplicables.length > 0 ? (
              <div className="space-y-2">
                <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-white/55">Mis capacitaciones por trimestre</p>
                <RielTrimestres conteos={conteoPorTrimestre(aplicables)} oscuro conMeses />
              </div>
            ) : undefined
          }
        />


        <Tabs defaultValue="cronograma">
          {/* Control segmentado, igual que el selector de vistas del propio
              cronograma: dos filas de pestañas con estilos distintos hacían
              parecer que una era del sistema y la otra del contenido. */}
          <TabsList className="plan-tabs">
            {[
              { valor: "cronograma", etiqueta: "Cronograma", Icono: CalendarRange, conteo: filas.length },
              { valor: "documentos", etiqueta: "Documentos", Icono: FileText, conteo: plan.documents.length },
              { valor: "encuestas", etiqueta: "Evaluaciones", Icono: ClipboardList, conteo: pending.length },
            ].map((t) => (
              <TabsTrigger key={t.valor} value={t.valor}>
                <t.Icono aria-hidden="true" />
                {t.etiqueta}
                <span className="conteo">{t.conteo}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="cronograma" className="pt-4">
            <CronogramaEstudianteCompleto
              onEntrar={entrarACapacitacionAction.bind(null, id)}
              filas={filas}
              acciones={acciones}
              sesionesVirtuales={sesionesVirtuales}
              activities={aplicables}
              sessions={sesionesCalendario}
              planId={id}
            />
          </TabsContent>

          <TabsContent value="documentos" className="pt-4">
            <TrainingDocumentList documents={plan.documents} />
          </TabsContent>

          <TabsContent value="encuestas" className="space-y-6 pt-4">
            <div className="space-y-3">
              <h2 className="mono-label">Pendientes</h2>
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
                      href={`/evaluaciones/${survey.id}`}
                      className="actividad-item flex items-center gap-3 p-4 pl-5"
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
              <h2 className="mono-label">Respondidas</h2>
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
      </div>
    </main>
  );
}
