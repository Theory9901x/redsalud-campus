import Link from "next/link";
import { BarChart3, CalendarClock, GraduationCap, ListChecks, PencilRuler, Users2 } from "lucide-react";
import type { EncuestaDeLista } from "@/lib/encuestas/consultas";
import { BotonEnlacePublico } from "@/components/encuestas/boton-enlace-publico";
import { PildoraEstado, escalon } from "@/components/training-plans/plan-visual";
import type { SurveyStatus, SurveyAudience } from "@prisma/client";

export const ETIQUETA_ESTADO: Record<SurveyStatus, string> = {
  DRAFT: "Borrador",
  PUBLISHED: "Publicada",
  CLOSED: "Cerrada",
};

/** Estado de la encuesta en el vocabulario visual del módulo (PildoraEstado / .plan-instancia). */
const ESTADO_VISUAL: Record<SurveyStatus, string> = {
  DRAFT: "DRAFT",
  PUBLISHED: "ACTIVE",
  CLOSED: "CLOSED",
};

export const ETIQUETA_AUDIENCIA: Record<SurveyAudience, string> = {
  INTERNO: "Cliente interno",
  EXTERNO: "Cliente externo",
  MIXTA: "Interno y externo",
};

const FECHA = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Bogota" });

/**
 * Tarjeta de una encuesta en el espacio de trabajo: la misma tarjeta-
 * instancia del centro de mando (canto de estado, foco que sigue al cursor),
 * un tablero de cifras y, al pie, las acciones en celdas iguales con su
 * nombre. El color propio de la encuesta queda como una muestra junto al
 * código: identifica sin pintar la tarjeta.
 */
export function TarjetaEncuesta({
  encuesta,
  puedeGestionar,
  puedeEditar = true,
  baseUrl,
  indice = 0,
}: {
  encuesta: EncuestaDeLista;
  /** Estudiante: solo consulta su resultado; tutor y admin gestionan. */
  puedeGestionar: boolean;
  /** Gestiona pero sin Constructor (la cuenta SIAU sobre la encuesta SIAU). */
  puedeEditar?: boolean;
  baseUrl: string;
  indice?: number;
}) {
  const acento = encuesta.themeColor || "var(--primary)";
  const tasa = encuesta.respuestas > 0 ? Math.round((encuesta.completadas / encuesta.respuestas) * 100) : null;
  const base = `${baseUrl}/${encuesta.id}`;
  const principal = puedeGestionar ? `${base}/resultados` : `${base}/mi-resultado`;
  const difundible = puedeGestionar && encuesta.status !== "DRAFT";

  return (
    <article className="plan-instancia revelar flex flex-col" data-estado={ESTADO_VISUAL[encuesta.status]} style={escalon(indice)}>
      <div className="flex items-center justify-between gap-3 px-5 pt-5">
        <PildoraEstado estado={ESTADO_VISUAL[encuesta.status]}>{ETIQUETA_ESTADO[encuesta.status]}</PildoraEstado>
        <span className="codigo-plan inline-flex min-w-0 items-center gap-2" title={encuesta.code}>
          <span className="enc-muestra" style={{ backgroundColor: acento, color: acento }} aria-hidden="true" />
          <span className="truncate">{encuesta.code}</span>
        </span>
      </div>

      <div className="px-5 pt-3">
        <h3 className="line-clamp-2 font-display text-[1.06rem] font-bold leading-snug tracking-tight text-foreground">
          <Link href={principal} className="enlace-tarjeta outline-none focus-visible:underline">
            {encuesta.title}
          </Link>
        </h3>
        {encuesta.description && (
          <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-muted-foreground">{encuesta.description}</p>
        )}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="chip-dato">
            <Users2 aria-hidden="true" />
            {ETIQUETA_AUDIENCIA[encuesta.audience]}
          </span>
          {(encuesta.capacitacion || encuesta.plan) && (
            <span className="chip-dato max-w-full" title={encuesta.capacitacion ?? encuesta.plan ?? undefined}>
              <GraduationCap className="shrink-0" aria-hidden="true" />
              <span className="truncate">{encuesta.capacitacion ?? encuesta.plan}</span>
            </span>
          )}
          <span className="chip-dato">
            <CalendarClock aria-hidden="true" />
            {FECHA.format(encuesta.actualizada)}
          </span>
        </div>
      </div>

      {/* Tablero de cifras */}
      <div className="mt-auto px-5 pt-4">
        <div className="panel-cifras grid grid-cols-3">
          <div className="dato-mini">
            <b>{encuesta.completadas}</b>
            <span>{encuesta.completadas === 1 ? "Respuesta" : "Respuestas"}</span>
          </div>
          <div className="dato-mini">
            <b>{tasa !== null ? `${tasa}%` : "—"}</b>
            <span>Finaliz.</span>
          </div>
          <div className="dato-mini">
            <b>{encuesta.preguntas}</b>
            <span>{encuesta.preguntas === 1 ? "Pregunta" : "Preguntas"}</span>
          </div>
        </div>
        <div className="medidor mt-3" role="presentation">
          {tasa !== null && tasa > 0 && <span style={{ width: `${tasa}%` }} />}
        </div>
      </div>

      {/* Acciones, al pie, cada una con su nombre */}
      {puedeGestionar ? (
        <div className="enc-acciones mt-4" style={{ ["--n" as string]: 2 + (puedeEditar ? 1 : 0) + (difundible ? 1 : 0) }}>
          <Link href={`${base}/resultados`} className="enc-accion-principal">
            <BarChart3 aria-hidden="true" />
            Resultados
          </Link>
          <Link href={`${base}/respuestas`}>
            <ListChecks aria-hidden="true" />
            Respuestas
          </Link>
          {puedeEditar && (
            <Link href={`${base}/constructor`}>
              <PencilRuler aria-hidden="true" />
              Editar
            </Link>
          )}
          {difundible && <BotonEnlacePublico slug={encuesta.slug} titulo={encuesta.title} acento={acento} variante="celda" />}
        </div>
      ) : (
        <div className="enc-acciones mt-4" style={{ ["--n" as string]: 1 }}>
          <Link href={principal} className="enc-accion-principal">
            <BarChart3 aria-hidden="true" />
            Ver mi resultado
          </Link>
        </div>
      )}
    </article>
  );
}
