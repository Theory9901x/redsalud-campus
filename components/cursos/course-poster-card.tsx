import Link from "next/link";
import Image from "next/image";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { COURSE_TYPE_ICONS, COURSE_TYPE_COLORS } from "@/components/cursos/labels";
import { DotPattern } from "@/components/brand/dot-pattern";
import { coursePhotoTransitionName } from "@/lib/view-transition-names";
import type { CourseType } from "@prisma/client";

export type CoursePosterMeta = { icon: LucideIcon; label: string };

export function CoursePosterCard({
  href,
  imageUrl,
  title,
  courseType,
  eyebrow,
  audienceLabel,
  statusBadge,
  meta,
  progress,
  progressLabel,
  ctaLabel = "Ver curso",
}: {
  href: string;
  imageUrl: string | null;
  title: string;
  courseType: CourseType;
  eyebrow?: string | null;
  /** Chip discreto (p. ej. "Asistencial"); solo pásalo cuando el curso no sea para todo el personal. */
  audienceLabel?: string | null;
  statusBadge?: { label: string; dotClassName: string };
  meta: CoursePosterMeta[];
  progress?: number;
  progressLabel?: string;
  /** Texto del botón de acción ("Ver curso" / "Inscribirme" / "Continuar" / "Revisar curso" según el estado del llamador). */
  ctaLabel?: string;
}) {
  const TypeIcon = COURSE_TYPE_ICONS[courseType];
  const colors = COURSE_TYPE_COLORS[courseType];

  return (
    <Link
      href={href}
      // @container: la densidad interna (qué meta se muestra) reacciona al
      // ancho REAL de la tarjeta -grilla de 4 columnas, 2, carrusel o
      // sidebar-, no al viewport completo.
      // Hover: elevación (surface-hover) + escala sutil + brillo del borde con
      // color de marca, en 300ms.
      className="surface-hover group @container relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-2xl shadow-md shadow-black/15 ring-1 ring-black/5 transition-[scale,box-shadow] duration-300 hover:scale-[1.02] hover:ring-primary/40"
    >
      <div className="absolute inset-0">
        {imageUrl ? (
          // Mismo view-transition-name que la portada del detalle del curso
          // (cursos/[slug]/page.tsx): el navegador morfea la miniatura hacia
          // la imagen de portada al navegar, en vez de un corte seco entre
          // dos fotos distintas. CSS puro (sin el componente <ViewTransition>
          // de React, que requiere una versión canary que este proyecto no
          // usa) -- ver components/brand/native-view-transitions.tsx.
          <Image
            src={imageUrl}
            alt={title}
            fill
            sizes="(min-width: 1280px) 300px, (min-width: 640px) 45vw, 90vw"
            className="fade-edge object-cover transition-transform duration-300 group-hover:scale-105"
            style={{ viewTransitionName: coursePhotoTransitionName(href) }}
          />
        ) : (
          <div className={cn("relative h-full w-full bg-gradient-to-br", colors.gradient)}>
            <DotPattern className="text-white/25" />
            <div className="flex h-full items-center justify-center">
              <TypeIcon className="h-14 w-14 text-white/40" strokeWidth={1.5} />
            </div>
          </div>
        )}
      </div>

      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/55 via-45% to-transparent" />

      <span className={cn("absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl shadow-sm", colors.iconBox)}>
        <TypeIcon className="h-4 w-4 text-white" strokeWidth={2} />
      </span>

      {statusBadge && (
        <span className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-navy shadow-sm backdrop-blur">
          <span className={cn("h-1.5 w-1.5 rounded-full", statusBadge.dotClassName)} />
          {statusBadge.label}
        </span>
      )}

      <div className="relative z-10 space-y-1.5 p-4 text-white">
        {(eyebrow || audienceLabel) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {eyebrow && <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">{eyebrow}</p>}
            {audienceLabel && (
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/90">
                {audienceLabel}
              </span>
            )}
          </div>
        )}
        <h3 className="font-display text-lg font-extrabold leading-snug line-clamp-2">{title}</h3>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/80">
          {meta.map((item, index) => (
            // El segundo dato (p. ej. el nombre del tutor) se oculta cuando
            // la tarjeta misma es angosta (grilla de 4 columnas): a ese ancho
            // ambos datos juntos se amontonan y dejan de leerse bien.
            <span key={index} className={cn("flex items-center gap-1", index > 0 && "hidden @xs:flex")}>
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </span>
          ))}
        </div>
        {progress !== undefined && (
          <div className="pt-1.5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/25">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-success"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
            {progressLabel && <p className="mt-1 text-[11px] text-white/70">{progressLabel}</p>}
          </div>
        )}

        {/*
         * Botón de acción explícito: antes la tarjeta entera era clicable sin
         * ningún indicio visual de qué pasaba al hacerlo ("click implícito").
         * No es un elemento interactivo aparte -toda la tarjeta ya es el
         * <Link>-, es la señal visual de que existe una acción clara.
         * Gradiente de marca (primary->success) siempre, sin importar el
         * color por tipo de curso: es LA acción, no un acento más.
         */}
        <span className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-lg bg-gradient-to-r from-primary to-success px-3 py-1.5 text-xs font-bold text-white shadow-lg shadow-primary/25 transition-transform duration-200 group-hover:translate-x-0.5">
          {ctaLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}
