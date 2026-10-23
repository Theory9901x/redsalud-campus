import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, BarChart3, Download, ListChecks, PencilRuler } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Piezas de presentación compartidas por la ficha de una encuesta
 * (resultados, respuestas) y el centro de datos SIAU. Sin estado ni datos
 * propios: solo pintan. Estilos en globals.css (sección MÓDULO DE ENCUESTAS).
 */

export type ItemSegmento = { href: string; etiqueta: string; Icono: LucideIcon; activo?: boolean; conteo?: number };

/** Navegación segmentada por enlaces: la opción activa se enciende en navy. */
export function Segmento({ items, etiqueta, className }: { items: ItemSegmento[]; etiqueta: string; className?: string }) {
  return (
    <nav aria-label={etiqueta} className={cn("enc-segmento", className)}>
      {items.map(({ href, etiqueta: texto, Icono, activo, conteo }) => (
        <Link key={href} href={href} aria-current={activo ? "page" : undefined}>
          <Icono aria-hidden="true" />
          {texto}
          {conteo !== undefined && <span className="conteo">{conteo}</span>}
        </Link>
      ))}
    </nav>
  );
}

/**
 * Las tres vistas de trabajo de una encuesta, siempre en el mismo orden.
 * `editable={false}`: quien solo consulta (la cuenta SIAU en su encuesta)
 * no ve el Constructor.
 */
export function NavFicha({ id, activa, editable = true }: { id: string; activa: "resultados" | "respuestas"; editable?: boolean }) {
  return (
    <Segmento
      etiqueta="Secciones de la encuesta"
      items={[
        { href: `/encuestas/${id}/resultados`, etiqueta: "Resultados", Icono: BarChart3, activo: activa === "resultados" },
        { href: `/encuestas/${id}/respuestas`, etiqueta: "Respuestas", Icono: ListChecks, activo: activa === "respuestas" },
        ...(editable ? [{ href: `/encuestas/${id}/constructor`, etiqueta: "Constructor", Icono: PencilRuler }] : []),
      ]}
    />
  );
}

/** Contenedor del centro de exportación: encabezado + rejilla de archivos. */
export function CentroExportacion({
  titulo,
  bajada,
  accion,
  children,
  pie,
  id,
}: {
  titulo: string;
  bajada?: ReactNode;
  accion?: ReactNode;
  children: ReactNode;
  pie?: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="barra-modulo scroll-mt-24 p-4 sm:p-5" aria-label={titulo}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="panel-lateral-icono" aria-hidden="true">
            <Download className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="mono-label">Centro de exportación</p>
            <h2 className="mt-0.5 font-display text-[1.02rem] font-bold tracking-tight text-foreground">{titulo}</h2>
            {bajada && <div className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-muted-foreground">{bajada}</div>}
          </div>
        </div>
        {accion}
      </div>
      <div className="mt-4">{children}</div>
      {pie && <div className="mt-4">{pie}</div>}
    </section>
  );
}

/** Un archivo descargable: formato, qué contiene y para qué sirve. */
export function TarjetaExporte({
  href,
  Icono,
  formato,
  titulo,
  detalle,
  pie,
  destacado = false,
}: {
  href: string;
  Icono: LucideIcon;
  formato: string;
  titulo: string;
  detalle: string;
  pie?: ReactNode;
  destacado?: boolean;
}) {
  return (
    <a href={href} className="enc-exporte" data-destacado={destacado}>
      <div className="flex items-start justify-between gap-3">
        <span className="enc-exporte-icono" aria-hidden="true">
          <Icono />
        </span>
        <span className="enc-formato">{formato}</span>
      </div>
      <div className="min-w-0">
        <p className="enc-exporte-titulo">{titulo}</p>
        <p className="enc-exporte-detalle mt-1">{detalle}</p>
      </div>
      <span className="enc-descargar">
        <span className="truncate">{pie ?? "Descargar"}</span>
        <Download aria-hidden="true" />
      </span>
    </a>
  );
}

export type TonoSemaforo = "success" | "warning" | "destructive" | "muted";

export const TEXTO_SEMAFORO: Record<TonoSemaforo, string> = {
  success: "Cumple",
  warning: "Aceptable",
  destructive: "Crítico",
  muted: "Sin datos",
};

/** Umbrales institucionales: 85 % cumple, 70 % aceptable. */
export function tonoDe(v: number | null | undefined): TonoSemaforo {
  if (v === null || v === undefined) return "muted";
  return v >= 85 ? "success" : v >= 70 ? "warning" : "destructive";
}

export const COLOR_SEMAFORO: Record<TonoSemaforo, string> = {
  success: "var(--success)",
  warning: "var(--warning)",
  destructive: "var(--destructive)",
  muted: "var(--muted-foreground)",
};

export function Semaforo({ tono, children, className }: { tono: TonoSemaforo; children?: ReactNode; className?: string }) {
  return (
    <span className={cn("enc-semaforo", className)} data-tono={tono}>
      {children ?? TEXTO_SEMAFORO[tono]}
    </span>
  );
}

/** Barra horizontal de porcentaje, con el color de su semáforo (o el que se pase). */
export function BarraPorcentaje({ valor, color, className }: { valor: number; color?: string; className?: string }) {
  return (
    <div className={cn("enc-barra", className)} role="presentation">
      <span style={{ width: `${Math.max(0, Math.min(100, valor))}%`, ["--c" as string]: color ?? COLOR_SEMAFORO[tonoDe(valor)] }} />
    </div>
  );
}

/** Encabezado de sección numerado, como un índice de informe. */
export function EncabezadoSeccion({
  numero,
  titulo,
  bajada,
  Icono,
  accion,
}: {
  numero?: string;
  titulo: string;
  bajada?: ReactNode;
  Icono?: LucideIcon;
  accion?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 font-display text-[1.02rem] font-bold tracking-tight text-foreground">
          {numero && <span className="font-mono text-[11px] font-semibold text-primary">{numero}</span>}
          {Icono && <Icono className="h-4 w-4 text-primary" aria-hidden="true" />}
          {titulo}
        </h2>
        {bajada && <div className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">{bajada}</div>}
      </div>
      {accion}
    </div>
  );
}

/**
 * Encuesta SIAU: sus descargas no se repiten en la ficha. Viven en la
 * estación única de exportación del Centro de datos SIAU (estilos .siau-).
 */
export function AvisoExportacionCentralizada({ href = "/encuestas/siau#exportar" }: { href?: string }) {
  return (
    <section className="siau-aviso" aria-label="Exportaciones de la encuesta">
      <span className="siau-estacion-icono" aria-hidden="true">
        <Download />
      </span>
      <div>
        <strong>Las exportaciones de esta encuesta están centralizadas en el Centro de datos SIAU</strong>
        <p>
          Informe PDF, Excel SIHO, datos crudos, PDF de resultados, Excel de respuestas y formato Word: todo en una sola estación, con el periodo y los
          filtros a la vista.
        </p>
      </div>
      <Link href={href} className="siau-boton siau-boton-primario">
        Ir a exportar
        <ArrowRight aria-hidden="true" />
      </Link>
    </section>
  );
}
