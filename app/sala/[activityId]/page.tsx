import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  User,
  Target,
  ListChecks,
  Users2,
  CalendarClock,
  Video,
  CircleDot,
} from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SalaVirtual } from "@/components/training-plans/sala-virtual";
import { GrabacionJornada } from "@/components/training-plans/grabacion-jornada";
import { AbrirEvaluacionPopup } from "@/components/training-plans/abrir-evaluacion-popup";
import { getMomentoParaUsuario } from "@/lib/training-plans";
import { firmarTokenJitsi } from "@/lib/jitsi";
import { etiquetaJornada } from "@/components/training-plans/labels";
import { COURSE_AUDIENCE_LABELS } from "@/components/cursos/labels";

/**
 * SALA VIRTUAL INTEGRADA de una capacitación del plan: la videollamada
 * embebida (Jitsi) junto al informe de la jornada -qué área la genera, qué
 * profesional responde por ella, objetivo, metodología y programación-.
 *
 * Exige sesión iniciada a propósito: como quien entra está identificado, el
 * ingreso a la sala registra su ASISTENCIA automáticamente, igual que
 * ocurre al abrir la evaluación. La sala de Meet externa no podía dar eso.
 */
export default async function SalaVirtualPage({ params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/login?callbackUrl=${encodeURIComponent(`/sala/${activityId}`)}`);

  const actividad = await prisma.trainingActivity.findUnique({
    where: { id: activityId },
    select: {
      id: true,
      title: true,
      status: true,
      courseId: true,
      objective: true,
      methodology: true,
      targetAudience: true,
      targetAudienceNote: true,
      responsibleLabel: true,
      responsibleUser: { select: { fullName: true } },
      area: { select: { name: true, tutor: { select: { fullName: true } } } },
      plan: { select: { id: true, title: true } },
      sessions: {
        where: { status: { not: "CLOSED" } },
        orderBy: { startsAt: "asc" },
        take: 1,
        select: { startsAt: true, endsAt: true },
      },
    },
  });
  if (!actividad) notFound();

  // Asistencia automática: entrar a la sala ES presentarse a la jornada.
  // Efecto secundario del render, nunca debe tumbar la sala.
  if (actividad.status !== "CLOSED") {
    try {
      await prisma.trainingAttendance.upsert({
        where: { activityId_userId: { activityId, userId: session.user.id } },
        update: { attended: true },
        create: { activityId, userId: session.user.id, attended: true, source: "AUTOMATIC" },
      });
    } catch (error) {
      console.error("No se pudo registrar la asistencia a la sala:", error);
    }
  }

  const profesional =
    actividad.area?.tutor?.fullName ?? actividad.responsibleUser?.fullName ?? actividad.responsibleLabel ?? "—";

  // Evaluación del ciclo de ESTA persona, para presentarla en ventana
  // emergente SIN salirse de la llamada. Solo estudiantes con curso montado.
  const esEstudiante = session.user.role === "STUDENT";
  let evaluacion: { quizId: string; momento: "PRESABER" | "POSTSABER" | null; preHecho: boolean; postHecho: boolean } | null = null;
  if (esEstudiante && actividad.courseId) {
    const quizFinal = await prisma.quiz.findFirst({
      where: { courseId: actividad.courseId, moduleId: null, isActive: true },
      select: { id: true },
    });
    if (quizFinal) {
      const { momento } = await getMomentoParaUsuario(quizFinal.id, session.user.id);
      const hechos = await prisma.quizAttempt.findMany({
        where: { quizId: quizFinal.id, userId: session.user.id, moment: { not: null }, score: { not: null } },
        select: { moment: true },
      });
      evaluacion = {
        quizId: quizFinal.id,
        momento,
        preHecho: hechos.some((h) => h.moment === "PRESABER"),
        postHecho: hechos.some((h) => h.moment === "POSTSABER"),
      };
    }
  }
  const puedeGrabar = session.user.role === "ADMIN" || session.user.role === "TUTOR";
  const jitsiDomain = process.env.NEXT_PUBLIC_JITSI_DOMAIN ?? "meet.jit.si";
  // Todo el personal entra AUTENTICADO a la sala (token de la plataforma);
  // los externos del enlace /invitado entran sin token, como invitados.
  const tokenSala = await firmarTokenJitsi(session.user.name ?? "Participante");
  const proximaJornada = actividad.sessions[0] ? etiquetaJornada(actividad.sessions[0]) : null;

  const FICHA = [
    { icon: Building2, etiqueta: "Área que la genera", valor: actividad.area?.name ?? "Sin área" },
    { icon: User, etiqueta: "Profesional responsable", valor: profesional },
    { icon: Users2, etiqueta: "Dirigida a", valor: actividad.targetAudienceNote ?? COURSE_AUDIENCE_LABELS[actividad.targetAudience] },
    ...(proximaJornada ? [{ icon: CalendarClock, etiqueta: "Jornada", valor: proximaJornada }] : []),
  ];

  return (
    <main className="aula-canvas min-h-screen">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Link
            href={`/mis-capacitaciones/${actividad.plan.id}`}
            className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {actividad.plan.title}
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-success/25 bg-success/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-success">
            <CircleDot className="h-3 w-3 animate-pulse" aria-hidden="true" />
            Sala en vivo
          </span>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-3">
            <div className="surface-glass surface-accent-top px-5 py-4">
              <h1 className="flex items-center gap-2 font-display text-lg font-extrabold leading-snug text-foreground">
                <Video className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                {actividad.title}
              </h1>
            </div>
            <SalaVirtual
              domain={jitsiDomain}
              roomName={`RedSaludTeForma-${actividad.id}`}
              displayName={session.user.name ?? "Participante"}
              subject={actividad.title}
              jwt={tokenSala}
            />
            {puedeGrabar && <GrabacionJornada activityId={actividad.id} />}
            <p className="text-xs text-muted-foreground">
              Tu ingreso quedó registrado en la lista de asistencia de la jornada.
            </p>
          </div>

          {/* Informe de la capacitación */}
          <aside className="space-y-4">
            {evaluacion && (
              <section className="surface-glass space-y-3 p-5">
                <h2 className="font-display text-xs font-bold uppercase tracking-wide text-foreground">Tu evaluación</h2>
                {[
                  { etiqueta: "Presaber", hecho: evaluacion.preHecho, activo: evaluacion.momento === "PRESABER" },
                  { etiqueta: "Postsaber", hecho: evaluacion.postHecho, activo: evaluacion.momento === "POSTSABER" },
                ].map((m) => (
                  <div key={m.etiqueta} className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold text-foreground">{m.etiqueta}</span>
                    {m.hecho ? (
                      <span className="text-xs font-semibold text-success">Presentado</span>
                    ) : m.activo ? (
                      <AbrirEvaluacionPopup
                        // Por el enlace /c: auto-inscribe y valida audiencia,
                        // igual que el QR del cartel. Directo al aula fallaría
                        // para quien nunca ha abierto el curso.
                        href={`/c/${actividad.id}/${m.etiqueta === "Presaber" ? "presaber" : "postsaber"}`}
                        etiqueta={`Presentar ${m.etiqueta.toLowerCase()}`}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">Aún no disponible</span>
                    )}
                  </div>
                ))}
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Se abre en una ventana aparte: no te saca de la llamada.
                </p>
              </section>
            )}
            <section className="surface-glass space-y-3 p-5">
              <h2 className="font-display text-xs font-bold uppercase tracking-wide text-foreground">
                Informe de la capacitación
              </h2>
              {FICHA.map((f) => (
                <div key={f.etiqueta} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <f.icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{f.etiqueta}</p>
                    <p className="text-[13px] font-medium leading-snug text-foreground">{f.valor}</p>
                  </div>
                </div>
              ))}
            </section>

            {actividad.objective && (
              <section className="surface-glass space-y-2 p-5">
                <h2 className="flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-wide text-foreground">
                  <Target className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  Objetivo
                </h2>
                <p className="text-[13px] leading-relaxed text-muted-foreground">{actividad.objective}</p>
              </section>
            )}

            {actividad.methodology && (
              <section className="surface-glass space-y-2 p-5">
                <h2 className="flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-wide text-foreground">
                  <ListChecks className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  Metodología
                </h2>
                <p className="text-[13px] leading-relaxed text-muted-foreground">{actividad.methodology}</p>
              </section>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
