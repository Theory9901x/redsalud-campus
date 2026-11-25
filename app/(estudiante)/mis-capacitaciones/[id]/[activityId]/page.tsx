import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarRange, Check, ClipboardCheck, FileText, Lock, MonitorPlay, PlayCircle, Target, Users2 } from "lucide-react";
import { requireSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { veComoAdmin } from "@/lib/roles";
import { ensureEnrollment, getStudentCycleInfo } from "@/lib/training-plans";
import { cicloEsAutomatico, estadoPostsaber, estadoPresaber } from "@/lib/presaber-postsaber";
import { COURSE_AUDIENCE_LABELS } from "@/components/cursos/labels";
import { TRAINING_MODALITY_LABELS, etiquetaTrimestres, tituloLegible } from "@/components/training-plans/labels";

export const dynamic = "force-dynamic";

/** Un paso del recorrido: número (o visto / candado), título y su contenido. */
function Paso({ numero, titulo, estado, children }: { numero: number; titulo: string; estado: "hecho" | "actual" | "bloqueado" | "libre"; children: React.ReactNode }) {
  return (
    <section className="cap-paso" data-estado={estado}>
      <header>
        <span className="cap-numero" aria-hidden="true">
          {estado === "hecho" ? <Check className="h-4 w-4" /> : estado === "bloqueado" ? <Lock className="h-3.5 w-3.5" /> : numero}
        </span>
        <h2>{titulo}</h2>
      </header>
      <div className="cap-paso-cuerpo">{children}</div>
    </section>
  );
}

/**
 * UNA CAPACITACIÓN A RITMO PROPIO, para quien la toma: toda su información y
 * su contenido en una sola página, en el orden en que se hace.
 *
 *   1. Presaber   → la evaluación antes de ver nada.
 *   2. Contenido  → el video EMBEBIDO (se ve aquí mismo), las diapositivas y
 *                   las lecturas.
 *   3. Postsaber  → la misma evaluación, después.
 *
 * El contenido se abre al presentar el presaber: si la persona ve el video
 * primero, el presaber ya no mide lo que sabía. Quien administra o dicta la
 * capacitación la ve completa siempre, para revisarla.
 *
 * Entrar aquí inscribe a la persona y deja su rastro de asistencia, igual que
 * el QR o el enlace (lib/training-plans, ensureEnrollment).
 */
export default async function CapacitacionPage({ params }: { params: Promise<{ id: string; activityId: string }> }) {
  const { id, activityId } = await params;
  const session = await requireSession(`/mis-capacitaciones/${id}/${activityId}`);
  const gestiona = veComoAdmin(session.user.role) || session.user.role === "TUTOR";

  const a = await prisma.trainingActivity.findFirst({
    where: { id: activityId, planId: id, plan: { kind: "CAPACITACION" } },
    select: {
      title: true,
      status: true,
      manuallyHidden: true,
      programa: true,
      objective: true,
      modality: true,
      quarters: true,
      targetAudience: true,
      isRequired: true,
      courseId: true,
      presaberOpenedAt: true,
      presaberClosedAt: true,
      postsaberOpenedAt: true,
      postsaberClosedAt: true,
      area: { select: { name: true } },
      plan: { select: { title: true, isIndependent: true } },
      course: {
        select: {
          shortDescription: true,
          esContenedorCapacitacion: true,
          quizzes: { where: { moduleId: null, isActive: true }, take: 1, select: { passingScore: true, _count: { select: { questions: { where: { isActive: true } } } } } },
          modules: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
            select: {
              lessons: {
                where: { isActive: true },
                orderBy: { sortOrder: "asc" },
                select: { id: true, title: true, description: true, contentType: true, fileUrl: true, videoUrl: true, externalUrl: true, estimatedMinutes: true },
              },
            },
          },
        },
      },
    },
  });
  if (!a) notFound();
  // Sin publicar solo la ve quien la gestiona (para revisarla antes de mostrarla).
  if (!gestiona && (a.status === "DRAFT" || a.manuallyHidden)) notFound();

  const volver = `/mis-capacitaciones/${id}`;
  if (!gestiona) {
    const entrada = await ensureEnrollment(session.user.id, activityId);
    if (!entrada.ok && entrada.motivo === "FUERA_DE_AUDIENCIA") redirect(`${volver}?aviso=fuera-de-audiencia`);
  }

  const lecciones = a.course?.modules.flatMap((m) => m.lessons) ?? [];
  const quiz = a.course?.quizzes[0] ?? null;
  const conEvaluacion = !!quiz && quiz._count.questions > 0;
  const ciclo = a.courseId ? (await getStudentCycleInfo([a.courseId], session.user.id)).get(a.courseId) : undefined;
  const notas = a.courseId
    ? await prisma.quizAttempt.groupBy({
        by: ["moment"],
        where: { userId: session.user.id, score: { not: null }, finishedAt: { not: null }, quiz: { courseId: a.courseId, moduleId: null } },
        _max: { score: true },
      })
    : [];
  const nota = (m: "PRESABER" | "POSTSABER") => notas.find((n) => n.moment === m)?._max.score ?? null;

  const cerrada = a.status === "CLOSED";
  const automatico = cicloEsAutomatico(a);
  const preHecho = !!ciclo?.presaberDone;
  const postHecho = !!ciclo?.postsaberDone;
  const preAbierto = conEvaluacion && !preHecho && !cerrada && (automatico || estadoPresaber(a) === "DISPONIBLE");
  const postAbierto = conEvaluacion && !postHecho && !cerrada && (automatico ? preHecho : estadoPostsaber(a) === "DISPONIBLE");
  // El contenido se abre con el presaber presentado (o si no hay evaluación).
  const contenidoAbierto = gestiona || !conEvaluacion || preHecho;

  const datos = [
    { Icono: CalendarRange, texto: a.plan.isIndependent ? "Capacitación del área" : (etiquetaTrimestres(a.quarters) ?? a.plan.title) },
    { Icono: MonitorPlay, texto: TRAINING_MODALITY_LABELS[a.modality] },
    { Icono: Users2, texto: COURSE_AUDIENCE_LABELS[a.targetAudience] },
    ...(a.isRequired ? [{ Icono: Check, texto: "Obligatoria" }] : []),
  ];

  return (
    <main className="canvas-formacion min-h-full flex-1">
      <div className="cap mx-auto w-full max-w-[1040px] space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <Link href={volver} className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {a.plan.title}
        </Link>

        <header>
          <p className="text-sm font-semibold text-primary">{[a.area?.name, a.programa].filter(Boolean).join(" · ") || "Capacitación"}</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold leading-tight tracking-tight text-foreground sm:text-4xl">{tituloLegible(a.title)}</h1>
          <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
            {datos.map((d) => (
              <span key={d.texto} className="inline-flex items-center gap-1.5">
                <d.Icono className="h-4 w-4" aria-hidden="true" />
                {d.texto}
              </span>
            ))}
          </p>
          {(a.objective || a.course?.shortDescription) && (
            <p className="mt-4 flex max-w-3xl items-start gap-2.5 text-[15px] leading-relaxed text-foreground">
              <Target className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              {a.objective ?? a.course?.shortDescription}
            </p>
          )}
          {gestiona && (a.status === "DRAFT" || a.manuallyHidden) && (
            <p className="mt-4 rounded-lg border border-warning/50 bg-warning/15 px-3 py-2 text-sm font-medium text-foreground">
              Vista de revisión: esta capacitación aún no está publicada; el personal no la ve.
            </p>
          )}
        </header>

        {conEvaluacion && (
          <Paso numero={1} titulo="Presaber" estado={preHecho ? "hecho" : preAbierto ? "actual" : "bloqueado"}>
            <p>
              {preHecho
                ? `Ya lo presentaste${nota("PRESABER") !== null ? `: ${nota("PRESABER")} %` : ""}.`
                : `Antes de ver el contenido, responde ${quiz!._count.questions} preguntas para saber qué tanto conoces del tema. No afecta tu aprobación.`}
            </p>
            {preAbierto && (
              <a href={`/c/${activityId}/presaber`} className="btn-agenda" data-variante="principal">
                Presentar presaber
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            )}
            {!preHecho && !preAbierto && <p className="cap-nota">{cerrada ? "La capacitación ya cerró." : "Todavía no está habilitado."}</p>}
          </Paso>
        )}

        <Paso numero={conEvaluacion ? 2 : 1} titulo="Video y material" estado={!contenidoAbierto ? "bloqueado" : conEvaluacion && preHecho && !postHecho ? "actual" : "libre"}>
          {!contenidoAbierto ? (
            <p className="cap-nota">Se abre cuando presentes el presaber.</p>
          ) : lecciones.length === 0 ? (
            <p className="cap-nota">Esta capacitación no tiene material publicado.</p>
          ) : (
            <div className="space-y-6">
              {lecciones.map((l) => (
                <article key={l.id} className="cap-leccion">
                  <h3>
                    {l.contentType === "VIDEO" || l.contentType === "YOUTUBE" ? <PlayCircle className="h-5 w-5 text-primary" aria-hidden="true" /> : <FileText className="h-5 w-5 text-primary" aria-hidden="true" />}
                    {l.title}
                    {l.estimatedMinutes ? <span>{l.estimatedMinutes} min</span> : null}
                  </h3>
                  {l.description && <p className="text-sm text-muted-foreground">{l.description}</p>}
                  {l.contentType === "VIDEO" && l.fileUrl && (
                    <div className="cap-video">
                      <video controls preload="metadata" playsInline controlsList="nodownload" src={l.fileUrl}>
                        Tu navegador no puede reproducir este video.
                      </video>
                    </div>
                  )}
                  {l.contentType === "YOUTUBE" && l.videoUrl && (
                    <a href={l.videoUrl} target="_blank" rel="noreferrer" className="btn-agenda" data-variante="secundario">
                      Ver el video
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </a>
                  )}
                  {l.contentType === "PDF" && l.fileUrl && (
                    <>
                      <div className="cap-pdf">
                        <iframe src={`${l.fileUrl}#view=FitH&navpanes=0`} title={l.title} loading="lazy" />
                      </div>
                      <a href={l.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                        Abrir en pantalla completa
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </a>
                    </>
                  )}
                  {l.contentType === "IMAGE" && l.fileUrl && (
                    // eslint-disable-next-line @next/next/no-img-element -- archivo privado servido por /api/media
                    <img src={l.fileUrl} alt={l.title} className="w-full rounded-xl border border-border" />
                  )}
                  {l.externalUrl && (
                    <a href={l.externalUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                      Abrir el enlace
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </a>
                  )}
                </article>
              ))}
            </div>
          )}
        </Paso>

        {conEvaluacion && (
          <Paso numero={3} titulo="Postsaber" estado={postHecho ? "hecho" : postAbierto ? "actual" : "bloqueado"}>
            <p>
              {postHecho
                ? `Ya lo presentaste${nota("POSTSABER") !== null ? `: ${nota("POSTSABER")} %` : ""}.`
                : `Después de ver el contenido, responde las mismas preguntas. Se aprueba con ${quiz!.passingScore} %.`}
            </p>
            {postAbierto && (
              <a href={`/c/${activityId}/postsaber`} className="btn-agenda" data-variante="principal">
                <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                Presentar postsaber
              </a>
            )}
            {!postHecho && !postAbierto && <p className="cap-nota">{cerrada ? "La capacitación ya cerró." : "Se habilita cuando presentes el presaber."}</p>}
          </Paso>
        )}
      </div>
    </main>
  );
}
