import { BookOpen, CircleCheckBig, CirclePlay, Clock, GraduationCap, Layers } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Cabecera del catálogo.
 *
 * Los cuatro indicadores salen de la base de datos, no son de adorno:
 *
 *  - Cursos disponibles: los publicados que le corresponden a esta persona
 *    según su tipo de personal, que es el mismo conjunto que lista la página.
 *  - En curso / Completados: sus inscripciones reales.
 *  - Horas acumuladas: suma de la intensidad horaria de los cursos que
 *    completó. No es tiempo de uso de la plataforma -eso no se mide- sino la
 *    intensidad certificada, que es lo que vale para Talento Humano.
 *
 * Un cero se muestra tal cual. Es un dato correcto sobre alguien que todavía
 * no ha empezado, y hoy en producción esa es la mayoría.
 */
export function HeroCatalogo({
  disponibles,
  enCurso,
  completados,
  horas,
  mostrarPersonales,
}: {
  disponibles: number;
  enCurso: number;
  completados: number;
  horas: number;
  /** El visitante sin sesión no tiene avance: solo ve cuántos cursos hay. */
  mostrarPersonales: boolean;
}) {
  return (
    <section className="hud-hero noise-overlay relative overflow-hidden p-6 text-white sm:p-8">
      {/* Orbes del mesh: solo animan transform, se componen en GPU. */}
      <div className="mesh-orb -left-24 top-[-40%] h-72 w-72 bg-[color-mix(in_oklch,var(--accent)_55%,transparent)]" />
      <div className="mesh-orb mesh-orb-slow -right-10 bottom-[-50%] h-64 w-64 bg-primary/40" />

      <div className="relative flex flex-wrap items-center gap-6">
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 py-1 pl-1 pr-3.5 text-xs font-bold text-[color-mix(in_oklch,var(--accent)_75%,white)] backdrop-blur">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-[var(--accent)] to-primary text-white">
              <Layers className="h-3.5 w-3.5" />
            </span>
            RedSalud Te Forma
          </span>

          <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
            Catálogo de cursos
          </h1>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-white/70">
            Impulsa tu desarrollo profesional con cursos diseñados para tu inducción, reinducción y
            capacitación institucional.
          </p>
        </div>

        {/* Ilustración de formas puras: sin imágenes que cargar. */}
        <div className="relative hidden h-40 w-64 shrink-0 lg:block" aria-hidden="true">
          <span className="absolute inset-[12%] rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--accent)_55%,transparent),transparent_68%)] blur-2xl" />
          <span className="absolute inset-[14%_20%] rounded-full border border-dashed border-white/20" />
          <span className="absolute left-1/2 top-1/2 grid h-24 w-24 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[26px] border border-white/25 bg-gradient-to-br from-white/20 to-white/5 backdrop-blur">
            <GraduationCap className="h-11 w-11" strokeWidth={1.5} />
          </span>
          <span className="absolute right-2 top-2 grid h-12 w-12 place-items-center rounded-2xl border border-white/25 bg-white/10 backdrop-blur">
            <BookOpen className="h-5 w-5" strokeWidth={1.5} />
          </span>
        </div>
      </div>

      <ul className="relative mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icono={BookOpen} valor={disponibles} etiqueta="Cursos disponibles" pie="Para tu tipo de personal" />
        {mostrarPersonales && (
          <>
            <Kpi icono={CirclePlay} valor={enCurso} etiqueta="En curso" pie="Formación que ya empezaste" />
            <Kpi icono={CircleCheckBig} valor={completados} etiqueta="Completados" pie="Con certificado emitido" />
            <Kpi
              icono={Clock}
              valor={horas}
              sufijo=" h"
              etiqueta="Horas acumuladas"
              pie="Intensidad de lo que completaste"
            />
          </>
        )}
      </ul>
    </section>
  );
}

function Kpi({
  icono: Icono,
  valor,
  sufijo = "",
  etiqueta,
  pie,
}: {
  icono: LucideIcon;
  valor: number;
  sufijo?: string;
  etiqueta: string;
  pie: string;
}) {
  return (
    <li className="surface-glass-dark flex items-center gap-3.5 p-4 transition-transform duration-200 hover:-translate-y-1">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[var(--accent)] to-primary text-white shadow-[0_0_20px_color-mix(in_oklch,var(--accent)_45%,transparent)]">
        <Icono className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-white/65">{etiqueta}</p>
        <p className="font-display text-2xl font-extrabold leading-tight tracking-tight">
          {valor}
          {sufijo}
        </p>
        <p className="text-[11px] text-white/45">{pie}</p>
      </div>
    </li>
  );
}
