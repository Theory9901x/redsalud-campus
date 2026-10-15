import { PaginaIndicadores } from "@/components/indicadores/pagina-indicadores";

/**
 * INDICADORES del plan para el tutor: la misma página que la del admin con
 * el alcance acotado a sus áreas (mismas fórmulas, no unas propias).
 */
export default async function IndicadoresPlanPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ area?: string }> }) {
  const [{ id }, { area }] = await Promise.all([params, searchParams]);
  return <PaginaIndicadores planId={id} rutaBase={`/tutor/planes-capacitacion/${id}`} area={area} />;
}
