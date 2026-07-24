import { Clock, Layers, PlayCircle, ShieldAlert, Sparkles, User } from "lucide-react";
import { CoursePosterCard } from "@/components/cursos/course-poster-card";
import { EmptyState } from "@/components/brand/empty-state";
import type { CourseType } from "@prisma/client";

export type EstadoCurso = "pendiente" | "en-curso" | "completado";

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
  /** Avance de quien mira. Ausente para el visitante anónimo. */
  estado?: EstadoCurso;
  progreso?: number;
};

const INSIGNIA: Record<EstadoCurso, { label: string; dotClassName: string } | undefined> = {
  "en-curso": { label: "En curso", dotClassName: "bg-primary" },
  completado: { label: "Completado", dotClassName: "bg-success" },
  pendiente: undefined,
};

const ACCION: Record<EstadoCurso, string> = {
  "en-curso": "Continuar",
  completado: "Repasar",
  pendiente: "Ver curso",
};

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
            {titulo}{" "}
            <span className="text-sm font-semibold text-muted-foreground">
              ({cursos.length})
            </span>
          </h2>
          <p className="text-xs text-muted-foreground">{descripcion}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cursos.map((curso) => (
          <CoursePosterCard
            key={curso.id}
            href={curso.href}
            imageUrl={curso.imageUrl}
            title={curso.title}
            courseType={curso.courseType}
            eyebrow={curso.categoryName}
            audienceLabel={curso.audienceLabel}
            statusBadge={curso.estado ? INSIGNIA[curso.estado] : undefined}
            ctaLabel={curso.estado ? ACCION[curso.estado] : "Ver curso"}
            // La barra solo aparece cuando hay algo que mostrar: un 0% en cada
            // tarjeta del catálogo es ruido, no información.
            progress={curso.estado === "en-curso" ? curso.progreso : undefined}
            progressLabel={
              curso.estado === "en-curso" && curso.progreso !== undefined
                ? `${Math.round(curso.progreso)}% completado`
                : undefined
            }
            meta={[
              { icon: Clock, label: `${curso.durationHours}h` },
              { icon: User, label: curso.tutorName },
            ]}
          />
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

  // "Pendientes" de verdad: un obligatorio ya aprobado no está pendiente de
  // nada. Antes la sección los incluía y el título mentía.
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
            hayOtrasSecciones
              ? "Todo lo demás que puedes tomar."
              : "Formación disponible para tu perfil."
          }
          cursos={resto}
        />
      )}
    </div>
  );
}
