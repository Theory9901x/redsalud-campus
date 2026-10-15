import { PaginaIndicadores } from "@/components/indicadores/pagina-indicadores";

/**
 * INDICADORES del plan, como submódulo propio: tres fichas de vidrio con su
 * semáforo, tendencia y planes de mejora, y la matriz por área. Cada
 * indicador se gestiona por separado en /indicadores/[codigo].
 */
export default async function IndicadoresPlanPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ area?: string }> }) {
  const [{ id }, { area }] = await Promise.all([params, searchParams]);
  return <PaginaIndicadores planId={id} rutaBase={`/admin/planes-capacitacion/${id}`} area={area} />;
}
