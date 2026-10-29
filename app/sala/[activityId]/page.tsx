import { coincideAudienciaCapacitacion } from "@/lib/audiencia-capacitacion";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  User,
  Target,
  ListChecks,
  Users2,
  CalendarClock,
  ChevronLeft,
  ShieldCheck,
} from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { fuenteSala } from "@/lib/fuente-sala";
import { SalaVirtual } from "@/components/training-plans/sala-virtual";
import { GrabacionJornada } from "@/components/training-plans/grabacion-jornada";
import { AbrirEvaluacionPopup } from "@/components/training-plans/abrir-evaluacion-popup";
import { ThemeToggle } from "@/components/brand/theme-toggle";
import { SelectorVistaSala } from "@/components/training-plans/selector-vista-sala";
import { getMomentoParaUsuario } from "@/lib/training-plans";
import { firmarTokenJitsi } from "@/lib/jitsi";
import { etiquetaJornada } from "@/components/training-plans/labels";
import { jornadaDeEnlace } from "@/lib/jornadas";
import { COURSE_AUDIENCE_LABELS } from "@/components/cursos/labels";
import { getGestionReunion } from "@/lib/reuniones-gestion";
import { getContenidoReunion } from "@/lib/reunion-contenido";
import { ContenidoSalaReunion } from "@/components/reuniones/contenido-sala";
import { ControlSalaReunion } from "@/components/reuniones/control-sala";

/**
 * SALA VIRTUAL INTEGRADA: la videollamada embebida (Jitsi) con la barra de
 * controles de la plataforma, dentro de una CONSOLA propia -siempre oscura,
 * independiente del tema del campus- donde el video es el protagonista y
 * todo lo demás (riel, telemetría, chat, personas, bitácora, notas, informe)
 * es instrumental.
 *
 * Exige sesión iniciada a propósito: como quien entra está identificado, el
 * ingreso a la llamada registra su ASISTENCIA automáticamente.
 */
export default async function SalaVirtualPage({
  params,
  searchParams,
}: {
  params: Promise<{ activityId: string }>;
  searchParams: Promise<{ s?: string }>;
}) {
  const { activityId } = await params;
  const { s: tokenJornada } = await searchParams;
  const session = await auth();
  const aqui = `/sala/${activityId}${tokenJornada ? `?s=${encodeURIComponent(tokenJornada)}` : ""}`;
  if (!session?.user) redirect(`/login?callbackUrl=${encodeURIComponent(aqui)}`);

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
      responsibleUserId: true,
      responsibleUser: { select: { fullName: true } },
      area: { select: { name: true, tutorId: true, tutor: { select: { fullName: true } } } },
      plan: { select: { id: true, title: true, tutorId: true, kind: true, isIndependent: true } },
    },
  });
  if (!actividad) notFound();
  if (session.user.role === "STUDENT" && actividad.plan.kind === "CAPACITACION" && (actividad.status !== "OPEN" || !coincideAudienciaCapacitacion(actividad.targetAudience, session.user.personnelType))) notFound();

  // La jornada de esta sala: la del enlace (?s=) o, con el enlace general, la
  // vigente. Cada conexión queda en ella.
  const { jornada } = await jornadaDeEnlace(activityId, tokenJornada);
  if (jornada?.audience === "EXTERNAL" && session.user.role === "STUDENT") redirect(`/invitado/${activityId}?s=${jornada.tokenPublico}`);
  const sufijoJornada = jornada ? `?s=${jornada.tokenPublico}` : "";

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

  /*
   * ANFITRIÓN de la sala = quien responde por ESTA capacitación: la
   * administración, el tutor del área que la genera, su responsable o el
   * responsable del plan. Solo el anfitrión recibe el token de Jitsi
   * (moderar, silenciar, expulsar, iniciar la sala) y los controles de
   * grabación. Todos los demás -estudiantes y tutores de otras áreas-
   * entran como participantes normales.
   */
  const uid = session.user.id;
  const esReunion = actividad.plan.kind === "REUNION";
  const gestion = esReunion && ["ADMIN", "TUTOR", "SEGUIMIENTO"].includes(session.user.role)
    ? await getGestionReunion(actividad.plan.id, activityId).catch(() => null) : null;
  const contenido = esReunion ? await getContenidoReunion(activityId) : null;
  const esPersonal = esReunion ? !!gestion?.puedeGestionar :
    session.user.role === "ADMIN" ||
    (session.user.role === "TUTOR" &&
      (actividad.area?.tutorId === uid || actividad.responsibleUserId === uid || actividad.plan.tutorId === uid));
  // La asistencia NO se marca al abrir esta página: la marca el primer tramo
  // real de conexión a la llamada (lib/call-connections), con su permanencia.

  const jitsiDomain = process.env.NEXT_PUBLIC_JITSI_DOMAIN ?? "meet.jit.si";
  // En una REUNIÓN ABIERTA cualquiera inicia la sala; en el resto, solo el anfitrión.
  const tokenSala = esPersonal || actividad.plan.kind === "REUNION" ? await firmarTokenJitsi(session.user.name ?? "Participante") : null;
  const proximaJornada = jornada ? etiquetaJornada(jornada) : null;
  const nombre = session.user.name ?? "Participante";
  const inicialesUsuario = nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

  const volverHref = esReunion
    ? gestion ? `${session.user.role === "TUTOR" ? "/tutor" : "/admin"}/reuniones/${actividad.plan.id}` : "/mis-capacitaciones/en-vivo"
    : esPersonal ? `/tutor/${actividad.plan.isIndependent ? "capacitaciones" : "planes-capacitacion"}/${actividad.plan.id}/actividades/${actividad.id}` : `/mis-capacitaciones/${actividad.plan.id}`;
  const herramientas = contenido ? <ContenidoSalaReunion activityId={activityId} inicial={contenido} anfitrion={gestion?.puedeGestionar ? { planId: actividad.plan.id, desarrollo: gestion.desarrollo } : undefined} /> : undefined;

  const FICHA = [
    { icon: Building2, etiqueta: "Área", valor: actividad.area?.name ?? "Sin área" },
    { icon: User, etiqueta: "Responsable", valor: profesional },
    { icon: Users2, etiqueta: "Dirigida a", valor: actividad.targetAudienceNote ?? COURSE_AUDIENCE_LABELS[actividad.targetAudience] },
    ...(proximaJornada ? [{ icon: CalendarClock, etiqueta: "Jornada", valor: proximaJornada }] : []),
  ];

  const panelInfo = (
    <div className="space-y-5">
      {evaluacion && (
        <section className="space-y-2.5">
          <h2 className="sh-label">Tu evaluación</h2>
          {[
            { etiqueta: "Presaber", hecho: evaluacion.preHecho, activo: evaluacion.momento === "PRESABER" },
            { etiqueta: "Postsaber", hecho: evaluacion.postHecho, activo: evaluacion.momento === "POSTSABER" },
          ].map((m) => (
            <div key={m.etiqueta} className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--sh-line)] bg-[var(--sh-panel-2)] px-3.5 py-3">
              <span className="text-[13px] font-semibold">{m.etiqueta}</span>
              {m.hecho ? (
                <span className="sh-label text-[var(--sh-live)]">Presentado</span>
              ) : m.activo ? (
                <AbrirEvaluacionPopup
                  href={`/c/${actividad.id}/${m.etiqueta === "Presaber" ? "presaber" : "postsaber"}${sufijoJornada}`}
                  etiqueta={`Presentar ${m.etiqueta.toLowerCase()}`}
                />
              ) : (
                <span className="sh-label text-[var(--sh-dim)]">No disponible</span>
              )}
            </div>
          ))}
          <p className="text-[11px] leading-snug text-[var(--sh-dim)]">Se abre en una ventana aparte: no te saca de la sala.</p>
        </section>
      )}

      <section className="space-y-2.5">
        <h2 className="sh-label">{esReunion ? "Información de la reunión" : "Informe de la capacitación"}</h2>
        <dl className="divide-y divide-[var(--sh-line)] rounded-2xl border border-[var(--sh-line)]">
          {FICHA.map((f) => (
            <div key={f.etiqueta} className="flex items-start gap-3 px-3.5 py-3">
              <f.icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--sh-signal)]" aria-hidden="true" />
              <div className="min-w-0">
                <dt className="sh-label text-[0.58rem]">{f.etiqueta}</dt>
                <dd className="text-[13px] leading-snug">{f.valor}</dd>
              </div>
            </div>
          ))}
        </dl>
      </section>

      {actividad.objective && (
        <section className="space-y-2">
          <h2 className="sh-label flex items-center gap-1.5"><Target className="h-3.5 w-3.5 text-[var(--sh-signal)]" aria-hidden="true" /> Objetivo</h2>
          <p className="text-[13px] leading-relaxed text-[var(--sh-muted)]">{actividad.objective}</p>
        </section>
      )}

      {actividad.methodology && (
        <section className="space-y-2">
          <h2 className="sh-label flex items-center gap-1.5"><ListChecks className="h-3.5 w-3.5 text-[var(--sh-signal)]" aria-hidden="true" /> {esReunion ? "Desarrollo registrado" : "Metodología"}</h2>
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--sh-muted)]">{actividad.methodology}</p>
        </section>
      )}
      <p className="flex items-center gap-2 border-t border-[var(--sh-line)] pt-4 text-[11.5px] leading-snug text-[var(--sh-muted)]">
        <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--sh-live)]" aria-hidden="true" />
        La asistencia se registra automáticamente al entrar a la llamada.
      </p>
    </div>
  );

  return (
    <main className={cn(fuenteSala.variable, "sala-hud flex min-h-dvh flex-col font-sans xl:h-dvh xl:overflow-hidden")}>
      {/* ---------------- Barra superior: una línea, nada más ---------------- */}
      <header className="sh-rise flex h-14 shrink-0 items-center gap-3 px-3 sm:px-5" style={{ "--i": 0 } as React.CSSProperties}>
        <Link
          href={volverHref}
          title={esReunion ? "Volver a reuniones" : "Volver a capacitaciones"}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--sh-line-strong)] bg-[var(--sh-panel)] text-[var(--sh-muted)] transition-colors hover:text-[var(--sh-text)]"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="sh-label text-[0.58rem] leading-none">{esReunion ? "Sala de reunión" : "Sala de capacitación"}</p>
          <h1 className="sh-display mt-1 truncate text-[15px] font-semibold leading-tight tracking-[-0.01em]" title={actividad.title}>
            {actividad.title}
          </h1>
        </div>
        <span className="hidden items-center gap-1.5 text-[12px] text-[var(--sh-muted)] md:inline-flex">
          <CalendarClock className="h-3.5 w-3.5 text-[var(--sh-signal)]" aria-hidden="true" />
          {proximaJornada ?? profesional}
        </span>
        <span className="sh-chip hidden border-[color-mix(in_oklch,var(--sh-live)_40%,transparent)] bg-[color-mix(in_oklch,var(--sh-live)_12%,transparent)] sm:inline-flex">
          <span className="sh-live-dot" aria-hidden="true" />
          <span className="text-[11px] font-semibold text-[var(--sh-text)]">En vivo</span>
        </span>
        <SelectorVistaSala />
        <span className="sh-panel flex items-center rounded-full px-1 py-0.5">
          <ThemeToggle />
        </span>
        <span
          className="sh-display grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[var(--sh-signal)] to-[var(--sh-live)] text-[12px] font-semibold text-white"
          title={nombre}
        >
          {inicialesUsuario || "?"}
        </span>
      </header>

      {/* ---------------- Sala: video + consola, toda la altura restante ---------------- */}
      <div className="min-h-0 flex-1 px-3 pb-3 sm:px-5 sm:pb-5">
        <ControlSalaReunion esReunion={esReunion} activityId={activityId} cerradaInicial={actividad.status === "CLOSED"}>
          <SalaVirtual
            domain={jitsiDomain}
            roomName={`RedSaludTeForma-${actividad.id}`}
            activityId={actividad.id}
            sessionId={jornada?.id ?? null}
            displayName={nombre}
            subject={actividad.title}
            jwt={tokenSala}
            esPresentador={esPersonal}
            grabacion={esPersonal ? <GrabacionJornada activityId={actividad.id} /> : undefined}
            panelDerecho={panelInfo}
            panelActa={herramientas}
          />
        </ControlSalaReunion>
      </div>
    </main>
  );
}
