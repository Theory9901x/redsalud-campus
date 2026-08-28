import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  User,
  Target,
  ListChecks,
  Users2,
  CalendarClock,
  Video,
  CircleDot,
  ChevronRight,
  ShieldCheck,
  FileText,
} from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SalaVirtual } from "@/components/training-plans/sala-virtual";
import { NavSala } from "@/components/training-plans/nav-sala";
import { GrabacionJornada } from "@/components/training-plans/grabacion-jornada";
import { AbrirEvaluacionPopup } from "@/components/training-plans/abrir-evaluacion-popup";
import { ThemeToggle } from "@/components/brand/theme-toggle";
import { getMomentoParaUsuario } from "@/lib/training-plans";
import { firmarTokenJitsi } from "@/lib/jitsi";
import { etiquetaJornada } from "@/components/training-plans/labels";
import { COURSE_AUDIENCE_LABELS } from "@/components/cursos/labels";

/**
 * SALA VIRTUAL INTEGRADA de una capacitación del plan: la videollamada
 * embebida (Jitsi) con la barra de controles de la plataforma, junto al
 * informe de la jornada -qué área la genera, qué profesional responde por
 * ella, objetivo, metodología y programación-.
 *
 * Exige sesión iniciada a propósito: como quien entra está identificado, el
 * ingreso a la sala registra su ASISTENCIA automáticamente, igual que
 * ocurre al abrir la evaluación.
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

  const esPersonal = session.user.role === "ADMIN" || session.user.role === "TUTOR";
  const jitsiDomain = process.env.NEXT_PUBLIC_JITSI_DOMAIN ?? "meet.jit.si";
  const tokenSala = await firmarTokenJitsi(session.user.name ?? "Participante");
  const proximaJornada = actividad.sessions[0] ? etiquetaJornada(actividad.sessions[0]) : null;
  const nombre = session.user.name ?? "Participante";
  const inicialesUsuario = nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

  const volverHref = esPersonal
    ? `/tutor/planes-capacitacion/${actividad.plan.id}/actividades/${actividad.id}`
    : `/mis-capacitaciones/${actividad.plan.id}`;

  const FICHA = [
    { icon: Building2, etiqueta: "Área que la genera", valor: actividad.area?.name ?? "Sin área" },
    { icon: User, etiqueta: "Profesional responsable", valor: profesional },
    { icon: Users2, etiqueta: "Dirigida a", valor: actividad.targetAudienceNote ?? COURSE_AUDIENCE_LABELS[actividad.targetAudience] },
    ...(proximaJornada ? [{ icon: CalendarClock, etiqueta: "Jornada", valor: proximaJornada }] : []),
  ];

  return (
    <main className="aula-canvas min-h-screen">
      <div className="mx-auto w-full max-w-[1560px] px-3 py-4 sm:px-5 lg:px-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
          {/* Barra lateral de la sala */}
          <div className="hidden lg:block">
            <NavSala archivosHref={volverHref} conGrabacion={esPersonal} />
          </div>

          {/* Columna principal */}
          <div className="min-w-0 space-y-4">
            <header className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <nav aria-label="Ruta" className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                  <Link href={volverHref} className="hover:text-foreground">
                    Capacitaciones
                  </Link>
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="text-foreground">Sala de reunión</span>
                </nav>
                <div className="mt-1.5 flex flex-wrap items-center gap-3">
                  <h1 className="font-display text-[clamp(1.25rem,2.4vw,1.7rem)] font-extrabold leading-tight tracking-tight text-foreground">
                    {actividad.title}
                  </h1>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11.5px] font-bold text-primary">
                    <Video className="h-3.5 w-3.5" aria-hidden="true" />
                    Sala activa
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-success/25 bg-success/10 px-3 py-1.5 text-[11.5px] font-bold uppercase tracking-wide text-success">
                  <CircleDot className="h-3 w-3 animate-pulse" aria-hidden="true" />
                  Sala en vivo
                </span>
                <div className="surface-glass flex items-center gap-1 px-2 py-1">
                  <ThemeToggle />
                  <span
                    className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-primary to-success text-[12px] font-extrabold text-white"
                    title={nombre}
                  >
                    {inicialesUsuario || "?"}
                  </span>
                </div>
              </div>
            </header>

            <SalaVirtual
              domain={jitsiDomain}
              roomName={`RedSaludTeForma-${actividad.id}`}
              activityId={actividad.id}
              displayName={nombre}
              subject={actividad.title}
              jwt={tokenSala}
              esPresentador={esPersonal}
              grabacion={esPersonal ? <GrabacionJornada activityId={actividad.id} /> : undefined}
              panelDerecho={
                <div id="informe" className="space-y-4 scroll-mt-24">
            {evaluacion && (
              <section className="surface-glass space-y-3 p-5">
                <h2 className="font-display text-[14px] font-bold text-foreground">Tu evaluación</h2>
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
              <h2 className="flex items-center gap-2 font-display text-[14px] font-bold text-foreground">
                <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
                Informe de la capacitación
              </h2>
              {FICHA.map((f) => (
                <div key={f.etiqueta} className="flex items-start gap-3 rounded-xl bg-card/50 p-2.5">
                  <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <f.icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold text-foreground">{f.etiqueta}</p>
                    <p className="text-[12.5px] leading-snug text-muted-foreground">{f.valor}</p>
                  </div>
                </div>
              ))}
            </section>

            {actividad.objective && (
              <section className="surface-glass space-y-2 p-5">
                <h2 className="flex items-center gap-2 font-display text-[14px] font-bold text-foreground">
                  <Target className="h-4 w-4 text-primary" aria-hidden="true" />
                  Objetivo
                </h2>
                <p className="text-[13px] leading-relaxed text-muted-foreground">{actividad.objective}</p>
              </section>
            )}

            {actividad.methodology && (
              <section className="surface-glass space-y-2 p-5">
                <h2 className="flex items-center gap-2 font-display text-[14px] font-bold text-foreground">
                  <ListChecks className="h-4 w-4 text-primary" aria-hidden="true" />
                  Metodología
                </h2>
                <p className="text-[13px] leading-relaxed text-muted-foreground">{actividad.methodology}</p>
              </section>
            )}
                </div>
              }
            />

            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-success" aria-hidden="true" />
              Tu ingreso quedó registrado en la lista de asistencia de la jornada.
            </p>
          </div>

        </div>
      </div>
    </main>
  );
}
