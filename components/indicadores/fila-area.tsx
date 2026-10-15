"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Radio } from "lucide-react";
import type { FilaMatriz, Medicion } from "@/lib/indicadores-gestion";
import { CATALOGO, CODIGOS, ROMANO, VEREDICTO, formatearValor, type CodigoIndicador } from "@/components/indicadores/catalogo";
import { ESTADO_CAP } from "@/components/indicadores/capacitaciones-medidas";
import { cn } from "@/lib/utils";

/**
 * FILA de un área en la matriz área × indicador: el consolidado del área en
 * cada indicador (con capacitaciones medidas / programadas) y, al
 * desplegarla, una subfila por capacitación con su semáforo en los tres.
 * Así el número del área nunca se lee solo: se ve qué capacitación lo
 * arrastra.
 */
export function FilaArea({ fila, rutaBase }: { fila: FilaMatriz; rutaBase: string }) {
  const [abierta, setAbierta] = useState(false);
  const n = fila.capacitaciones.length;
  return (
    <>
      <tr data-abierta={abierta || undefined}>
        <td>
          <button
            type="button"
            className="ind-desplegar"
            onClick={() => setAbierta((v) => !v)}
            aria-expanded={abierta}
            aria-label={`${abierta ? "Ocultar" : "Ver"} las ${n} capacitaciones de ${fila.areaNombre}`}
            disabled={n === 0}
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", abierta && "rotate-180")} aria-hidden="true" />
          </button>
        </td>
        <th scope="row">
          <Link href={`${rutaBase}/indicadores/PIC-ADH-01?area=${fila.areaId}`} className="ind-area-enlace">
            {fila.areaNombre}
          </Link>
          <small className="ind-matriz-programadas">
            {n} programada{n === 1 ? "" : "s"}
          </small>
        </th>
        {CODIGOS.map((c) => (
          <td key={c}>
            <CeldaMatriz codigo={c} m={fila.celdas[c]} medidas={fila.medidas[c]} programadas={fila.programadas} href={`${rutaBase}/indicadores/${c}?area=${fila.areaId}`} />
          </td>
        ))}
        <td className="text-right">
          <span className={cn("ind-contador", fila.planesAbiertos > 0 && "ind-contador-activo")}>{fila.planesAbiertos}</span>
        </td>
      </tr>
      {abierta &&
        fila.capacitaciones.map((cap) => (
          <tr key={cap.activityId} className="ind-subfila">
            <td />
            <th scope="row">
              <Link href={`${rutaBase}/actividades/${cap.activityId}?t=${cap.trimestreEnlace}`} className="ind-area-enlace">
                {cap.titulo}
              </Link>
              <small className="ind-matriz-programadas">
                {cap.programa ? `${cap.programa} · ` : ""}
                {cap.trimestres.length ? cap.trimestres.map((q) => `T${ROMANO[q - 1]}`).join(" ") : "Sin trimestre"} · {ESTADO_CAP[cap.estado]}
                {cap.preliminar && (
                  <em className="ind-prelim-mini">
                    <Radio className="h-2.5 w-2.5" aria-hidden="true" />
                    preliminar
                  </em>
                )}
              </small>
            </th>
            {CODIGOS.map((c) => {
              const v = cap.celdas[c];
              return (
                <td key={c}>
                  <span className="ind-celda ind-celda-cap" data-sem={v.sem} title={`${VEREDICTO[v.sem]} · ${v.detalle}`}>
                    <i aria-hidden="true" />
                    <b>{formatearValor(c, v.valor)}</b>
                    <small>{v.detalle}</small>
                  </span>
                </td>
              );
            })}
            <td />
          </tr>
        ))}
    </>
  );
}

function CeldaMatriz({ codigo, m, medidas, programadas, href }: { codigo: CodigoIndicador; m: Medicion; medidas: number; programadas: number; href: string }) {
  const f = CATALOGO[codigo];
  return (
    <Link href={href} className="ind-celda" data-sem={m.sem} title={`${f.columnas[0]}: ${m.variables[0]} · ${f.columnas[1]}: ${m.variables[1]} · ${medidas} de ${programadas} capacitaciones con dato`}>
      <i aria-hidden="true" />
      <b>{formatearValor(codigo, m.valor)}</b>
      <small>
        {medidas}/{programadas} medidas
      </small>
    </Link>
  );
}
