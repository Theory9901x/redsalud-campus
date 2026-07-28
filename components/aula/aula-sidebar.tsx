"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ListTree, X } from "lucide-react";
import { SIGNATURE_DURATION, SIGNATURE_EASE } from "@/lib/motion";
import { AnilloProgreso } from "@/components/aula/anillo-progreso";
import { ContenidoCurso } from "@/components/aula/contenido-curso";
import { COURSE_TYPE_LABELS } from "@/components/cursos/labels";
import type { AulaModule, AulaProgreso, AulaQuiz } from "@/lib/aula";
import type { CourseType } from "@prisma/client";

/**
 * Carril izquierdo del aula: cabecera de progreso + contenido del curso.
 *
 * En escritorio es un carril fijo; en móvil, un cajón que se abre desde un
 * botón flotante. Los dos montan exactamente los mismos componentes, así que
 * no hay dos versiones del temario que puedan divergir.
 */
export function AulaSidebar({
  courseId,
  courseTitle,
  courseType,
  progreso,
  modules,
  finalQuizzes,
}: {
  courseId: string;
  courseTitle: string;
  courseType: CourseType;
  progreso: AulaProgreso;
  modules: AulaModule[];
  finalQuizzes: AulaQuiz[];
}) {
  const pathname = usePathname();
  /**
   * El cajón guarda la ruta en la que se abrió, no un booleano. Así, al
   * navegar a otra lección deja de coincidir y se cierra solo, derivado
   * durante el render: cerrarlo desde un useEffect provocaba un render en
   * cascada en cada navegación.
   */
  const [abiertoEn, setAbiertoEn] = useState<string | null>(null);
  const cajonAbierto = abiertoEn === pathname;

  // El id de la lección actual sale de la ruta: /aula/<curso>/<leccion>.
  const partes = pathname.split("/").filter(Boolean);
  const leccionActualId =
    partes[1] === courseId && partes[2] && partes[2] !== "quiz" ? partes[2] : null;

  const cabecera = (
    <div className="surface-glass flex items-center gap-4 p-5">
      <AnilloProgreso porcentaje={progreso.porcentaje} />
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-base font-bold leading-tight text-foreground">{courseTitle}</h2>
        <p className="text-xs text-muted-foreground">{COURSE_TYPE_LABELS[courseType]}</p>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_oklch,var(--accent)_14%,transparent)]">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500"
            style={{ width: `${progreso.porcentaje}%` }}
          />
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          {progreso.completadasRequeridas} de {progreso.totalRequeridas} lecciones completadas
          {/* Se dice explícitamente que faltan cuestionarios: si no, alguien
              con el 100 % de lecciones y sin certificado no entiende por qué. */}
          {progreso.porcentaje === 100 && progreso.cuestionariosPendientes > 0 && (
            <>
              {" · "}
              <span className="font-semibold text-warning">
                falta {progreso.cuestionariosPendientes === 1 ? "la evaluación" : "las evaluaciones"}
              </span>
            </>
          )}
        </p>
      </div>
    </div>
  );

  const contenido = (
    <ContenidoCurso
      courseId={courseId}
      leccionActualId={leccionActualId}
      modulos={modules}
      cuestionariosFinales={finalQuizzes}
    />
  );

  return (
    <>
      {/* Móvil: botón flotante que abre el temario. */}
      <button
        type="button"
        onClick={() => setAbiertoEn(pathname)}
        className="surface-clay fixed bottom-5 left-4 z-40 flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-foreground transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-[var(--accent)] lg:hidden"
      >
        <ListTree className="h-4 w-4 text-[var(--accent)]" />
        Contenido del curso
      </button>

      <AnimatePresence>
        {cajonAbierto && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-navy/40 backdrop-blur-sm lg:hidden"
              onClick={() => setAbiertoEn(null)}
              aria-hidden="true"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: SIGNATURE_DURATION, ease: SIGNATURE_EASE }}
              className="fixed inset-y-0 left-0 z-50 flex w-[88vw] max-w-sm flex-col gap-3 overflow-y-auto bg-[var(--canvas-base)] p-3 lg:hidden"
            >
              <div className="flex items-center justify-between px-2">
                <p className="font-display text-sm font-bold text-foreground">Contenido del curso</p>
                <button
                  type="button"
                  onClick={() => setAbiertoEn(null)}
                  aria-label="Cerrar contenido del curso"
                  className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {cabecera}
              {contenido}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Escritorio: carril de altura FIJA con su propio desplazamiento.
          Con max-h el carril crecía y encogía según el módulo abierto, y eso
          movía la página entera cada vez. Con altura fija, abrir un módulo
          solo desplaza dentro del carril.

          overscroll-contain evita que al llegar al final del carril el scroll
          continúe en la columna de al lado.
          [&>*]:shrink-0 porque en un contenedor flex los hijos se comprimen
          por defecto en vez de desbordar, y entonces no habría qué desplazar. */}
      <aside className="hidden h-full w-[340px] shrink-0 flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-4 lg:flex [&>*]:shrink-0">
        {cabecera}
        {contenido}
      </aside>
    </>
  );
}
