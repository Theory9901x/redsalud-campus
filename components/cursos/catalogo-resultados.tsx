import { Clock, Layers, ShieldAlert, User } from "lucide-react";
import { CoursePosterCard } from "@/components/cursos/course-poster-card";
import { EmptyState } from "@/components/brand/empty-state";
import type { CourseType } from "@prisma/client";

export type CursoResultado = {
  id: string;
  href: string;
  imageUrl: string | null;
  title: string;
  courseType: CourseType;
  categoryName: string | null;
  audienceLabel: string | null;
  durationHours: number;
  tutorName: string;
};

/**
 * Resultados del catálogo. Server Component: el filtrado ya viene resuelto
 * desde la URL, así que esta parte no necesita estado ni JavaScript. Los
 * obligatorios se separan arriba para que no se pierdan en la grilla.
 */
export function CatalogoResultados({ courses }: { courses: CursoResultado[] }) {
  if (courses.length === 0) {
    return (
      <EmptyState
        icon={Layers}
        title="No hay cursos que coincidan"
        description="Ajusta la búsqueda o quita alguno de los filtros activos."
      />
    );
  }

  const obligatorios = courses.filter((c) => c.courseType === "OBLIGATORIO");
  const resto = courses.filter((c) => c.courseType !== "OBLIGATORIO");

  const grilla = (lista: CursoResultado[]) => (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {lista.map((course) => (
        <CoursePosterCard
          key={course.id}
          href={course.href}
          imageUrl={course.imageUrl}
          title={course.title}
          courseType={course.courseType}
          eyebrow={course.categoryName}
          audienceLabel={course.audienceLabel}
          meta={[
            { icon: Clock, label: `${course.durationHours}h` },
            { icon: User, label: course.tutorName },
          ]}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-8">
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
          {grilla(obligatorios)}
        </div>
      )}
      {resto.length > 0 && (
        <div className="space-y-4">
          {obligatorios.length > 0 && (
            <h2 className="font-display text-base font-extrabold text-foreground">Resto del catálogo</h2>
          )}
          {grilla(resto)}
        </div>
      )}
    </div>
  );
}
