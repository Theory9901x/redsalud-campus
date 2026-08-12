import Link from "next/link";
import { requireSession } from "@/lib/auth-helpers";
import { CalendarDays } from "lucide-react";
import { getStudentPlansOverview } from "@/lib/training-plans";
import { StaggerSections } from "@/components/brand/stagger-sections";
import {
  MisCapacitacionesView,
  type PlanTarjeta,
  type ResumenCapacitaciones,
} from "@/components/training-plans/mis-capacitaciones-view";
import { TRAINING_PLAN_STATUS_LABELS, etiquetaJornada } from "@/components/training-plans/labels";

/**
 * "Mis capacitaciones": el centro personal de formación del estudiante.
 *
 * Toda cifra sale de datos reales y con los mismos criterios que la ficha del
 * plan (getStudentPlansOverview). Lo que no existe no se estima: el progreso
 * llega null mientras la persona no esté inscrita en nada, y la vista muestra
 * en su lugar cuántas capacitaciones tiene programadas.
 */
export default async function MisCapacitacionesPage() {
  const session = await requireSession("/mis-capacitaciones");
  const userId = session.user.id;
  const primerNombre = session.user.name?.split(" ")[0];

  const planes = await getStudentPlansOverview(userId);

  const tarjetas: PlanTarjeta[] = planes.map((p) => ({
    id: p.id,
    title: p.title,
    year: p.year,
    estadoLabel: TRAINING_PLAN_STATUS_LABELS[p.status],
    estadoTono: p.status === "ACTIVE" ? "activo" : p.status === "CLOSED" ? "cerrado" : "borrador",
    targetDepartment: p.targetDepartment,
    tutorName: p.tutorName,
    totalActividades: p.totalActividades,
    completadas: p.completadas,
    evaluacionesDisponibles: p.evaluacionesDisponibles,
    progreso: p.progreso,
    // La fecha se formatea AQUÍ, en el servidor: hacerlo en el cliente hidrata
    // distinto (el ICU del navegador y el de Node difieren en "a. m.").
    proximaJornada: p.proximaJornada
      ? { titulo: p.proximaJornada.titulo, etiqueta: etiquetaJornada(p.proximaJornada) }
      : null,
  }));

  // Agregados del encabezado: suma de lo que de verdad le aplica a la persona.
  const conProgreso = planes.filter((p) => p.progreso !== null);
  const resumen: ResumenCapacitaciones = {
    actividades: planes.reduce((s, p) => s + p.totalActividades, 0),
    completadas: planes.reduce((s, p) => s + p.completadas, 0),
    evaluacionesDisponibles: planes.reduce((s, p) => s + p.evaluacionesDisponibles, 0),
    proximasJornadas: planes.reduce((s, p) => s + p.proximasJornadas, 0),
    progreso:
      conProgreso.length > 0
        ? Math.round(conProgreso.reduce((s, p) => s + (p.progreso ?? 0), 0) / conProgreso.length)
        : null,
  };

  const anios = [...new Set(planes.map((p) => p.year))].sort((a, b) => b - a);
  const planVigente = planes.find((p) => p.status === "ACTIVE");

  return (
    <main className="canvas-formacion min-h-full flex-1">
      <div className="mx-auto w-full max-w-[1480px] px-4 py-8 sm:px-6 lg:px-8">
        <StaggerSections className="space-y-8">
        {/* Encabezado del módulo */}
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Formación institucional</p>
            <h1 className="mt-2 font-display text-[clamp(1.9rem,4vw,2.35rem)] font-extrabold leading-[1.1] tracking-tight text-foreground">
              Mis capacitaciones
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
              {primerNombre ? `${primerNombre}, gestiona` : "Gestiona"} tu ruta de aprendizaje, consulta próximas
              actividades y haz seguimiento a tu formación institucional.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {planVigente && (
              <span className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-4 py-2 text-sm font-semibold text-success">
                <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
                Plan activo · {planVigente.year}
              </span>
            )}
            {planVigente && (
              <Link
                href={`/mis-capacitaciones/${planVigente.id}`}
                className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/80 px-4 py-2 text-sm font-semibold text-foreground backdrop-blur-sm transition-transform duration-150 hover:-translate-y-0.5 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <CalendarDays className="h-4 w-4 text-primary" strokeWidth={1.7} aria-hidden="true" />
                Ver calendario
              </Link>
            )}
          </div>
        </header>

        <MisCapacitacionesView planes={tarjetas} resumen={resumen} anios={anios} />
        </StaggerSections>
      </div>
    </main>
  );
}
