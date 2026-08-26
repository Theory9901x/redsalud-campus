import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, CheckCircle2, MapPin, TrendingUp, User2, Users2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireTrainingActivityAccess } from "@/lib/auth-helpers";
import { getAsistentesSesion, type SnapshotSesion } from "@/lib/sesiones-presenciales";
import { PanelSesionVivo } from "@/components/sesiones/panel-sesion-vivo";
import { TRAINING_MODALITY_LABELS } from "@/components/training-plans/labels";

const FORMATO_FECHA = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long" });
const FORMATO_HORA = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit" });
const FORMATO_HORA_SEG = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit", second: "2-digit" });

/**
 * FASE 10 — Página de gestión EN VIVO de una sesión presencial. Compartida
 * por las rutas de tutor y de administrador (mismo permiso adscrito).
 */
export async function PaginaSesionVivo({
  sesionId,
  basePath,
  planId,
  activityId,
}: {
  sesionId: string;
  basePath: string;
  planId: string;
  activityId: string;
}) {
  const sesion = await prisma.trainingSession.findUnique({
    where: { id: sesionId },
    include: {
      activity: { select: { id: true, title: true, modality: true, area: { select: { name: true } } } },
      municipio: { select: { nombre: true } },
    },
  });
  if (!sesion || sesion.activityId !== activityId) notFound();
  await requireTrainingActivityAccess(sesion.activityId);

  const asistentes = await getAsistentesSesion(sesionId);
  const snapshot = sesion.cierreSnapshot as unknown as SnapshotSesion | null;

  return (
    <div className="space-y-6">
      <Link
        href={`${basePath}/${planId}/actividades/${activityId}`}
        className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {sesion.activity.title}
      </Link>

      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
          Sesión presencial · {sesion.activity.area?.name ?? "Capacitación"} ·{" "}
          {TRAINING_MODALITY_LABELS[sesion.activity.modality]}
        </p>
        <h1 className="mt-2 font-display text-[clamp(1.5rem,3.2vw,2rem)] font-extrabold leading-tight tracking-tight text-foreground">
          {FORMATO_FECHA.format(sesion.startsAt)}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-4 text-[13px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CalendarClock className="h-4 w-4 text-primary" />
            {FORMATO_HORA.format(sesion.startsAt)}
            {sesion.endsAt ? ` – ${FORMATO_HORA.format(sesion.endsAt)}` : ""}
          </span>
          {(sesion.location || sesion.municipio) && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-primary" />
              {[sesion.location, sesion.municipio?.nombre].filter(Boolean).join(" · ")}
            </span>
          )}
          {sesion.facilitador && (
            <span className="flex items-center gap-1.5">
              <User2 className="h-4 w-4 text-primary" />
              {sesion.facilitador}
            </span>
          )}
        </div>
      </header>

      {/* Acta congelada, si ya cerró */}
      {snapshot && (
        <section aria-label="Acta de la sesión" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { etiqueta: "Asistentes", valor: String(snapshot.asistentes), Icono: Users2 },
            { etiqueta: "Presaber presentados", valor: String(snapshot.presaberPresentados), Icono: CheckCircle2 },
            { etiqueta: "Postsaber presentados", valor: String(snapshot.postsaberPresentados), Icono: CheckCircle2 },
            {
              etiqueta: "Adherencia de la sesión",
              valor:
                snapshot.promedioPre !== null && snapshot.promedioPost !== null
                  ? `${snapshot.promedioPre}% → ${snapshot.promedioPost}%`
                  : "—",
              detalle:
                snapshot.diferencia !== null
                  ? `${snapshot.diferencia > 0 ? "+" : ""}${snapshot.diferencia} pp${snapshot.variacion !== null ? ` (${snapshot.variacion > 0 ? "+" : ""}${snapshot.variacion}%)` : ""}`
                  : undefined,
              Icono: TrendingUp,
            },
          ].map((k) => (
            <div key={k.etiqueta} className="surface-vivo">
              <div className="flex h-full flex-col justify-between gap-3 p-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/12 text-primary">
                  <k.Icono className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                </span>
                <div>
                  <p className="font-display text-[1.5rem] font-extrabold leading-none tracking-tight tabular-nums text-foreground">
                    {k.valor}
                  </p>
                  <p className="mt-1.5 text-[12px] leading-tight text-muted-foreground">{k.etiqueta}</p>
                  {k.detalle && <p className="text-[11px] font-semibold text-success">{k.detalle}</p>}
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      <div className="flex justify-end">
        <a
          href={`/api/planes-capacitacion/sesiones/${sesion.id}/csv`}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-card/70 px-3.5 py-2 text-[12.5px] font-bold text-foreground transition-colors hover:border-primary/40"
        >
          Exportar corte de la sesión (CSV)
        </a>
      </div>

      <PanelSesionVivo
        sesionId={sesion.id}
        faseInicial={sesion.fase}
        fichaUrl={`${basePath}/${planId}/actividades/${activityId}/sesion/${sesion.id}/ficha`}
        asistentesIniciales={asistentes.map((a) => ({
          nombre: a.user.fullName,
          documento: a.user.documentNumber,
          hora: FORMATO_HORA_SEG.format(a.registradaEn),
          medio: a.medio,
        }))}
      />
    </div>
  );
}
