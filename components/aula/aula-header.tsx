"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Clock } from "lucide-react";
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
 * de golpe, para que el primer render del aula se sienta como entrar a un
 * espacio distinto.
 */
export function AulaHeader({
  courseId,
  title,
  imageUrl,
  courseType,
  durationHours,
  progress,
}: {
  courseId: string;
  title: string;
  imageUrl: string | null;
  courseType: CourseType;
  durationHours: number;
  progress: number;
}) {
  const TypeIcon = COURSE_TYPE_ICONS[courseType];
  const colors = COURSE_TYPE_COLORS[courseType];

  return (
    <header className="relative isolate overflow-hidden border-b border-border">
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
        <div className="absolute inset-0 bg-gradient-to-t from-navy/95 via-navy/70 to-navy/30" />
      </div>

      <div className="relative flex flex-col gap-6 px-4 py-6 sm:px-8 sm:py-9">
        <Link
          href="/inicio"
          className="flex w-fit items-center gap-2 text-sm text-white/70 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Mi panel
        </Link>

        <div className="max-w-2xl">
          <motion.span
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${colors.badge} bg-white/95`}
          >
            <TypeIcon className="h-3.5 w-3.5" />
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

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.18 }}
            className="mt-4 flex flex-wrap items-center gap-4"
          >
            <span className="flex items-center gap-1.5 text-sm text-white/70">
              <Clock className="h-4 w-4" />
              {durationHours}h de intensidad horaria
            </span>
            <div className="flex min-w-40 items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-success transition-all duration-700"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-white/80">{progress}%</span>
            </div>
          </motion.div>
        </div>
      </div>
    </header>
  );
}
