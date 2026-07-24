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

export function CourseStateCard({ curso }: { curso: CursoTarjeta }) {
  const e = ESTADOS[curso.estado];
  const { color } = e;
  const Badge = e.icono;
  const conFoto = Boolean(curso.imageUrl);

  // Sobre una foto el texto va en blanco (con velo oscuro debajo); sin foto, en
  // los tokens de texto del tema.
  const tTitulo = conFoto ? "text-white" : "text-foreground";
  const tCuerpo = conFoto ? "text-white/80" : "text-muted-foreground";
  const tMeta = conFoto ? "text-white/75" : "text-muted-foreground";

  return (
    <Link
      href={curso.href}
      style={
        conFoto
          ? { borderColor: `color-mix(in oklch, ${color} 38%, transparent)` }
          : {
              backgroundImage: `linear-gradient(150deg, color-mix(in oklch, ${color} 20%, var(--card)) 0%, color-mix(in oklch, ${color} 8%, var(--card)) 55%, var(--card) 100%)`,
              borderColor: `color-mix(in oklch, ${color} 32%, transparent)`,
            }
      }
      className="group relative flex min-h-[224px] flex-col justify-end overflow-hidden rounded-2xl border p-5 shadow-[var(--shadow-1)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-2)]"
    >
      {conFoto ? (
        <div className="absolute inset-0">
          <Image
            src={curso.imageUrl!}
            alt={curso.titulo}
            fill
            sizes="(min-width: 1280px) 400px, (min-width: 768px) 45vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            style={{ viewTransitionName: coursePhotoTransitionName(curso.href) }}
          />
          {/* Velo oscuro de abajo hacia arriba para leer el texto. */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/92 via-black/55 to-black/10" />
          {/* Tinte del estado, para que la foto siga comunicando el color. */}
          <div
            className="absolute inset-0"
            style={{ backgroundImage: `linear-gradient(to top, color-mix(in oklch, ${color} 42%, transparent), transparent 58%)` }}
          />
        </div>
      ) : (
        // Sin foto: marca de agua del ícono del estado detrás del texto.
        <Badge
          className="pointer-events-none absolute -right-2 top-1/2 h-28 w-28 -translate-y-1/2"
          style={{ color: `color-mix(in oklch, ${color} 12%, transparent)` }}
          strokeWidth={1.5}
        />
      )}

      {/* Insignia + marcador, fijados arriba. */}
      <div className="absolute inset-x-5 top-5 z-10 flex items-start justify-between">
        <span
          style={{ backgroundColor: color }}
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm"
        >
          <Badge className="h-3 w-3" strokeWidth={2.5} />
          {e.etiqueta}
        </span>
        <Bookmark
          className={cn(
            "h-[18px] w-[18px] transition-colors",
            conFoto ? "text-white/50 group-hover:text-white/80" : "text-foreground/25 group-hover:text-foreground/50"
          )}
        />
      </div>

      {/* Bloque de contenido, anclado abajo. */}
      <div className="relative">
        <h3 className={cn("max-w-[88%] font-display text-[17px] font-extrabold leading-snug", tTitulo)}>
          {curso.titulo}
        </h3>
        <p className={cn("mt-1.5 line-clamp-2 max-w-[92%] text-[12.5px] leading-relaxed", tCuerpo)}>
          {curso.descripcion}
        </p>

        <div className={cn("mt-3 flex items-center gap-3 text-[11.5px]", tMeta)}>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {curso.horas} h
          </span>
          <span className={cn("h-3 w-px", conFoto ? "bg-white/25" : "bg-border")} />
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{curso.institucion}</span>
          </span>
        </div>

        <div className="mt-4 flex items-end justify-between gap-3">
          {curso.estado === "en-curso" && curso.progreso !== undefined ? (
            <div className="min-w-0 flex-1">
              <p className={cn("text-[12px] font-medium", tTitulo)}>{Math.round(curso.progreso)}% completado</p>
              <div className={cn("mt-1.5 h-1.5 overflow-hidden rounded-full", conFoto ? "bg-white/25" : "bg-foreground/10")}>
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[color-mix(in_oklch,var(--accent)_60%,var(--success))]"
                  style={{ width: `${Math.min(100, Math.max(0, curso.progreso))}%` }}
                />
              </div>
            </div>
          ) : curso.estado === "completado" ? (
            <p className={cn("inline-flex items-center gap-1.5 text-[12px] font-medium", conFoto ? "text-white" : "text-success")}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              {curso.completadoEl ? `Completado el ${curso.completadoEl}` : "Completado"}
            </p>
          ) : (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px]",
                conFoto ? "border-white/25 text-white/85" : "border-border text-muted-foreground"
              )}
            >
              <Circle className="h-3 w-3" />
              Sin iniciar
            </span>
          )}

          {/* CTA con el color del estado, para que la acción pertenezca a la
              tarjeta. Sobre foto lleva algo de sólido para despegarse. */}
          <span
            style={{
              backgroundColor: conFoto
                ? `color-mix(in oklch, ${color} 30%, rgba(0,0,0,0.55))`
                : `color-mix(in oklch, ${color} 16%, transparent)`,
              borderColor: `color-mix(in oklch, ${color} 45%, transparent)`,
            }}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border px-3.5 py-2 text-[13px] font-semibold transition-transform duration-200 group-hover:translate-x-0.5",
              conFoto ? "text-white backdrop-blur-sm" : "text-foreground"
            )}
          >
            {curso.cta}
            <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Link>
  );
}
