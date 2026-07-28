import Link from "next/link";
import { BookOpen } from "lucide-react";
import { EmptyState } from "@/components/brand/empty-state";
import { getAvanceCursos } from "@/lib/admin-dashboard";
import type { FiltrosPanel } from "@/lib/admin-dashboard";

/**
 * Barra apilada por curso: completados / en curso / sin empezar. Los tres
 * segmentos llevan leyenda arriba y cifra al pasar el cursor, porque la barra
 * apilada por sí sola no dice cuánto vale cada tramo.
 *
 * El hueco de 2 px entre segmentos es del color de la superficie: sin él, dos
 * tramos contiguos se leen como uno solo.
 */
const SEGMENTOS = [
  { clave: "completados", etiqueta: "Completados", color: "var(--data-1)" },
  { clave: "enCurso", etiqueta: "En curso", color: "var(--data-3)" },
  { clave: "sinEmpezar", etiqueta: "Sin empezar", color: "var(--muted-foreground)" },
] as const;

export async function AvanceCursos({ filtros }: { filtros: FiltrosPanel }) {
  const cursos = await getAvanceCursos(filtros);

  if (cursos.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="Sin inscripciones todavía"
        description="Aparecerá aquí cuando haya personal inscrito en algún curso."
      />
    );
  }

  return (
    <div className="space-y-4">
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {SEGMENTOS.map((s) => (
          <li key={s.clave} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: s.color }} />
            {s.etiqueta}
          </li>
        ))}
      </ul>

      <ul className="space-y-3">
        {cursos.map((curso) => {
          const sinEmpezar = Math.max(0, curso.inscritos - curso.enCurso - curso.completados);
          const valores = { completados: curso.completados, enCurso: curso.enCurso, sinEmpezar };
          return (
            <li key={curso.courseId}>
              <Link
                href={`/admin?curso=${curso.courseId}`}
                className="block rounded-lg px-2 py-1 transition-colors hover:bg-muted/60"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-sm text-foreground">{curso.titulo}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {curso.inscritos} {curso.inscritos === 1 ? "inscrito" : "inscritos"}
                  </span>
                </div>
                <div className="mt-1.5 flex h-2 gap-[2px] overflow-hidden rounded-full">
                  {SEGMENTOS.map((s) => {
                    const v = valores[s.clave];
                    if (v === 0) return null;
                    return (
                      <span
                        key={s.clave}
                        title={`${s.etiqueta}: ${v}`}
                        className="h-full first:rounded-l-full last:rounded-r-full"
                        style={{
                          width: `${(v / curso.inscritos) * 100}%`,
                          backgroundColor: s.color,
                        }}
                      />
                    );
                  })}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
