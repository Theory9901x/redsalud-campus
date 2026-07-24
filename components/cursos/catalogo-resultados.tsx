import { Layers, PlayCircle, ShieldAlert, Sparkles } from "lucide-react";
import { CourseStateCard, type CursoTarjeta, type EstadoTarjeta } from "@/components/cursos/course-state-card";
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

function Seccion({
  icono: Icono,
  tono,
  titulo,
  descripcion,
  cursos,
}: {
  icono: typeof Layers;
  tono: string;
  titulo: string;
  descripcion: string;
  cursos: CursoResultado[];
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tono}`}>
          <Icono className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-base font-extrabold text-foreground">
            {titulo} <span className="text-sm font-semibold text-muted-foreground">({cursos.length})</span>
          </h2>
          <p className="text-xs text-muted-foreground">{descripcion}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {cursos.map((c) => (
          <CourseStateCard key={c.id} curso={aTarjeta(c)} />
        ))}
      </div>
    </div>
  );
}

/**
 * Resultados del catálogo. Server Component: el filtrado ya viene resuelto
 * desde la URL, así que esta parte no necesita estado ni JavaScript.
 *
 * El orden de las secciones es el orden en que le sirven a la persona: primero
 * lo que dejó a medias, luego lo que le exigen, y al final el resto. Un
 * catálogo alfabético sirve a quien lo administra, no a quien lo cursa.
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

  const enCurso = courses
    .filter((c) => c.estado === "en-curso")
    .sort((a, b) => (b.progreso ?? 0) - (a.progreso ?? 0));

  // "Pendientes" de verdad: un obligatorio ya aprobado o en curso no está
  // pendiente de nada; aparece en su propia sección más arriba.
  const obligatorios = courses.filter(
    (c) => c.courseType === "OBLIGATORIO" && c.estado !== "completado" && c.estado !== "en-curso"
  );

  const yaMostrados = new Set([...enCurso, ...obligatorios].map((c) => c.id));
  const resto = courses.filter((c) => !yaMostrados.has(c.id));
  const hayOtrasSecciones = enCurso.length > 0 || obligatorios.length > 0;

  return (
    <div className="space-y-10">
      {enCurso.length > 0 && (
        <Seccion
          icono={PlayCircle}
          tono="bg-primary/12 text-primary"
          titulo="Continuar donde quedaste"
          descripcion="Cursos que empezaste y todavía no terminas."
          cursos={enCurso}
        />
      )}
      {obligatorios.length > 0 && (
        <Seccion
          icono={ShieldAlert}
          tono="bg-destructive/12 text-destructive"
          titulo="Obligatorios pendientes"
          descripcion="Cursos de cumplimiento requerido por la institución."
          cursos={obligatorios}
        />
      )}
      {resto.length > 0 && (
        <Seccion
          icono={hayOtrasSecciones ? Layers : Sparkles}
          tono="bg-success/12 text-success"
          titulo={hayOtrasSecciones ? "Resto del catálogo" : "Cursos disponibles"}
          descripcion={
            hayOtrasSecciones ? "Todo lo demás que puedes tomar." : "Formación disponible para tu perfil."
          }
          cursos={resto}
        />
      )}
    </div>
  );
}
