"use client";

import Link from "next/link";
import { ArrowLeft, Award } from "lucide-react";
import { COURSE_TYPE_LABELS } from "@/components/cursos/labels";
import { AuroraWebGL } from "@/components/cursos/aurora-webgl";
import { Cifra } from "@/components/training-plans/plan-dinamico";
import type { CourseType } from "@prisma/client";

/**
 * Cabecera del AULA, mismo lenguaje que la página pública del curso: aurora
 * WebGL de fondo (en vez de la portada estirada, que dejaba letras gigantes
 * cortadas detrás del título), etiqueta en monoespaciada, título de display e
 * instrumentos de vidrio con las cifras del curso.
 *
 * `imageUrl` se conserva en la firma por compatibilidad con el layout; la
 * portada se sigue mostrando en el catálogo y en las tarjetas del panel.
 */
export function AulaHeader({
  title,
  courseType,
  durationHours,
  moduleCount,
  lessonCount,
}: {
  courseId: string;
  title: string;
  imageUrl: string | null;
  courseType: CourseType;
  durationHours: number;
  moduleCount: number;
  lessonCount: number;
}) {
  const instrumentos = [
    { valor: durationHours, sufijo: "h", etiqueta: "Intensidad" },
    { valor: moduleCount, sufijo: "", etiqueta: moduleCount === 1 ? "Módulo" : "Módulos" },
    { valor: lessonCount, sufijo: "", etiqueta: lessonCount === 1 ? "Lección" : "Lecciones" },
  ].filter((x) => x.valor > 0);

  return (
    <header className="aula-hero relative isolate overflow-hidden">
      <AuroraWebGL />
      <div className="contenido relative z-[1] flex flex-col gap-5 px-4 py-6 sm:px-8 sm:py-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 max-w-3xl">
          <Link
            href="/inicio"
            className="flex w-fit items-center gap-2 rounded-lg text-[13px] font-semibold text-white/70 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/60"
          >
            <ArrowLeft className="h-4 w-4" />
            Mi panel
          </Link>
          <p className="curso-eyebrow mt-4">Aula · {COURSE_TYPE_LABELS[courseType]}</p>
          <h1 className="mt-2 font-display text-[clamp(1.6rem,1.2rem+1.6vw,2.4rem)] font-bold leading-[1.08] tracking-[-0.025em] text-white [text-wrap:balance]">
            {title}
          </h1>
        </div>

        <div className="flex flex-wrap items-stretch gap-2">
          {instrumentos.map((x) => (
            <div key={x.etiqueta} className="instrumento min-w-[92px]">
              <b>
                <Cifra valor={x.valor} sufijo={x.sufijo} />
              </b>
              <span>{x.etiqueta}</span>
            </div>
          ))}
          <div className="instrumento flex min-w-[120px] items-center gap-2">
            <Award className="h-5 w-5 shrink-0 text-[color-mix(in_oklch,var(--success)_70%,white)]" aria-hidden="true" />
            <div>
              <b className="!text-[0.95rem]">Certificado</b>
              <span className="mt-0.5 block font-mono text-[0.6rem] uppercase tracking-[0.16em] text-white/55">al finalizar</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
