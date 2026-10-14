"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ListTree, X } from "lucide-react";
import { SIGNATURE_DURATION, SIGNATURE_EASE } from "@/lib/motion";
import { AnilloPorcentaje } from "@/components/training-plans/plan-visual";
import { ContenidoCurso } from "@/components/aula/contenido-curso";
import { HerramientasAdmin } from "@/components/aula/herramientas-admin";
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
  esAdmin = false,
  courseId,
  courseTitle,
  courseType,
  progreso,
  modules,
  finalQuizzes,
}: {
  /** Solo el administrador ve los atajos de prueba. */
  esAdmin?: boolean;
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

  // Tarjeta de progreso como INSTRUMENTO sobre navy: contrasta con el
  // carril claro y se lee de un vistazo (anillo + cifras), en vez del vidrio
  // casi blanco que se confundía con el fondo.
  const cabecera = (
    <div className="aula-progreso">
      <div className="flex items-center gap-4">
        <AnilloPorcentaje valor={progreso.porcentaje} tamano={84} grosor={6} oscuro etiqueta="Avance" />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-[color-mix(in_oklch,var(--primary)_70%,white)]">
            {COURSE_TYPE_LABELS[courseType]}
          </p>
          <h2 className="mt-1 line-clamp-2 font-display text-[0.98rem] font-bold leading-tight text-white">{courseTitle}</h2>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="instrumento !py-2">
          <b className="!text-[1.05rem]">
            {progreso.completadasRequeridas}
            <span className="!mt-0 !inline !text-[0.75rem] !tracking-normal !normal-case text-white/50"> / {progreso.totalRequeridas}</span>
          </b>
          <span>Lecciones</span>
        </div>
        <div className="instrumento !py-2">
          <b className="!text-[1.05rem]">{progreso.cuestionariosPendientes}</b>
          <span>Evaluaciones pend.</span>
        </div>
      </div>
      {progreso.porcentaje === 100 && progreso.cuestionariosPendientes > 0 && (
        <p className="mt-3 rounded-lg border border-warning/40 bg-warning/10 px-2.5 py-1.5 text-[11.5px] font-semibold text-[color-mix(in_oklch,var(--warning)_70%,white)]">
          Lecciones completas: falta {progreso.cuestionariosPendientes === 1 ? "la evaluación" : "las evaluaciones"} para certificarte.
        </p>
      )}
    </div>
  );

  const contenido = (
    <>
      <ContenidoCurso
        courseId={courseId}
        leccionActualId={leccionActualId}
        modulos={modules}
        cuestionariosFinales={finalQuizzes}
      />
      {esAdmin && <HerramientasAdmin courseId={courseId} />}
    </>
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
              data-carril
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
      <aside
        data-carril
        className="hidden h-full w-[340px] shrink-0 flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-4 lg:flex [&>*]:shrink-0"
      >
        {cabecera}
        {contenido}
      </aside>
    </>
  );
}
