import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { CalendarClock, MapPin, User2, Video, FileQuestion, ClipboardCheck, UserPlus, Lock } from "lucide-react";
import { getSesionPorToken, getEstadoPersonaEnSesion, ETIQUETA_FASE } from "@/lib/sesiones-presenciales";
import { getPersonaIdentificada } from "@/app/s/[token]/acciones";
import { PantallaSesion } from "@/components/sesiones/pantalla-sesion";
import { TRAINING_MODALITY_LABELS } from "@/components/training-plans/labels";

const FORMATO_FECHA = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long" });
const FORMATO_HORA = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit" });

/**
 * FASE 10 — Página PÚBLICA de una sesión presencial: /s/[token].
 *
 * Se abre desde el celular en un auditorio, escaneando el QR proyectado.
 * Un solo cartel sirve toda la jornada: la página cambia según la FASE que
 * el tutor controla en vivo (registro → presaber → capacitación →
 * postsaber → cierre). Móvil primero: un botón gigante por fase y cero
 * distracciones.
 *
 * Fuera del matcher del proxy a propósito: la identificación es ligera
 * (documento contra el personal ya migrado) para registrar asistencia;
 * presentar una evaluación sí exige la cuenta, porque escribe en el
 * expediente formativo de la persona.
 */
export default async function SesionPublicaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sesion = await getSesionPorToken(token);
  if (!sesion) notFound();
  if (sesion.audience === "EXTERNAL") redirect(`/invitado/${sesion.activity.id}?s=${encodeURIComponent(token)}`);

  // JORNADA VIRTUAL: esta página es la PUERTA de la jornada -sala, presaber y
  // postsaber-, cada botón con el token de la jornada para que todo quede en
  // ella. La sala ya pide la cuenta; no hace falta identificarse aquí.
  const puertaVirtual = sesion.modality === "VIRTUAL";
  const cerradaJornada = sesion.status === "CLOSED" || sesion.fase === "CERRADA";

  const persona = puertaVirtual ? null : await getPersonaIdentificada(token);
  const estadoPersona = persona
    ? await getEstadoPersonaEnSesion({ id: sesion.id, activity: { courseId: sesion.activity.courseId } }, persona.id)
    : null;

  return (
    <main className="aula-canvas flex min-h-screen flex-col">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-6">
        {/* Identidad de la jornada, compacta */}
        <header className="surface-lumen p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
            {sesion.activity.area?.name ?? "Capacitación"} · {TRAINING_MODALITY_LABELS[sesion.activity.modality]}
          </p>
          <h1 className="mt-1.5 font-display text-xl font-extrabold leading-snug tracking-tight text-foreground">
            {sesion.activity.title}
          </h1>
          <div className="mt-3 space-y-1.5 text-[13px] text-muted-foreground">
            <p className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              {FORMATO_FECHA.format(sesion.startsAt)} · {FORMATO_HORA.format(sesion.startsAt)}
              {sesion.endsAt ? ` – ${FORMATO_HORA.format(sesion.endsAt)}` : ""}
            </p>
            {(sesion.location || sesion.municipio) && (
              <p className="flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                {[sesion.location, sesion.municipio?.nombre].filter(Boolean).join(" · ")}
              </p>
            )}
            {sesion.facilitador && (
              <p className="flex items-center gap-2">
                <User2 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                {sesion.facilitador}
              </p>
            )}
          </div>
          <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-[12px] font-bold text-primary">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" aria-hidden="true" />
            {puertaVirtual ? (cerradaJornada ? "Jornada cerrada" : "Jornada virtual") : ETIQUETA_FASE[sesion.fase]}
          </span>
        </header>

        {puertaVirtual ? (
          <PuertaVirtual
            token={token}
            activityId={sesion.activity.id}
            conEvaluacion={!!sesion.activity.courseId}
            cerrada={cerradaJornada}
            permiteExternos={sesion.audience !== "INTERNAL"}
          />
        ) : (
        <PantallaSesion
          token={token}
          fase={sesion.fase}
          activityId={sesion.activity.id}
          tieneCurso={!!sesion.activity.courseId}
          persona={persona}
          estado={estadoPersona}
        />
        )}
      </div>
    </main>
  );
}

/** Puerta de una jornada VIRTUAL: un botón por destino, todos con el token de la jornada. */
function PuertaVirtual({
  token,
  activityId,
  conEvaluacion,
  cerrada,
  permiteExternos,
}: {
  token: string;
  activityId: string;
  conEvaluacion: boolean;
  cerrada: boolean;
  permiteExternos: boolean;
}) {
  if (cerrada) {
    return (
      <div className="surface-lumen mt-4 p-8 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Lock className="h-6 w-6" aria-hidden="true" />
        </span>
        <h2 className="mt-4 font-display text-xl font-extrabold tracking-tight text-foreground">Jornada cerrada</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">Esta jornada ya terminó: no admite nuevos registros.</p>
      </div>
    );
  }
  const q = `?s=${encodeURIComponent(token)}`;
  const botones = [
    { href: `/c/${activityId}/meet${q}`, etiqueta: "Entrar a la sala", Icono: Video, principal: true },
    ...(conEvaluacion
      ? [
          { href: `/c/${activityId}/presaber${q}`, etiqueta: "Presentar presaber", Icono: FileQuestion, principal: false },
          { href: `/c/${activityId}/postsaber${q}`, etiqueta: "Presentar postsaber", Icono: ClipboardCheck, principal: false },
        ]
      : []),
  ];
  return (
    <div className="mt-4 flex flex-1 flex-col gap-3">
      {botones.map((b) => (
        <a
          key={b.href}
          href={b.href}
          className={
            b.principal
              ? "flex min-h-[84px] w-full items-center justify-center gap-3 rounded-3xl bg-gradient-to-r from-primary to-success text-lg font-extrabold text-white shadow-xl shadow-primary/30 transition-transform active:scale-[0.98]"
              : "surface-lumen flex min-h-[64px] w-full items-center justify-center gap-2.5 text-[15px] font-bold text-foreground transition-colors hover:text-primary"
          }
        >
          <b.Icono className="h-5 w-5" aria-hidden="true" />
          {b.etiqueta}
        </a>
      ))}
      <p className="px-2 text-center text-[11.5px] leading-snug text-muted-foreground">
        Te pedirá iniciar sesión con tu cuenta institucional. Tu asistencia y tus evaluaciones quedan en esta jornada.
      </p>
      {permiteExternos && <Link
        href={`/invitado/${activityId}${q}`}
        className="mx-auto mt-1 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-primary hover:underline"
      >
        <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
        ¿Vienes de otra entidad? Entra como invitado
      </Link>}
    </div>
  );
}
