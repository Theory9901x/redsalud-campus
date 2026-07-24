import Link from "next/link";
import Image from "next/image";
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
import { coursePhotoTransitionName } from "@/lib/view-transition-names";

export type EstadoTarjeta = "obligatorio" | "en-curso" | "completado" | "disponible";

/**
 * Definición visual de cada estado. El color sale de los tokens semánticos, no
 * de hex fijos: así los degradados rinden en oscuro (card oscuro → profundo) y
 * en claro (card blanco → tinte suave) sin escribir cada estado dos veces.
 */
const ESTADOS: Record<EstadoTarjeta, { color: string; icono: LucideIcon; etiqueta: string }> = {
  obligatorio: { color: "var(--destructive)", icono: AlertTriangle, etiqueta: "Obligatorio" },
  "en-curso": { color: "var(--primary)", icono: BookOpen, etiqueta: "En curso" },
  completado: { color: "var(--success)", icono: CheckCircle2, etiqueta: "Completado" },
  disponible: { color: "var(--accent)", icono: Sparkles, etiqueta: "Disponible" },
};

export type CursoTarjeta = {
  id: string;
  href: string;
  imageUrl: string | null;
  titulo: string;
  descripcion: string;
  horas: number;
  institucion: string;
  estado: EstadoTarjeta;
  progreso?: number;
  completadoEl?: string | null;
  cta: string;
};

/**
 * Tarjeta de curso: encabezado visual arriba (foto o banda con el ícono del
 * estado) y cuerpo de texto abajo. El texto NUNCA va sobre la imagen —así la
 * portada, que suele traer su propio texto, no compite con el título—; queda
 * sobre el cuerpo sólido de la tarjeta, siempre legible. Todas las tarjetas
 * comparten la misma estructura: cambia el encabezado, no la maqueta.
 */
export function CourseStateCard({ curso }: { curso: CursoTarjeta }) {
  const e = ESTADOS[curso.estado];
  const { color } = e;
  const Icono = e.icono;
  const conFoto = Boolean(curso.imageUrl);

  return (
    <Link
      href={curso.href}
      style={{ borderColor: `color-mix(in oklch, ${color} 30%, transparent)` }}
      className="group flex flex-col overflow-hidden rounded-2xl border bg-card shadow-[var(--shadow-1)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-2)]"
    >
      {/* Encabezado: la foto limpia, o una banda con el color y el ícono del
          estado cuando el curso no tiene portada. Solo la insignia y el
          marcador van encima. */}
      <div className="relative h-36 shrink-0 overflow-hidden">
        {conFoto ? (
          <>
            <Image
              src={curso.imageUrl!}
              alt={curso.titulo}
              fill
              sizes="(min-width: 1280px) 400px, (min-width: 768px) 45vw, 100vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              style={{ viewTransitionName: coursePhotoTransitionName(curso.href) }}
            />
            {/* Tinte del estado sobre la foto, para no perder el color. */}
            <div
              className="absolute inset-0"
              style={{ backgroundImage: `linear-gradient(160deg, transparent 40%, color-mix(in oklch, ${color} 30%, transparent))` }}
            />
          </>
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{
              backgroundImage: `linear-gradient(150deg, color-mix(in oklch, ${color} 34%, var(--card)) 0%, color-mix(in oklch, ${color} 14%, var(--card)) 100%)`,
            }}
          >
            <Icono
              className="h-14 w-14"
              style={{ color: `color-mix(in oklch, ${color} 55%, transparent)` }}
              strokeWidth={1.5}
            />
          </div>
        )}

        <span
          style={{ backgroundColor: color }}
          className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm"
        >
          <Icono className="h-3 w-3" strokeWidth={2.5} />
          {e.etiqueta}
        </span>
        <button
          type="button"
          aria-label="Guardar curso"
          className="absolute right-3 top-3 text-white/70 drop-shadow transition-colors hover:text-white"
        >
          <Bookmark className="h-[18px] w-[18px]" />
        </button>
      </div>

      {/* Cuerpo: título + descripción + metadatos + acción, todo sobre sólido. */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-display text-[16px] font-extrabold leading-snug text-foreground" title={curso.titulo}>
          {curso.titulo}
        </h3>
        <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-muted-foreground">
          {curso.descripcion}
        </p>

        <div className="mt-3 flex items-center gap-3 text-[11.5px] text-muted-foreground">
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

        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
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

          {/* CTA con el color del estado, para que la acción pertenezca a la tarjeta. */}
          <span
            style={{
              backgroundColor: `color-mix(in oklch, ${color} 16%, transparent)`,
              borderColor: `color-mix(in oklch, ${color} 40%, transparent)`,
            }}
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border px-3.5 py-2 text-[13px] font-semibold text-foreground transition-transform duration-200 group-hover:translate-x-0.5"
          >
            {curso.cta}
            <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Link>
  );
}
