"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Building2, CalendarDays, ClipboardList, GraduationCap, Plus, Radio } from "lucide-react";
import type { CapacitacionMedida, ValorCapacitacion } from "@/lib/indicadores-gestion";
import type { PrecargaMejora } from "@/components/indicadores/form-plan-mejora";
import { CATALOGO, MESES_TRIMESTRE, ROMANO, VEREDICTO, formatearValor, type CodigoIndicador } from "@/components/indicadores/catalogo";
import { SenalSemaforo } from "@/components/indicadores/graficos-svg";
import { cn } from "@/lib/utils";

const PESO: Record<ValorCapacitacion["sem"], number> = { rojo: 0, amarillo: 1, verde: 2, "sin-datos": 3 };
/** Con planes grandes (~60 líneas) se muestran primero las que tienen dato y un puñado más; el resto, al pedirlo. */
const LIMITE = 12;

export const ESTADO_CAP = { borrador: "Borrador", abierta: "Abierta", cerrada: "Cerrada" } as const;

/**
 * POR CAPACITACIÓN: la unidad de medida de todo indicador. Cada fila es una
 * capacitación del alcance con SU valor (numerador, denominador y
 * variables), su semáforo y su estado; lo peor primero. El filtro por
 * trimestre cambia la medición a la de ese corte; el de área acota la lista.
 * Desde cada fila se abre la capacitación o se crea un plan de mejora ya
 * asignado a ella.
 */
export function CapacitacionesMedidas({
  codigo,
  capacitaciones,
  rutaBase,
  anio,
  modo,
  puedeMejora,
  alPlanMejora,
}: {
  codigo: CodigoIndicador;
  capacitaciones: CapacitacionMedida[];
  rutaBase: string;
  anio: number;
  modo: "lista" | "tabla";
  puedeMejora: boolean;
  alPlanMejora: (p: PrecargaMejora) => void;
}) {
  const f = CATALOGO[codigo];
  const [trimestre, setTrimestre] = useState<string>("");
  const [area, setArea] = useState<string>("");
  const [todas, setTodas] = useState(false);

  const areas = useMemo(
    () => [...new Map(capacitaciones.map((c) => [c.areaId, c.areaNombre])).entries()].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [capacitaciones]
  );
  const t = trimestre ? Number(trimestre) : null;

  const filas = useMemo(() => {
    const medida = (c: CapacitacionMedida): ValorCapacitacion => (t ? c.porTrimestre[t] : c);
    return capacitaciones
      .filter((c) => (!t || c.trimestres.includes(t)) && (!area || c.areaId === area))
      .map((c) => ({ c, m: medida(c) }))
      .sort((a, b) => PESO[a.m.sem] - PESO[b.m.sem] || (a.m.valor ?? 0) - (b.m.valor ?? 0) || a.c.titulo.localeCompare(b.c.titulo, "es"));
  }, [capacitaciones, t, area]);

  const medidas = filas.filter((x) => x.m.valor !== null).length;
  const preliminares = filas.filter((x) => x.m.valor !== null && x.c.preliminar).length;
  // Lo que tiene dato va siempre completo (está ordenado primero); lo que no, se recorta.
  const limite = Math.max(medidas, LIMITE);
  const visibles = todas || filas.length <= limite ? filas : filas.slice(0, limite);
  const ocultas = filas.length - visibles.length;
  const corte = t ? `Trimestre ${ROMANO[t - 1]} · ${MESES_TRIMESTRE[t - 1]}` : `Año ${anio}`;

  const precargaDe = (c: CapacitacionMedida, m: ValorCapacitacion): PrecargaMejora => ({
    areaId: c.areaId === "sin-area" ? null : c.areaId,
    areaNombre: c.areaId === "sin-area" ? null : c.areaNombre,
    activityId: c.activityId,
    activityTitulo: c.titulo,
    trimestre: t ?? (c.trimestres.length === 1 ? c.trimestres[0] : null),
    hallazgo: `${corte} · ${c.titulo} (${c.areaNombre}${c.programa ? ` · ${c.programa}` : ""}): ${f.corto} en ${formatearValor(codigo, m.valor)} (${m.detalle.toLowerCase()})${
      c.preliminar ? ", dato preliminar con la jornada abierta" : ""
    }. Meta: ${f.meta}`,
  });

  return (
    <div className="ind-caps-bloque">
      <div className="ind-caps-filtros" role="group" aria-label="Filtrar capacitaciones">
        <label>
          <span>Corte</span>
          <select value={trimestre} onChange={(e) => setTrimestre(e.target.value)}>
            <option value="">Todo el año {anio}</option>
            {ROMANO.map((r, i) => (
              <option key={r} value={i + 1}>
                Trimestre {r} · {MESES_TRIMESTRE[i]}
              </option>
            ))}
          </select>
        </label>
        {areas.length > 1 && (
          <label>
            <span>Área</span>
            <select value={area} onChange={(e) => setArea(e.target.value)}>
              <option value="">Todas las áreas</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </label>
        )}
        <p className="ind-caps-resumen">
          <b>{medidas}</b> de <b>{filas.length}</b> capacitaciones con dato
          {preliminares > 0 && (
            <>
              {" · "}
              <em>{preliminares} preliminar{preliminares === 1 ? "" : "es"}</em>
            </>
          )}
        </p>
      </div>

      {filas.length === 0 ? (
        <div className="ind-vacio mt-3">
          <GraduationCap className="h-5 w-5" aria-hidden="true" />
          <div>
            <b>Ninguna capacitación programada en este corte.</b>
            <p>Cambia el trimestre o el área: el indicador se mide sobre las capacitaciones que el PIC programa en cada periodo.</p>
          </div>
        </div>
      ) : modo === "lista" ? (
        <ul className="ind-caps">
          {visibles.map(({ c, m }) => (
            <li key={c.activityId} className="ind-cap" data-sem={m.sem} data-prelim={(c.preliminar && m.valor !== null) || undefined}>
              <div className="ind-cap-valor">
                <b>{formatearValor(codigo, m.valor)}</b>
                <SenalSemaforo sem={m.sem}>{VEREDICTO[m.sem]}</SenalSemaforo>
              </div>
              <div className="min-w-0 flex-1">
                <Link href={`${rutaBase}/actividades/${c.activityId}?t=${t ?? c.trimestreEnlace}`} className="ind-cap-titulo">
                  {c.titulo}
                </Link>
                <p className="ind-cap-detalle">{m.detalle}</p>
                <div className="ind-cap-chips">
                  <span>
                    <Building2 className="h-3 w-3" aria-hidden="true" />
                    {c.areaNombre}
                  </span>
                  {c.programa && <span>{c.programa}</span>}
                  <span className="font-mono">{c.trimestres.length ? c.trimestres.map((q) => `T${ROMANO[q - 1]}`).join(" · ") : "Sin trimestre"}</span>
                  {c.jornada && (
                    <span>
                      <CalendarDays className="h-3 w-3" aria-hidden="true" />
                      {c.jornada}
                    </span>
                  )}
                  <EstadoCap c={c} conDato={m.valor !== null} codigo={codigo} />
                  {c.planesAbiertos > 0 && (
                    <span className="ind-cap-planes">
                      <ClipboardList className="h-3 w-3" aria-hidden="true" />
                      {c.planesAbiertos} plan{c.planesAbiertos === 1 ? "" : "es"} de mejora
                    </span>
                  )}
                </div>
              </div>
              <div className="ind-cap-acciones">
                <Link href={`${rutaBase}/actividades/${c.activityId}?t=${t ?? c.trimestreEnlace}`} className="ind-boton-secundario">
                  Abrir
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
                {puedeMejora && (
                  <button type="button" className="ind-boton-secundario ind-cap-mejora" onClick={() => alPlanMejora(precargaDe(c, m))} data-escritura>
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    Plan de mejora
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="ind-tabla">
            <thead>
              <tr>
                <th scope="col">Capacitación</th>
                <th scope="col">Área · programa</th>
                <th scope="col">Trimestres</th>
                <th scope="col">Jornada</th>
                <th scope="col" className="text-right">Valor</th>
                <th scope="col" className="text-right">Numerador</th>
                <th scope="col" className="text-right">Denominador</th>
                <th scope="col">Variables</th>
                <th scope="col">Semáforo</th>
                <th scope="col">Estado</th>
                {puedeMejora && <th scope="col" />}
              </tr>
            </thead>
            <tbody>
              {visibles.map(({ c, m }) => (
                <tr key={c.activityId} data-prelim={(c.preliminar && m.valor !== null) || undefined}>
                  <td className="max-w-[280px] whitespace-normal font-semibold">
                    <Link href={`${rutaBase}/actividades/${c.activityId}?t=${t ?? c.trimestreEnlace}`} className="ind-area-enlace">
                      {c.titulo}
                    </Link>
                  </td>
                  <td className="max-w-[200px] whitespace-normal text-[12px] text-muted-foreground">
                    {c.areaNombre}
                    {c.programa ? ` · ${c.programa}` : ""}
                  </td>
                  <td className="font-mono text-[12px]">{c.trimestres.length ? c.trimestres.map((q) => `T${ROMANO[q - 1]}`).join(" ") : "—"}</td>
                  <td className="text-[12px] text-muted-foreground">{c.jornada ?? "—"}</td>
                  <td className="text-right">
                    <b className="ind-valor" data-sem={m.sem}>
                      {formatearValor(codigo, m.valor)}
                    </b>
                  </td>
                  <td className="text-right font-mono">{m.valor === null ? "—" : String(m.numerador).replace(".", ",")}</td>
                  <td className="text-right font-mono">{m.valor === null ? "—" : String(m.denominador).replace(".", ",")}</td>
                  <td className="max-w-[240px] whitespace-normal text-[12px] text-muted-foreground">{m.detalle}</td>
                  <td>
                    <SenalSemaforo sem={m.sem}>{VEREDICTO[m.sem]}</SenalSemaforo>
                  </td>
                  <td>
                    <EstadoCap c={c} conDato={m.valor !== null} codigo={codigo} />
                  </td>
                  {puedeMejora && (
                    <td>
                      <button type="button" className="ind-boton-secundario ind-cap-mejora" onClick={() => alPlanMejora(precargaDe(c, m))} data-escritura>
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        Plan de mejora
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {ocultas > 0 && (
        <button type="button" className="ind-boton-secundario mt-3" onClick={() => setTodas(true)}>
          Ver las {ocultas} capacitaciones sin dato restantes
        </button>
      )}
    </div>
  );
}

/** Estado de la jornada y, en adherencia, si el dato es preliminar (abierta) o definitivo (cerrada). */
function EstadoCap({ c, conDato, codigo }: { c: CapacitacionMedida; conDato: boolean; codigo: CodigoIndicador }) {
  const prelim = codigo === "PIC-ADH-01" && conDato && c.preliminar;
  const definitivo = codigo === "PIC-ADH-01" && conDato && c.estado === "cerrada";
  return (
    <span className={cn("ind-cap-estado", prelim && "ind-cap-estado-prelim")} data-estado-cap={c.estado} title={c.cerradaEl ? `Cerrada el ${c.cerradaEl}` : undefined}>
      {prelim && <Radio className="h-3 w-3" aria-hidden="true" />}
      {ESTADO_CAP[c.estado]}
      {prelim ? " · preliminar" : definitivo ? " · definitivo" : ""}
    </span>
  );
}
