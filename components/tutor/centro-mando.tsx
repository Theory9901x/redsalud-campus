import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  ClipboardCheck,
  FileCheck2,
  Radio,
  Unlink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { tituloLegible } from "@/components/training-plans/labels";
import type { GrupoAccion } from "@/lib/tutor-dashboard";

/*
 * Piezas de servidor del panel del tutor (estilos: sección .tut- de
 * globals.css). Sin estado: solo pintan datos ya calculados.
 */

/** Panel de consola: índice, título, bajada, acción a la derecha y cuerpo. */
export function PanelTutor({
  indice,
  titulo,
  bajada,
  accion,
  children,
  className,
  style,
  cuerpoClassName,
}: {
  indice?: string;
  titulo: string;
  bajada?: ReactNode;
  accion?: ReactNode;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  cuerpoClassName?: string;
}) {
  return (
    <section className={cn("tut-panel revelar", className)} style={style}>
      <header className="tut-panel-cab">
        {indice && (
          <span className="indice" aria-hidden="true">
            {indice}
          </span>
        )}
        <div className="texto">
          <h2>{titulo}</h2>
          {bajada && <p>{bajada}</p>}
        </div>
        {accion && <div className="accion">{accion}</div>}
      </header>
      <div className={cn("tut-panel-cuerpo", cuerpoClassName)}>{children}</div>
    </section>
  );
}

/** Enlace pequeño de cabecera de panel ("Ver todo →"). */
export function EnlacePanel({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="tut-enlace-panel">
      {children}
      <ArrowRight className="h-3 w-3" aria-hidden="true" />
    </Link>
  );
}

/** Vacío de una línea: dice qué falta y qué lo llenaría, sin ocupar media pantalla. */
export function VacioCompacto({ Icono, children }: { Icono: LucideIcon; children: ReactNode }) {
  return (
    <div className="tut-vacio">
      <Icono aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Medidor horizontal con semáforo y marca de la meta institucional (85 %). */
export function Medidor({ valor, nivel, meta = 85, className }: { valor: number | null; nivel: string; meta?: number; className?: string }) {
  return (
    <div className={cn("tut-medidor", className)} data-nivel={nivel} aria-hidden="true">
      {valor !== null && valor > 0 && <span style={{ width: `${Math.min(100, Math.max(2, valor))}%` }} />}
      <i className="meta" style={{ left: `${meta}%` }} />
    </div>
  );
}

const ICONO_GRUPO: Record<string, LucideIcon> = {
  vivo: Radio,
  hoy: CalendarClock,
  agendar: CalendarPlus,
  ventanas: ClipboardCheck,
  semana: CalendarDays,
  "sin-curso": Unlink,
  informes: FileCheck2,
  cursos: BookOpen,
};

const VISIBLES = 3;

/**
 * COLA DE ACCIÓN: un grupo por tipo de pendiente, en orden de urgencia (en
 * vivo → hoy → por agendar → ventanas abiertas → semana → sin curso →
 * informes → cursos). Cada fila lleva a donde se resuelve; lo que excede tres
 * filas se despliega sin JS (<details>).
 */
export function ColaAccion({ grupos }: { grupos: GrupoAccion[] }) {
  return (
    <div>
      {grupos.map((g, gi) => {
        const Icono = ICONO_GRUPO[g.clave] ?? ClipboardCheck;
        const visibles = g.entradas.slice(0, VISIBLES);
        const resto = g.entradas.slice(VISIBLES);
        return (
          <div key={g.clave} className="tut-grupo revelar" data-tono={g.tono} style={{ ["--i" as string]: gi + 2 } as CSSProperties}>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="tut-sello">
                {g.tono === "vivo" ? <span className="punto-vivo" aria-hidden="true" /> : <Icono className="h-3 w-3" aria-hidden="true" />}
                {g.sello}
              </span>
              <p className="tut-grupo-titulo">{g.titulo}</p>
            </div>
            <p className="tut-grupo-bajada mt-1">{g.bajada}</p>
            <ul className="mt-1.5">
              {visibles.map((e, i) => (
                <FilaAccion key={`${e.href}-${i}`} entrada={e} cta={g.cta} />
              ))}
            </ul>
            {resto.length > 0 && (
              <details className="tut-mas">
                <summary className="mono-label inline-flex items-center gap-1.5 py-1.5 hover:text-foreground">
                  <span className="cerrado">+ {resto.length} más</span>
                  <span className="abierto">Mostrar menos</span>
                </summary>
                <ul>
                  {resto.map((e, i) => (
                    <FilaAccion key={`${e.href}-r${i}`} entrada={e} cta={g.cta} />
                  ))}
                </ul>
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FilaAccion({ entrada, cta }: { entrada: GrupoAccion["entradas"][number]; cta: string }) {
  return (
    <li className="tut-fila">
      <span className="marca" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <Link href={entrada.href} className="principal block truncate text-[13px] font-semibold text-foreground" title={entrada.titulo}>
          {tituloLegible(entrada.titulo)}
        </Link>
        <p className="truncate text-[11.5px] text-muted-foreground">{entrada.detalle}</p>
      </div>
      {entrada.extra && (
        <a href={entrada.extra.href} className="tut-extra sobre" target={entrada.extra.href.startsWith("/api/") ? undefined : "_blank"} rel="noreferrer">
          {entrada.extra.etiqueta}
        </a>
      )}
      <span className="sobre hidden font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground sm:inline" aria-hidden="true">
        {cta}
      </span>
      <ArrowRight className="flecha h-3.5 w-3.5" aria-hidden="true" />
    </li>
  );
}
