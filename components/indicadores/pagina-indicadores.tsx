import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Gauge, Radio } from "lucide-react";
import { getResumenIndicadores } from "@/lib/indicadores-gestion";
import { areaPermitida, resolverAlcance } from "@/components/indicadores/alcance";
import { TableroIndicadores } from "@/components/indicadores/tablero-indicadores";
import { ROMANO } from "@/components/indicadores/catalogo";

/**
 * Página de INDICADORES del plan (la comparten la ruta del admin y la del
 * tutor; cambia solo `rutaBase`). Cabecera ligera y, debajo, el tablero:
 * tres fichas de vidrio y la matriz por área.
 */
export async function PaginaIndicadores({ planId, rutaBase, area }: { planId: string; rutaBase: string; area?: string }) {
  const alcance = await resolverAlcance(planId);
  const areaQuery = areaPermitida(alcance, area);
  const datos = await getResumenIndicadores(planId, alcance.areaIds);
  if (!datos) notFound();

  return (
    <div className="ind-pagina space-y-7">
      <Link href={rutaBase} className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {datos.planTitulo}
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <p className="mono-label flex items-center gap-1.5 !text-primary">
            <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
            Indicadores del PIC · vigencia {datos.anio}
          </p>
          <h1 className="ind-titulo-pagina mt-2">
            {datos.alcance.tipo === "institucional" ? (
              <>
                Medición <span>institucional</span>
              </>
            ) : datos.alcance.tipo === "area" ? (
              <>
                Medición de <span>{datos.alcance.areaNombre}</span>
              </>
            ) : (
              <>
                Medición de <span>mis áreas</span>
              </>
            )}
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
            Tres indicadores, cada uno con su ficha, sus mediciones por trimestre, su análisis y sus planes de mejora. Se calculan solos y en tiempo real: nadie marca nada a mano.
          </p>
        </div>
        <div className="ind-vigente">
          <Radio className="h-3.5 w-3.5" aria-hidden="true" />
          <span>
            Trimestre {ROMANO[datos.trimestreActual - 1]} en curso
            <small>Las mediciones del periodo vigente se mueven con cada registro.</small>
          </span>
        </div>
      </header>

      <TableroIndicadores datos={datos} rutaBase={rutaBase} areaQuery={areaQuery ?? undefined} />
    </div>
  );
}
