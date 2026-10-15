"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { PenLine, Save } from "lucide-react";
import { toast } from "sonner";
import { guardarAnalisisAction, type EstadoAccion } from "@/app/admin/planes-capacitacion/[id]/indicadores/actions";
import type { AnalisisPeriodo, Medicion } from "@/lib/indicadores-gestion";
import { ROMANO, formatearValor, type CodigoIndicador } from "@/components/indicadores/catalogo";

const inicial: EstadoAccion = { error: null };

/**
 * Redactar o corregir el ANÁLISIS de un trimestre. El texto existente del
 * trimestre elegido se precarga (una fila por periodo: guardar reescribe).
 * La medición del periodo se muestra al lado para que el análisis se
 * escriba mirando el número, no de memoria.
 */
export function FormAnalisis({
  planId,
  codigo,
  anio,
  areaId,
  trimestres,
  existentes,
  trimestreInicial,
}: {
  planId: string;
  codigo: CodigoIndicador;
  anio: number;
  areaId: string | null;
  trimestres: Medicion[];
  /** Solo los del alcance de escritura (misma área o institucional). */
  existentes: AnalisisPeriodo[];
  trimestreInicial: number;
}) {
  const [trimestre, setTrimestre] = useState(trimestreInicial);
  const [state, accion, pendiente] = useActionState(guardarAnalisisAction, inicial);
  const selectRef = useRef<HTMLSelectElement>(null);
  const existente = existentes.find((a) => a.trimestre === trimestre) ?? null;
  const medicion = trimestres[trimestre - 1];

  useEffect(() => {
    if (state.ok) toast.success("Análisis guardado.");
    // Tras una acción React reinicia el formulario y el <select> nativo
    // vuelve a su primera opción aunque el estado siga en el mismo
    // trimestre: se vuelve a alinear el DOM con el estado.
    if (selectRef.current) selectRef.current.value = String(trimestre);
  }, [state, trimestre]);

  return (
    <form action={accion} className="ind-form-analisis form-premium">
      <input type="hidden" name="planId" value={planId} />
      <input type="hidden" name="codigo" value={codigo} />
      <input type="hidden" name="anio" value={anio} />
      <input type="hidden" name="areaId" value={areaId ?? ""} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="grid gap-1">
          <span>Periodo analizado</span>
          <select ref={selectRef} name="trimestre" value={trimestre} onChange={(e) => setTrimestre(Number(e.target.value))} className="min-w-[220px]">
            {trimestres.map((t) => (
              <option key={t.trimestre ?? 0} value={t.trimestre ?? 1} disabled={t.periodo === "futuro"}>
                {t.etiqueta}
                {t.periodo === "futuro" ? " · sin iniciar" : t.periodo === "en-curso" ? " · en curso" : ""}
              </option>
            ))}
          </select>
        </label>
        {medicion && (
          <div className="ind-medida-inline" data-sem={medicion.sem}>
            <span className="mono-label">Medición T{ROMANO[trimestre - 1]}</span>
            <b>{formatearValor(codigo, medicion.valor)}</b>
            <small>
              {medicion.variables[1]} / {medicion.variables[0]} · {medicion.generado}
            </small>
          </div>
        )}
      </div>

      <label className="grid gap-1">
        <span className="flex items-center gap-1.5">
          <PenLine className="h-3 w-3" aria-hidden="true" />
          {existente ? "Análisis registrado · al guardar se reemplaza" : "Análisis cualitativo y cuantitativo del periodo"}
        </span>
        <textarea
          key={`${trimestre}-${existente?.id ?? "nuevo"}`}
          name="texto"
          rows={6}
          required
          minLength={20}
          defaultValue={existente?.texto ?? ""}
          placeholder="Qué dice el número, por qué salió así (causas), qué áreas o capacitaciones explican el resultado y qué se va a hacer."
        />
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] text-muted-foreground">
          {existente ? `Última redacción: ${existente.autor ?? "—"} · ${existente.actualizado}` : "Aún no hay análisis para este periodo."}
        </p>
        <button type="submit" disabled={pendiente} className="ind-boton-primario">
          <Save className="h-4 w-4" aria-hidden="true" />
          {pendiente ? "Guardando…" : existente ? "Guardar cambios" : "Guardar análisis"}
        </button>
      </div>
      {state.error && (
        <p role="alert" className="ind-error">
          {state.error}
        </p>
      )}
    </form>
  );
}
