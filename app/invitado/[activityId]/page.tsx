import { notFound } from "next/navigation";
import {
  Building2,
  User,
  Target,
  Users2,
  CalendarClock,
  Video,
  CircleDot,
  FileQuestion,
  ClipboardCheck,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { estadoPresaber, estadoPostsaber, momentoParaPersona, cicloEsAutomatico } from "@/lib/presaber-postsaber";
import { SalaVirtual } from "@/components/training-plans/sala-virtual";
import { RegistroInvitado } from "@/components/invitado/registro-invitado";
import { AbrirEvaluacionPopup } from "@/components/training-plans/abrir-evaluacion-popup";
import { GrabacionJornada } from "@/components/training-plans/grabacion-jornada";
import { firmarTokenJitsi } from "@/lib/jitsi";
import { registrarInvitadoAction, getParticipanteDeCookie } from "@/app/invitado/[activityId]/actions";
import { etiquetaJornada } from "@/components/training-plans/labels";
import { COURSE_AUDIENCE_LABELS } from "@/components/cursos/labels";
import { cn } from "@/lib/utils";

/**
 * ACCESO EXTERNO a una jornada del plan: página PÚBLICA (sin login) para
 * gente de otras entidades. La decisión institucional es mantener a los
 * externos FUERA de la plataforma: no tienen cuenta, no ven cursos ni
 * cronogramas; solo esta jornada puntual -su sala en vivo y su evaluación
 * presaber/postsaber-, tras un registro mínimo de nombre y empresa que
 * queda como constancia de asistencia externa.
 */
export default async function InvitadoPage({ params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = await params;

  const actividad = await prisma.trainingActivity.findUnique({
    where: { id: activityId },
    select: {
      id: true,
      title: true,
      status: true,
      objective: true,
      targetAudience: true,
      targetAudienceNote: true,
      responsibleLabel: true,
      responsibleUser: { select: { fullName: true } },
      courseId: true,
      presaberOpenedAt: true,
      presaberClosedAt: true,
      postsaberOpenedAt: true,
      postsaberClosedAt: true,
      area: { select: { name: true, tutor: { select: { fullName: true } } } },
      plan: { select: { title: true } },
      sessions: {
        where: { status: { not: "CLOSED" } },
        orderBy: { startsAt: "asc" },
        take: 1,
        select: { startsAt: true, endsAt: true },
      },
    },
  });
  if (!actividad) notFound();

  const participante = await getParticipanteDeCookie(activityId);
  const registrar = registrarInvitadoAction.bind(null, activityId);

  // Si quien abre el enlace externo ADEMÁS tiene sesión de personal (un
  // tutor o admin revisando su propia jornada), se le habilita la grabación
  // aquí mismo: es la misma sala. Los invitados reales nunca la ven.
  const sesionStaff = await auth();
  const puedeGrabar = sesionStaff?.user?.role === "ADMIN" || sesionStaff?.user?.role === "TUTOR";
  const tokenStaff = puedeGrabar ? await firmarTokenJitsi(sesionStaff!.user!.name ?? "Personal") : null;

  if (!participante) {
    return (
      <main className="aula-canvas flex min-h-screen items-center justify-center px-4 py-10">
        <RegistroInvitado action={registrar} titulo={actividad.title} />
      </main>
    );
  }

  const intentoPre = participante.attempts.find((a) => a.moment === "PRESABER") ?? null;
  const intentoPost = participante.attempts.find((a) => a.moment === "POSTSABER") ?? null;
  const automatico = cicloEsAutomatico(actividad);
  const cicloCongelado = automatico && actividad.status === "CLOSED";
  const momento = cicloCongelado ? null : momentoParaPersona(actividad, !!intentoPre);

  const profesional =
    actividad.area?.tutor?.fullName ?? actividad.responsibleUser?.fullName ?? actividad.responsibleLabel ?? "—";
  const proximaJornada = actividad.sessions[0] ? etiquetaJornada(actividad.sessions[0]) : null;

  const MOMENTOS = [
    {
      etiqueta: "Presaber",
      icon: FileQuestion,
      chip: "bg-warning/15 text-warning-foreground",
      intento: intentoPre,
      abierta: automatico ? !cicloCongelado : estadoPresaber(actividad) === "DISPONIBLE",
    },
    {
      etiqueta: "Postsaber",
      icon: ClipboardCheck,
      chip: "bg-primary/10 text-primary",
      intento: intentoPost,
      abierta: automatico ? !cicloCongelado && !!intentoPre : estadoPostsaber(actividad) === "DISPONIBLE",
    },
  ];

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
          <p className="text-sm text-muted-foreground">
            {actividad.plan.title} · Invitado: <span className="font-semibold text-foreground">{participante.fullName}</span>{" "}
            ({participante.company})
          </p>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-success/25 bg-success/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-success">
            <CircleDot className="h-3 w-3 animate-pulse" aria-hidden="true" />
            Acceso externo
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
              domain={process.env.NEXT_PUBLIC_JITSI_DOMAIN ?? "meet.jit.si"}
              roomName={`RedSaludTeForma-${actividad.id}`}
              activityId={actividad.id}
              displayName={`${participante.fullName} (${participante.company})`}
              subject={actividad.title}
              jwt={tokenStaff}
              externalParticipantId={participante.id}
              esPresentador={puedeGrabar}
              grabacion={puedeGrabar ? <GrabacionJornada activityId={actividad.id} /> : undefined}
            />
          </div>

          <aside className="space-y-4">
            {/* Evaluaciones del ciclo */}
            <section className="surface-glass space-y-3 p-5">
              <h2 className="font-display text-xs font-bold uppercase tracking-wide text-foreground">Tu evaluación</h2>
              {MOMENTOS.map((m) => (
                <div key={m.etiqueta} className="surface-clay flex items-center gap-3 p-3">
                  <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", m.chip)}>
                    <m.icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-foreground">{m.etiqueta}</p>
                    {m.intento ? (
                      <p className="flex items-center gap-1 text-xs font-semibold text-success">
                        <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Presentado · {m.intento.score}%
                      </p>
                    ) : m.abierta ? (
                      <p className="text-xs text-muted-foreground">Disponible ahora</p>
                    ) : (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Lock className="h-3 w-3" aria-hidden="true" /> Aún no habilitada
                      </p>
                    )}
                  </div>
                  {!m.intento && m.abierta && momento && (
                    <AbrirEvaluacionPopup href={`/invitado/${actividad.id}/evaluacion`} etiqueta="Presentar" />
                  )}
                </div>
              ))}
              <p className="text-[11px] leading-snug text-muted-foreground">
                La evaluación se habilita cuando el área abre cada momento. Los invitados tienen un único intento por
                momento.
              </p>
            </section>

            {/* Informe de la capacitación */}
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
          </aside>
        </div>
      </div>
    </main>
  );
}
