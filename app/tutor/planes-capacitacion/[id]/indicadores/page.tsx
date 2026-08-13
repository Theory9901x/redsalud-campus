import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Gauge } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireTrainingPlanAccess, requireTutorOrAdmin } from "@/lib/auth-helpers";
import { getPlanIndicators } from "@/lib/plan-indicadores";
import { PanelIndicadores } from "@/components/training-plans/panel-indicadores";

/**
 * INDICADORES del plan, como submódulo propio.
 *
 * Vivían dispersos: la adherencia dentro de cada jornada, la cobertura en el
 * tablero del plan, la asistencia en su pestaña. Aquí están los tres juntos y
 * con su ficha técnica, que es como los pide la entidad para reportar.
 *
 * El alcance sigue la misma regla del módulo: el administrador y el
 * responsable del plan ven lo institucional; un tutor de área ve su área con
 * las mismas fórmulas, no con unas propias.
 */
export default async function IndicadoresPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await requireTutorOrAdmin();

  const plan = await prisma.trainingPlan.findUnique({ where: { id }, select: { id: true, tutorId: true, title: true } });
  if (!plan) notFound();

  const institucional = sesion.user.role === "ADMIN" || plan.tutorId === sesion.user.id;
  if (!institucional) await requireTrainingPlanAccess(id).catch(() => null);

  const areaIds = institucional
    ? null
    : (await prisma.trainingArea.findMany({ where: { tutorId: sesion.user.id }, select: { id: true } })).map((a) => a.id);

  const datos = await getPlanIndicators(id, areaIds);
  if (!datos) notFound();

  const BASE_PATH = sesion.user.role === "ADMIN" ? "/admin/planes-capacitacion" : "/tutor/planes-capacitacion";

  return (
    // Sin lienzo propio: canvas-vivo pinta su fondo opaco y dentro del layout
    // del tutor (que ya decora el suyo) se veía como un rectángulo superpuesto.
    <div className="space-y-8">
      <Link
        href={`${BASE_PATH}/${id}`}
        className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {datos.planTitulo}
      </Link>

      <header className="max-w-3xl">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
          <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
          Indicadores del plan
        </p>
        <h1 className="mt-2 font-display text-[clamp(1.6rem,3.2vw,2.15rem)] font-extrabold leading-[1.12] tracking-tight text-foreground">
          {institucional ? (
            <>
              Medición{" "}
              <span className="bg-gradient-to-r from-primary to-success bg-clip-text text-transparent">
                institucional
              </span>
            </>
          ) : (
            <>
              Medición de{" "}
              <span className="bg-gradient-to-r from-primary to-success bg-clip-text text-transparent">
                mis áreas
              </span>
            </>
          )}
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
          Se calculan solos y en tiempo real: el trimestre sale de la programación del PIC, el cierre de cada jornada
          y la asistencia del propio recorrido del personal. Nadie marca nada a mano.
        </p>
      </header>

      <PanelIndicadores datos={datos} />
    </div>
  );
}
