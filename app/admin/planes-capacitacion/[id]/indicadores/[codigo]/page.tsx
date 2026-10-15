import { PaginaFicha } from "@/components/indicadores/pagina-ficha";

/** Ficha de UN indicador: Seguimiento · Ficha técnica · Análisis · Mediciones · Planes de mejora. */
export default async function FichaIndicadorPage({ params, searchParams }: { params: Promise<{ id: string; codigo: string }>; searchParams: Promise<{ area?: string }> }) {
  const [{ id, codigo }, { area }] = await Promise.all([params, searchParams]);
  return <PaginaFicha planId={id} codigo={decodeURIComponent(codigo)} rutaBase={`/admin/planes-capacitacion/${id}`} area={area} />;
}
