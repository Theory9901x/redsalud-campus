import { PaginaFicha } from "@/components/indicadores/pagina-ficha";

/** Ficha de UN indicador para el tutor, acotada a sus áreas. */
export default async function FichaIndicadorPage({ params, searchParams }: { params: Promise<{ id: string; codigo: string }>; searchParams: Promise<{ area?: string }> }) {
  const [{ id, codigo }, { area }] = await Promise.all([params, searchParams]);
  return <PaginaFicha planId={id} codigo={decodeURIComponent(codigo)} rutaBase={`/tutor/planes-capacitacion/${id}`} area={area} />;
}
