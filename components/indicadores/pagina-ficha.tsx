import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2 } from "lucide-react";
import { getContextoFormulario, getIndicadorGestion } from "@/lib/indicadores-gestion";
import { areaPermitida, resolverAlcance } from "@/components/indicadores/alcance";
import { esCodigo } from "@/components/indicadores/catalogo";
import { FichaIndicador, type Escritura } from "@/components/indicadores/ficha-indicador";

/**
 * Página de UN indicador (admin y tutor). Resuelve el alcance, el área
 * pedida y hasta dónde puede escribir quien la abre, y delega el resto a la
 * ficha. El selector de área es por enlaces (?area=): la URL dice de qué
 * área es la ficha y se puede compartir tal cual.
 */
export async function PaginaFicha({ planId, codigo, rutaBase, area }: { planId: string; codigo: string; rutaBase: string; area?: string }) {
  if (!esCodigo(codigo)) notFound();
  const alcance = await resolverAlcance(planId);
  const areaQuery = areaPermitida(alcance, area);

  const [datos, contexto] = await Promise.all([
    getIndicadorGestion(planId, alcance.areaIds, codigo, areaQuery),
    getContextoFormulario(planId, alcance.areaIds),
  ]);
  if (!datos) notFound();

  const areaNombre = areaQuery ? (datos.porArea.find((a) => a.areaId === areaQuery)?.areaNombre ?? null) : null;
  const escritura: Escritura = alcance.soloLectura
    ? { puede: false, areaId: areaQuery, areaNombre, motivo: null }
    : alcance.institucional || areaQuery
      ? { puede: true, areaId: areaQuery, areaNombre, motivo: null }
      : { puede: false, areaId: null, areaNombre: null, motivo: "Elige un área arriba para redactar su análisis y gestionar sus planes de mejora." };

  const areasSelector = alcance.areaIds ? datos.porArea.filter((a) => alcance.areaIds!.includes(a.areaId)) : datos.porArea;

  return (
    <div className="ind-pagina space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`${rutaBase}/indicadores`} className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Indicadores · {datos.planTitulo}
        </Link>

        {areasSelector.length > 0 && (alcance.institucional || areasSelector.length > 1) && (
          <nav className="ind-selector-area" aria-label="Alcance de la ficha">
            <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            {alcance.institucional && (
              <Link href={`${rutaBase}/indicadores/${codigo}`} data-activa={!areaQuery || undefined}>
                Institucional
              </Link>
            )}
            {areasSelector.map((a) => (
              <Link key={a.areaId} href={`${rutaBase}/indicadores/${codigo}?area=${a.areaId}`} data-activa={areaQuery === a.areaId || undefined} data-sem={a.anual.sem}>
                <i aria-hidden="true" />
                {a.areaNombre}
              </Link>
            ))}
          </nav>
        )}
      </div>

      <FichaIndicador datos={datos} contexto={contexto} rutaBase={rutaBase} escritura={escritura} areaQuery={areaQuery} />
    </div>
  );
}
