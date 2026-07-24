import { Layers } from "lucide-react";
import { CourseStateCard, type CursoTarjeta, type EstadoTarjeta } from "@/components/cursos/course-state-card";
import { OrdenSelect } from "@/components/cursos/orden-select";
import { EmptyState } from "@/components/brand/empty-state";
import type { CourseType } from "@prisma/client";

export type EstadoCurso = "pendiente" | "en-curso" | "completado";

export type CursoResultado = {
  id: string;
  href: string;
  imageUrl: string | null;
  title: string;
  descripcion: string;
  institucion: string;
  courseType: CourseType;
  categoryName: string | null;
  audienceLabel: string | null;
  durationHours: number;
  tutorName: string;
  /** Avance de quien mira. Ausente para el visitante anónimo. */
  estado?: EstadoCurso;
  progreso?: number;
  completadoEl?: string | null;
};

/** Estado visual de la tarjeta: completado gana a en curso, que gana a obligatorio. */
function estadoTarjeta(c: CursoResultado): EstadoTarjeta {
  if (c.estado === "completado") return "completado";
  if (c.estado === "en-curso") return "en-curso";
  if (c.courseType === "OBLIGATORIO") return "obligatorio";
  return "disponible";
}

const CTA: Record<EstadoTarjeta, string> = {
  obligatorio: "Ver curso",
  "en-curso": "Continuar",
  completado: "Ver de nuevo",
  disponible: "Ver curso",
};

function aTarjeta(c: CursoResultado): CursoTarjeta {
  const estado = estadoTarjeta(c);
  return {
    id: c.id,
    href: c.href,
    imageUrl: c.imageUrl,
    titulo: c.title,
    descripcion: c.descripcion,
    horas: c.durationHours,
    institucion: c.institucion,
    estado,
    progreso: estado === "en-curso" ? c.progreso : undefined,
    completadoEl: c.completadoEl,
    cta: CTA[estado],
  };
}

/**
 * Resultados del catálogo, en una sola grilla con encabezado y orden (según la
 * maqueta aprobada). El orden ya viene resuelto desde el servidor; esta parte
 * es un Server Component sin estado.
 */
export function CatalogoResultados({ courses }: { courses: CursoResultado[] }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <span className="text-sm font-medium text-muted-foreground">
          {courses.length} {courses.length === 1 ? "curso encontrado" : "cursos encontrados"}
        </span>
        {courses.length > 0 && <OrdenSelect />}
      </div>

      {courses.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No hay cursos que coincidan"
          description="Ajusta la búsqueda o quita alguno de los filtros activos."
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((c) => (
            <CourseStateCard key={c.id} curso={aTarjeta(c)} />
          ))}
        </div>
      )}
    </div>
  );
}
