"use client";

import { useMemo, useState } from "react";
import { Clock, Layers, Search, User } from "lucide-react";
import { CourseGrid } from "@/components/cursos/course-grid";
import { CoursePosterCard } from "@/components/cursos/course-poster-card";
import { EmptyState } from "@/components/brand/empty-state";
import { COURSE_AUDIENCE_LABELS } from "@/components/cursos/labels";
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

/**
 * Filtra en el cliente (sin navegación ni recarga): el catálogo institucional
 * es pequeño, así que traer todo una vez y filtrar en memoria evita el salto
 * de scroll que causaba el filtro anterior basado en searchParams + Link
 * (la navegación remontaba la página a través de loading.tsx).
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

  return (
    <div className="space-y-6">
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
        <CourseGrid>
          {filtered.map((course) => (
            <CoursePosterCard
              key={course.id}
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
          ))}
        </CourseGrid>
      )}
    </div>
  );
}
