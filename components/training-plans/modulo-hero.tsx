import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Cifra } from "@/components/training-plans/plan-dinamico";

/**
 * Héroe de módulo sobre el navy de marca (.hud-hero): eyebrow, título de
 * display con acento, descripción, cifras-instrumento con conteo, y una
 * franja inferior libre (p. ej. el riel de trimestres). La marca de agua es
 * opcional (el año del plan, por ejemplo).
 */
export function ModuloHero({
  eyebrow,
  Icono,
  titulo,
  acento,
  descripcion,
  marca,
  cifras = [],
  acciones,
  pie,
  lateral,
  className,
}: {
  eyebrow: string;
  Icono?: LucideIcon;
  titulo: string;
  /** Parte final del título pintada con el degradado de marca. */
  acento?: string;
  descripcion?: ReactNode;
  marca?: string | number;
  cifras?: { valor: ReactNode; etiqueta: string }[];
  acciones?: ReactNode;
  pie?: ReactNode;
  /** Bloque a la derecha del título (p. ej. el anillo de cumplimiento). */
  lateral?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("hud-hero hud-grid noise-overlay plan-hero revelar p-6 sm:p-8", className)}>
      <span className="barrido-luz" aria-hidden="true" />
      <span className="marco-hud" aria-hidden="true" />
      {marca !== undefined && <span className="plan-hero-marca" aria-hidden="true">{marca}</span>}

      <div className="relative z-[1] flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 max-w-3xl">
          <p className="plan-hero-eyebrow">
            {Icono && <Icono className="h-3.5 w-3.5" aria-hidden="true" />}
            {eyebrow}
          </p>
          <h1 className="plan-hero-title mt-3">
            {titulo}
            {acento && (
              <>
                {" "}
                <span className="acento">{acento}</span>
              </>
            )}
          </h1>
          {descripcion && <div className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-white/70">{descripcion}</div>}
          {acciones && <div className="mt-5 flex flex-wrap items-center gap-2">{acciones}</div>}
        </div>
        {lateral && <div className="shrink-0">{lateral}</div>}
      </div>

      {cifras.length > 0 && (
        <div className="relative z-[1] mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {cifras.map((c) => (
            <div key={c.etiqueta} className="kpi-vidrio">
              <p className="valor">{typeof c.valor === "number" ? <Cifra valor={c.valor} /> : c.valor}</p>
              <p className="etiqueta">{c.etiqueta}</p>
            </div>
          ))}
        </div>
      )}

      {pie && <div className="relative z-[1] mt-6">{pie}</div>}
    </section>
  );
}
