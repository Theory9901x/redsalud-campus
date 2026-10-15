import { notFound } from "next/navigation";
import { VistaTrazabilidad } from "@/components/trazabilidad/vista-trazabilidad";
import { parsePageSize } from "@/lib/pagination";
import { getPersonasTrazabilidad, getTrazabilidadPlan, parseTrimestre, resolverAlcanceTrazabilidad } from "@/lib/trazabilidad-llamadas";

/**
 * TRAZABILIDAD DE CONEXIÓN A VIDEOLLAMADA (ruta del tutor). Misma vista que
 * la de administración; el alcance lo decide resolverAlcanceTrazabilidad: el
 * responsable del plan ve lo institucional, un tutor de área solo sus áreas.
 */
export default async function ConexionesPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string; area?: string; actividad?: string; q?: string; page?: string; pageSize?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const alcance = await resolverAlcanceTrazabilidad(id);
  if (!alcance) notFound();

  const parametros = { t: parseTrimestre(sp.t), area: sp.area ?? "", actividad: sp.actividad ?? "", q: sp.q?.trim() ?? "" };
  const [datos, personas] = await Promise.all([
    getTrazabilidadPlan(alcance, parametros.t),
    getPersonasTrazabilidad(alcance, {
      trimestre: parametros.t,
      areaId: parametros.area || null,
      activityId: parametros.actividad || null,
      buscar: parametros.q,
      pagina: Math.max(Number(sp.page) || 1, 1),
      porPagina: parsePageSize(sp.pageSize),
    }),
  ]);

  return <VistaTrazabilidad alcance={alcance} datos={datos} personas={personas} basePath="/tutor/planes-capacitacion" parametros={parametros} />;
}
