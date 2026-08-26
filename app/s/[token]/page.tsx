import { notFound } from "next/navigation";
import { CalendarClock, MapPin, User2 } from "lucide-react";
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

  const persona = await getPersonaIdentificada(token);
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
            {ETIQUETA_FASE[sesion.fase]}
          </span>
        </header>

        <PantallaSesion
          token={token}
          fase={sesion.fase}
          activityId={sesion.activity.id}
          tieneCurso={!!sesion.activity.courseId}
          persona={persona}
          estado={estadoPersona}
        />
      </div>
    </main>
  );
}
