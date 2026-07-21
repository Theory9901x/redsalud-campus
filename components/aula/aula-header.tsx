"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Award, BookOpen, Clock, Layers } from "lucide-react";
import { DotPattern } from "@/components/brand/dot-pattern";
import { COURSE_TYPE_COLORS, COURSE_TYPE_ICONS, COURSE_TYPE_LABELS } from "@/components/cursos/labels";
import { coursePhotoTransitionName } from "@/lib/view-transition-names";
import type { CourseType } from "@prisma/client";

/**
 * Momento signature 3: la tarjeta de curso en el dashboard "se expande" en
 * este encabezado -mismo view-transition-name que CoursePosterCard cuando
 * enlaza a /aula/[courseId] (ver lib/view-transition-names.ts)-, así que el
 * navegador anima una continuidad visual real en vez de un salto entre
 * vistas. El texto entra en coreografía (badge -> título -> meta), no todo
 * de golpe. Sobre el degradado de marca van orbes de luz desenfocados +
 * grano sutil (.noise-overlay), y los metadatos viven en chips glass.
 */
export function AulaHeader({
  courseId,
  title,
  imageUrl,
  courseType,
  durationHours,
  progress,
  moduleCount,
  lessonCount,
}: {
  courseId: string;
  title: string;
  imageUrl: string | null;
  courseType: CourseType;
  durationHours: number;
  progress: number;
  moduleCount: number;
  lessonCount: number;
}) {
  const TypeIcon = COURSE_TYPE_ICONS[courseType];
  const colors = COURSE_TYPE_COLORS[courseType];
  const isObligatorio = courseType === "OBLIGATORIO";

  return (
    <header className="noise-overlay relative isolate overflow-hidden border-b border-border">
      <div className="absolute inset-0">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={title}
            fill
            sizes="100vw"
            priority
            className="object-cover"
            style={{ viewTransitionName: coursePhotoTransitionName(`/aula/${courseId}`) }}
          />
        ) : (
          <div className={`relative h-full w-full bg-gradient-to-br ${colors.gradient}`}>
            <DotPattern className="text-white/20" />
          </div>
        )}
        {/* Scrim navy + mesh de marca encima: el mesh aporta variación de color,
            el scrim garantiza contraste del texto sobre cualquier foto. */}
        <div className="absolute inset-0 bg-gradient-to-t from-navy/95 via-navy/70 to-navy/30" />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 12% 10%, color-mix(in oklch, var(--primary) 26%, transparent), transparent 50%), radial-gradient(circle at 90% 85%, color-mix(in oklch, var(--success) 18%, transparent), transparent 45%)",
          }}
        />
        {/* Orbes de luz difuminados detrás del título (blur 80px+), parientes
            de las tarjetas flotantes del login. */}
        <div className="absolute -left-16 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-primary/35 blur-[90px]" />
        <div className="absolute right-[15%] -top-20 h-56 w-56 rounded-full bg-success/25 blur-[100px]" />
        <div className="absolute bottom-0 right-0 h-40 w-40 rounded-full bg-white/15 blur-[80px]" />
      </div>

      <div className="relative flex flex-col gap-6 px-4 py-6 sm:px-8 sm:py-9">
        <Link
          href="/inicio"
          className="flex w-fit items-center gap-2 rounded-lg text-sm text-white/70 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/60"
        >
          <ArrowLeft className="h-4 w-4" />
          Mi panel
        </Link>

        <div className="max-w-3xl">
          <motion.span
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white backdrop-blur-md"
            style={
              isObligatorio
                ? { boxShadow: "0 0 18px color-mix(in oklch, var(--destructive) 45%, transparent)" }
                : undefined
            }
          >
            <TypeIcon className={`h-3.5 w-3.5 ${isObligatorio ? "text-red-300" : ""}`} />
            {COURSE_TYPE_LABELS[courseType]}
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08 }}
            className="text-display-lg mt-3 font-display font-extrabold text-white text-balance"
          >
            {title}
          </motion.h1>

          {/* Fila de chips glass: metadatos rápidos del curso. */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.16 }}
            className="mt-4 flex flex-wrap items-center gap-2"
          >
            <span className="chip-glass">
              <Clock className="h-3.5 w-3.5 text-primary" />
              {durationHours}h de intensidad
            </span>
            <span className="chip-glass">
              <Layers className="h-3.5 w-3.5 text-primary" />
              {moduleCount} {moduleCount === 1 ? "módulo" : "módulos"}
            </span>
            <span className="chip-glass">
              <BookOpen className="h-3.5 w-3.5 text-primary" />
              {lessonCount} {lessonCount === 1 ? "lección" : "lecciones"}
            </span>
            <span className="chip-glass">
              <Award className="h-3.5 w-3.5 text-success" />
              Certificado al finalizar
            </span>
          </motion.div>

          {/* Barra de progreso gruesa con degradado animado + porcentaje en chip. */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.24 }}
            className="mt-5 flex max-w-xl items-center gap-3"
          >
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/20">
              <div
                className="progress-fill-animated h-full rounded-full transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="chip-glass font-semibold">{progress}%</span>
          </motion.div>
        </div>
      </div>
    </header>
  );
}
