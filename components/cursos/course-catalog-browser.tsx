"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Layers, Search, ShieldAlert, User } from "lucide-react";
import { CoursePosterCard } from "@/components/cursos/course-poster-card";
import { EmptyState } from "@/components/brand/empty-state";
import { COURSE_AUDIENCE_LABELS } from "@/components/cursos/labels";
import { SIGNATURE_EASE, SIGNATURE_DURATION } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { CourseType, CourseAudience } from "@prisma/client";

export type CatalogCourseItem = {
  id: string;
  href: string;
  imageUrl: string | null;
  title: string;
  courseType: CourseType;
  categoryId: string | null;
  categoryName: string | null;
  targetAudience: CourseAudience;
  durationHours: number;
  tutorName: string;
};

/** Grilla con reordenamiento animado (FLIP vía el `layout` de Framer Motion): al filtrar, las tarjetas que quedan se deslizan a su nueva posición, las que salen se desvanecen, las que entran aparecen escalonadas -- en vez de un simple recambio de contenido. `popLayout` saca del flujo a las que salen de inmediato, para que las que quedan puedan reacomodarse sin esperarlas. */
function AnimatedCourseGrid({ courses }: { courses: CatalogCourseItem[] }) {
  return (
    <motion.div layout className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <AnimatePresence mode="popLayout">
        {courses.map((course, index) => (
          <motion.div
            key={course.id}
            layout
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: SIGNATURE_DURATION, ease: SIGNATURE_EASE, delay: Math.min(index * 0.04, 0.24) }}
          >
            <CoursePosterCard
              href={course.href}
              imageUrl={course.imageUrl}
              title={course.title}
              courseType={course.courseType}
              eyebrow={course.categoryName}
              audienceLabel={course.targetAudience === "AMBOS" ? null : COURSE_AUDIENCE_LABELS[course.targetAudience]}
              meta={[
                { icon: Clock, label: `${course.durationHours}h` },
                { icon: User, label: course.tutorName },
              ]}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * Filtra en el cliente (sin navegación ni recarga): el catálogo institucional
 * es pequeño, así que traer todo una vez y filtrar en memoria evita el salto
 * de scroll que causaba el filtro anterior basado en searchParams + Link
 * (la navegación remontaba la página a través de loading.tsx). Las
 * animaciones de reordenamiento de abajo son puramente visuales sobre el
 * mismo mecanismo: no reintroducen ese salto.
 */
export function CourseCatalogBrowser({
  courses,
  categories,
}: {
  courses: CatalogCourseItem[];
  categories: { id: string; name: string }[];
}) {
  const [categoria, setCategoria] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return courses.filter((course) => {
      if (categoria && course.categoryId !== categoria) return false;
      if (query && !course.title.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [courses, categoria, q]);

  // Los obligatorios se separan en su propio bloque con encabezado propio:
  // no deben perderse mezclados en una grilla homogénea con el resto.
  const obligatorios = useMemo(() => filtered.filter((c) => c.courseType === "OBLIGATORIO"), [filtered]);
  const resto = useMemo(() => filtered.filter((c) => c.courseType !== "OBLIGATORIO"), [filtered]);

  return (
    <div className="space-y-8">
      {/* Barra de herramientas: buscador + filtros agrupados en su propia superficie, separada del grid. */}
      <div className="surface flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-2 rounded-full border border-border/80 bg-secondary/40 px-4 py-2 shadow-inner transition-shadow focus-within:border-primary/40 focus-within:ring-3 focus-within:ring-ring/20 sm:w-72 sm:shrink-0">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar cursos..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex flex-wrap gap-2 sm:justify-end">
          <button
            type="button"
            onClick={() => setCategoria(null)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200",
              !categoria
                ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-md shadow-primary/25"
                : "border border-border bg-white/70 text-foreground/70 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-white hover:shadow-sm"
            )}
          >
            Todos
          </button>
          {categories.map((category) => (
            <button
              type="button"
              key={category.id}
              onClick={() => setCategoria(category.id)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200",
                categoria === category.id
                  ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-md shadow-primary/25"
                  : "border border-border bg-white/70 text-foreground/70 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-white hover:shadow-sm"
              )}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No hay cursos que coincidan"
          description="Ajusta la búsqueda o elige otra categoría."
        />
      ) : (
        <>
          {obligatorios.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                  <ShieldAlert className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="font-display text-base font-extrabold text-foreground">Obligatorios pendientes</h2>
                  <p className="text-xs text-muted-foreground">Cursos de cumplimiento requerido por la institución.</p>
                </div>
              </div>
              <AnimatedCourseGrid courses={obligatorios} />
            </div>
          )}

          {resto.length > 0 && (
            <div className="space-y-4">
              {obligatorios.length > 0 && (
                <h2 className="font-display text-base font-extrabold text-foreground">Resto del catálogo</h2>
              )}
              <AnimatedCourseGrid courses={resto} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
