import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, PhoneCall } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireTrainingPlanAccess, requireTutorOrAdmin } from "@/lib/auth-helpers";
import {
  getCallConnectionSummaryForPlan,
  getActivitiesWithConnectionsForPlan,
  getCallConnectionPage,
} from "@/lib/call-connections";
import { PanelConexiones } from "@/components/training-plans/panel-conexiones";
import { parsePageSize } from "@/lib/pagination";

/**
 * TRAZABILIDAD DE CONEXIÓN A VIDEOLLAMADA, por plan de capacitación.
 *
 * Mismo alcance que Indicadores: el administrador y el responsable del plan
 * ven lo institucional; un tutor de área ve solo sus áreas. El dato en sí ya
 * quedó escrito por sala-virtual.tsx al terminar cada llamada -esta página
 * únicamente lee y pagina, nada se calcula ni se sondea aquí.
 */
export default async function ConexionesPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; actividad?: string; page?: string; pageSize?: string }>;
}) {
  const { id } = await params;
  const { q, actividad, page: pageParam, pageSize: pageSizeParam } = await searchParams;
  const sesion = await requireTutorOrAdmin();

  const plan = await prisma.trainingPlan.findUnique({ where: { id }, select: { id: true, tutorId: true, title: true } });
  if (!plan) notFound();

  const institucional = sesion.user.role === "ADMIN" || plan.tutorId === sesion.user.id;
  if (!institucional) await requireTrainingPlanAccess(id).catch(() => null);

  const areaIds = institucional
    ? null
    : (await prisma.trainingArea.findMany({ where: { tutorId: sesion.user.id }, select: { id: true } })).map((a) => a.id);

  const pagina = Math.max(Number(pageParam) || 1, 1);
  const porPagina = parsePageSize(pageSizeParam);

  const [resumen, actividades, pageData] = await Promise.all([
    getCallConnectionSummaryForPlan(id, areaIds),
    getActivitiesWithConnectionsForPlan(id, areaIds),
    getCallConnectionPage(id, areaIds, { activityId: actividad, buscar: q, pagina, porPagina }),
  ]);

  return (
    <div className="space-y-8">
      <Link
        href={`/admin/planes-capacitacion/${id}`}
        className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {plan.title}
      </Link>

      <header className="max-w-3xl">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
          <PhoneCall className="h-3.5 w-3.5" aria-hidden="true" />
          Conexiones a videollamada
        </p>
        <h1 className="mt-2 font-display text-[clamp(1.6rem,3.2vw,2.15rem)] font-extrabold leading-[1.12] tracking-tight text-foreground">
          {institucional ? (
            <>
              Trazabilidad{" "}
              <span className="bg-gradient-to-r from-primary to-success bg-clip-text text-transparent">
                institucional
              </span>
            </>
          ) : (
            <>
              Trazabilidad de{" "}
              <span className="bg-gradient-to-r from-primary to-success bg-clip-text text-transparent">
                mis áreas
              </span>
            </>
          )}
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
          Cuánto tiempo estuvo conectada cada persona a la sala de las jornadas virtuales de este plan. Se registra
          solo, al salir de la llamada; nadie lo marca a mano.
        </p>
      </header>

      <PanelConexiones
        resumen={resumen}
        actividades={actividades}
        filas={pageData.filas}
        total={pageData.total}
        pagina={pageData.pagina}
        porPagina={pageData.porPagina}
      />
    </div>
  );
}
