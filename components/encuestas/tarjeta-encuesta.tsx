import Link from "next/link";
import { BarChart3, ClipboardList, Pencil, Users2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EncuestaDeLista } from "@/lib/encuestas/consultas";
import { BotonEnlacePublico } from "@/components/encuestas/boton-enlace-publico";
import type { SurveyStatus, SurveyAudience } from "@prisma/client";

export const ETIQUETA_ESTADO: Record<SurveyStatus, string> = {
  DRAFT: "Borrador",
  PUBLISHED: "Publicada",
  CLOSED: "Cerrada",
};

/** El estado se dice con un punto y un borde, no pintando la tarjeta entera. */
const COLOR_ESTADO: Record<SurveyStatus, { punto: string; texto: string; borde: string }> = {
  DRAFT: { punto: "bg-muted-foreground/50", texto: "text-muted-foreground", borde: "border-border/60" },
  PUBLISHED: { punto: "bg-success", texto: "text-success", borde: "border-success/40" },
  CLOSED: { punto: "bg-muted-foreground/50", texto: "text-muted-foreground", borde: "border-border/60" },
};

export const ETIQUETA_AUDIENCIA: Record<SurveyAudience, string> = {
  INTERNO: "Cliente interno",
  EXTERNO: "Cliente externo",
  MIXTA: "Interno y externo",
};

/**
 * Tarjeta de una encuesta en el espacio de trabajo.
 *
 * Se construye sobre el vidrio de tres capas del sistema (surface-vivo) con
 * una cinta superior del color de la propia encuesta: en una rejilla de
 * veinte, el color es lo que deja distinguirlas de un vistazo sin leer el
 * título. Nada de cuadros blancos idénticos.
 */
export function TarjetaEncuesta({
  encuesta,
  puedeGestionar,
  baseUrl,
}: {
  encuesta: EncuestaDeLista;
  /** Estudiante: solo consulta su resultado; tutor y admin gestionan. */
  puedeGestionar: boolean;
  baseUrl: string;
}) {
  const estado = COLOR_ESTADO[encuesta.status];
  const acento = encuesta.themeColor || "var(--primary)";
  const tasa = encuesta.respuestas > 0 ? Math.round((encuesta.completadas / encuesta.respuestas) * 100) : null;

  return (
    <article className="surface-vivo group">
      <div className="flex h-full flex-col">
        {/* Cinta de color: la identidad de la encuesta. */}
        <span
          className="h-1.5 w-full rounded-t-[23px]"
          style={{ backgroundImage: `linear-gradient(90deg, ${acento}, color-mix(in oklch, ${acento} 45%, transparent))` }}
          aria-hidden="true"
        />

        <div className="flex flex-1 flex-col p-5">
          <div className="flex items-start justify-between gap-3">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border bg-card/60 px-2.5 py-1 text-[11px] font-bold backdrop-blur-sm",
                estado.borde,
                estado.texto
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", estado.punto)} aria-hidden="true" />
              {ETIQUETA_ESTADO[encuesta.status]}
            </span>
            <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{encuesta.code}</span>
          </div>

          <h3 className="mt-3 line-clamp-2 font-display text-[17px] font-extrabold leading-snug tracking-tight text-foreground">
            {encuesta.title}
          </h3>
          {encuesta.description && (
            <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-muted-foreground">
              {encuesta.description}
            </p>
          )}

          {/* Modularización: de qué capacitación es esta encuesta. */}
          {(encuesta.capacitacion || encuesta.plan) && (
            <p className="mt-3 flex items-start gap-1.5 text-[11.5px] leading-snug text-muted-foreground">
              <ClipboardList className="mt-px h-3.5 w-3.5 shrink-0" style={{ color: acento }} aria-hidden="true" />
              <span className="line-clamp-1">{encuesta.capacitacion ?? encuesta.plan}</span>
            </p>
          )}

          {/* Cifras: respuestas y finalización, la señal que importa. */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-border/50 bg-card/50 px-3 py-2 backdrop-blur-sm">
              <p className="font-display text-lg font-extrabold leading-none tabular-nums text-foreground">
                {encuesta.completadas}
              </p>
              <p className="mt-1 text-[10.5px] leading-tight text-muted-foreground">
                {encuesta.completadas === 1 ? "respuesta" : "respuestas"}
              </p>
            </div>
            <div className="rounded-xl border border-border/50 bg-card/50 px-3 py-2 backdrop-blur-sm">
              <p className="font-display text-lg font-extrabold leading-none tabular-nums text-foreground">
                {tasa !== null ? `${tasa}%` : "—"}
              </p>
              <p className="mt-1 text-[10.5px] leading-tight text-muted-foreground">finalización</p>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Users2 className="h-3.5 w-3.5" aria-hidden="true" />
            {ETIQUETA_AUDIENCIA[encuesta.audience]}
            <span className="ml-auto">
              {encuesta.preguntas} {encuesta.preguntas === 1 ? "pregunta" : "preguntas"}
            </span>
          </div>

          {/* Acciones, al pie */}
          <div className="mt-4 flex items-center gap-1 border-t border-border/50 pt-3">
            {puedeGestionar ? (
              <>
                <Accion href={`${baseUrl}/${encuesta.id}/constructor`} icono={Pencil} titulo="Constructor" />
                <Accion href={`${baseUrl}/${encuesta.id}/resultados`} icono={BarChart3} titulo="Resultados" />
                <Accion href={`${baseUrl}/${encuesta.id}/respuestas`} icono={ClipboardList} titulo="Respuestas" />
                {encuesta.status !== "DRAFT" && (
                  <BotonEnlacePublico slug={encuesta.slug} titulo={encuesta.title} acento={acento} />
                )}
              </>
            ) : (
              <Link
                href={`${baseUrl}/${encuesta.id}/mi-resultado`}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-bold text-white transition-transform hover:translate-x-0.5"
                style={{ backgroundColor: acento }}
              >
                <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                Ver mi resultado
              </Link>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function Accion({
  href,
  icono: Icono,
  titulo,
}: {
  href: string;
  icono: typeof Pencil;
  titulo: string;
}) {
  return (
    <Link
      href={href}
      title={titulo}
      aria-label={titulo}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
    >
      <Icono className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}
