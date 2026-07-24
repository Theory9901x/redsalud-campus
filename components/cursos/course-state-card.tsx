import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Bookmark,
  BookOpen,
  Building2,
  CheckCircle2,
  Circle,
  Clock,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type EstadoTarjeta = "obligatorio" | "en-curso" | "completado" | "disponible";

/**
 * Definición visual de cada estado.
 *
 * Los degradados y bordes salen de los tokens semánticos vía color-mix contra
 * `--card`, no de hex fijos: así la MISMA tarjeta funciona en oscuro (card
 * oscuro → degradado rico y profundo) y en claro (card blanco → tinte suave),
 * sin escribir cada estado dos veces. La insignia y la marca de agua usan el
 * color puro del estado.
 */
const ESTADOS: Record<
  EstadoTarjeta,
  { color: string; icono: LucideIcon; etiqueta: string }
> = {
  obligatorio: { color: "var(--destructive)", icono: AlertTriangle, etiqueta: "Obligatorio" },
  "en-curso": { color: "var(--primary)", icono: BookOpen, etiqueta: "En curso" },
  completado: { color: "var(--success)", icono: CheckCircle2, etiqueta: "Completado" },
  disponible: { color: "var(--accent)", icono: Sparkles, etiqueta: "Disponible" },
};

export type CursoTarjeta = {
  id: string;
  href: string;
  titulo: string;
  descripcion: string;
  horas: number;
  institucion: string;
  estado: EstadoTarjeta;
  progreso?: number;
  completadoEl?: string | null;
  cta: string;
};

export function CourseStateCard({ curso }: { curso: CursoTarjeta }) {
  const e = ESTADOS[curso.estado];
  const { color } = e;
  const MarcaAgua = e.icono;

  return (
    <Link
      href={curso.href}
      style={{
        // Degradado diagonal desde un tinte del color de estado hacia el card.
        backgroundImage: `linear-gradient(150deg, color-mix(in oklch, ${color} 20%, var(--card)) 0%, color-mix(in oklch, ${color} 8%, var(--card)) 55%, var(--card) 100%)`,
        borderColor: `color-mix(in oklch, ${color} 32%, transparent)`,
      }}
      className="group relative flex min-h-[212px] flex-col overflow-hidden rounded-2xl border p-5 shadow-[var(--shadow-1)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-2)]"
    >
      {/* Marca de agua: ícono grande del estado, muy tenue, detrás del texto. */}
      <MarcaAgua
        className="pointer-events-none absolute -right-2 top-1/2 h-28 w-28 -translate-y-1/2"
        style={{ color: `color-mix(in oklch, ${color} 12%, transparent)` }}
        strokeWidth={1.5}
      />

      {/* Fila superior: insignia de estado + marcador. */}
      <div className="relative flex items-start justify-between">
        <span
          style={{ backgroundColor: color }}
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm"
        >
          <e.icono className="h-3 w-3" strokeWidth={2.5} />
          {e.etiqueta}
        </span>
        <Bookmark className="h-[18px] w-[18px] text-foreground/25 transition-colors group-hover:text-foreground/50" />
      </div>

      {/* Título + descripción. */}
      <h3 className="relative mt-3 max-w-[88%] font-display text-[17px] font-extrabold leading-snug text-foreground">
        {curso.titulo}
      </h3>
      <p className="relative mt-1.5 line-clamp-2 max-w-[88%] text-[12.5px] leading-relaxed text-muted-foreground">
        {curso.descripcion}
      </p>

      {/* Metadatos: horas · institución. */}
      <div className="relative mt-3 flex items-center gap-3 text-[11.5px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          {curso.horas} h
        </span>
        <span className="h-3 w-px bg-border" />
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{curso.institucion}</span>
        </span>
      </div>

      {/* Zona inferior variable por estado. */}
      <div className="relative mt-auto flex items-end justify-between gap-3 pt-4">
        {curso.estado === "en-curso" && curso.progreso !== undefined ? (
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-medium text-foreground">{Math.round(curso.progreso)}% completado</p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-foreground/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[color-mix(in_oklch,var(--accent)_60%,var(--success))]"
                style={{ width: `${Math.min(100, Math.max(0, curso.progreso))}%` }}
              />
            </div>
          </div>
        ) : curso.estado === "completado" ? (
          <p className="inline-flex items-center gap-1.5 text-[12px] font-medium text-success">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {curso.completadoEl ? `Completado el ${curso.completadoEl}` : "Completado"}
          </p>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11.5px] text-muted-foreground">
            <Circle className="h-3 w-3" />
            Sin iniciar
          </span>
        )}

        {/* CTA: el color del relleno lo pone el estado, para que la acción
            pertenezca visualmente a la tarjeta y no sea un botón neutro pegado. */}
        <span
          style={{
            backgroundColor: `color-mix(in oklch, ${color} 16%, transparent)`,
            borderColor: `color-mix(in oklch, ${color} 35%, transparent)`,
          }}
          className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border px-3.5 py-2 text-[13px] font-semibold text-foreground transition-transform duration-200 group-hover:translate-x-0.5"
        >
          {curso.cta}
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}
