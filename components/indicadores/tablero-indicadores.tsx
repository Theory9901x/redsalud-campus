import Link from "next/link";
import { ArrowUpRight, ClipboardList, Building2 } from "lucide-react";
import type { ResumenIndicadores, Medicion } from "@/lib/indicadores-gestion";
import { CATALOGO, CODIGOS, ROMANO, VEREDICTO, formatearValor, type CodigoIndicador } from "@/components/indicadores/catalogo";
import { AnilloSemaforo, SenalSemaforo, Sparkline } from "@/components/indicadores/graficos-svg";
import { escalon } from "@/components/training-plans/plan-visual";
import { cn } from "@/lib/utils";

/**
 * VISTA GENERAL de los indicadores del plan: una tarjeta de vidrio por
 * indicador (anillo de semáforo, valor del trimestre vigente, tendencia y
 * planes de mejora abiertos) y debajo la matriz área × indicador, que es
 * desde donde se entra a la ficha de cada área.
 */
export function TableroIndicadores({ datos, rutaBase, areaQuery }: { datos: ResumenIndicadores; rutaBase: string; areaQuery?: string }) {
  const sufijo = areaQuery ? `?area=${areaQuery}` : "";
  return (
    <div className="space-y-8">
      <section className="ind-cinta" aria-label="Indicadores del plan">
        {datos.indicadores.map((ind, i) => {
          const f = CATALOGO[ind.codigo];
          return (
            <article key={ind.codigo} className="ind-tarjeta revelar" style={{ ...escalon(i), ["--ind-a" as string]: f.tono.a, ["--ind-b" as string]: f.tono.b }} data-sem={ind.anual.sem}>
              <span className="ind-aurora" aria-hidden="true" />
              <header className="relative flex flex-wrap items-center justify-between gap-2">
                <span className="ind-codigo">
                  <f.Icono className="h-3 w-3" aria-hidden="true" />
                  {ind.codigo}
                  {f.principal && <em>Principal</em>}
                </span>
                <SenalSemaforo sem={ind.anual.sem}>{VEREDICTO[ind.anual.sem]}</SenalSemaforo>
              </header>

              <div className="relative mt-3 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="ind-titulo">{f.nombre}</h2>
                  <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">{f.resumen}</p>
                </div>
                <AnilloSemaforo valor={ind.anual.valor} sem={ind.anual.sem} texto={formatearValor(ind.codigo, ind.anual.valor)} tamano={92} grosor={8} etiqueta={`Acum. ${datos.anio}`} className="shrink-0" />
              </div>

              <div className="ind-periodo relative">
                <div>
                  <span className="mono-label">Trimestre {ROMANO[datos.trimestreActual - 1]} · vigente</span>
                  <b data-sem={ind.actual.sem}>{formatearValor(ind.codigo, ind.actual.valor)}</b>
                  <small>
                    {f.columnas[1]}: {ind.actual.variables[1]} · {f.columnas[0]}: {ind.actual.variables[0]}
                  </small>
                </div>
                <div className="ind-spark-caja">
                  <Sparkline valores={ind.trimestres.map((t) => t.valor)} sems={ind.trimestres.map((t) => t.sem)} actual={datos.trimestreActual} ancho={150} alto={46} />
                  <span>
                    {ROMANO.map((r, k) => (
                      <i key={r} data-actual={k + 1 === datos.trimestreActual || undefined}>
                        T{k + 1}
                      </i>
                    ))}
                  </span>
                </div>
              </div>

              <footer className="relative mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className={cn("ind-mejoras", ind.planesVencidos > 0 && "ind-mejoras-alerta")}>
                  <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
                  {ind.planesAbiertos === 0 ? "Sin planes de mejora abiertos" : `${ind.planesAbiertos} ${ind.planesAbiertos === 1 ? "plan de mejora abierto" : "planes de mejora abiertos"}`}
                  {ind.planesVencidos > 0 && ` · ${ind.planesVencidos} vencido${ind.planesVencidos === 1 ? "" : "s"}`}
                </span>
                <Link href={`${rutaBase}/indicadores/${ind.codigo}${sufijo}`} className="ind-abrir">
                  Abrir ficha
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </footer>
            </article>
          );
        })}
      </section>

      {datos.matriz.length > 0 && (
        <section className="ind-panel revelar" style={escalon(3)} aria-label="Semáforo por área">
          <div className="flex flex-wrap items-end justify-between gap-3 px-5 pt-5">
            <div>
              <p className="mono-label flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                Trazabilidad por área
              </p>
              <h2 className="mt-1 font-display text-[1.05rem] font-bold tracking-tight text-foreground">Semáforo área × indicador · acumulado {datos.anio}</h2>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">Las mismas tres fórmulas aplicadas al universo de cada área. Toca una celda para abrir la ficha de esa área.</p>
            </div>
            <ul className="ind-leyenda" aria-label="Leyenda del semáforo">
              <li data-sem="verde">Cumple ≥ 85</li>
              <li data-sem="amarillo">Alerta 70–84,9</li>
              <li data-sem="rojo">Crítico &lt; 70</li>
            </ul>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="ind-matriz">
              <thead>
                <tr>
                  <th scope="col">Área / proceso</th>
                  {CODIGOS.map((c) => (
                    <th key={c} scope="col">
                      <span className="block">{CATALOGO[c].corto}</span>
                      <small>{c}</small>
                    </th>
                  ))}
                  <th scope="col" className="text-right">
                    Planes
                    <small>de mejora abiertos</small>
                  </th>
                </tr>
              </thead>
              <tbody>
                {datos.matriz.map((fila) => (
                  <tr key={fila.areaId}>
                    <th scope="row">
                      <Link href={`${rutaBase}/indicadores/PIC-ADH-01?area=${fila.areaId}`} className="ind-area-enlace">
                        {fila.areaNombre}
                      </Link>
                    </th>
                    {CODIGOS.map((c) => (
                      <td key={c}>
                        <CeldaMatriz codigo={c} m={fila.celdas[c]} href={`${rutaBase}/indicadores/${c}?area=${fila.areaId}`} />
                      </td>
                    ))}
                    <td className="text-right">
                      <span className={cn("ind-contador", fila.planesAbiertos > 0 && "ind-contador-activo")}>{fila.planesAbiertos}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function CeldaMatriz({ codigo, m, href }: { codigo: CodigoIndicador; m: Medicion; href: string }) {
  const f = CATALOGO[codigo];
  return (
    <Link href={href} className="ind-celda" data-sem={m.sem} title={`${f.columnas[0]}: ${m.variables[0]} · ${f.columnas[1]}: ${m.variables[1]}`}>
      <i aria-hidden="true" />
      <b>{formatearValor(codigo, m.valor)}</b>
      <small>
        {m.variables[1]}/{m.variables[0]}
      </small>
    </Link>
  );
}
