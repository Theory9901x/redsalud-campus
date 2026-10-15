"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Filter, RotateCcw } from "lucide-react";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

/**
 * Filtros combinables del centro de datos SIAU: periodo (mensual,
 * trimestral, anual) y variables de la encuesta. Viven en la URL para que
 * cualquier vista o exportable reciba exactamente lo mismo.
 */
export function FiltrosSiau({
  valores,
  opciones,
}: {
  valores: { tipo: string; anio: number; mes: number; trimestre: number; sede: string; servicio: string; sexo: string; eps: string };
  opciones: { sedes: string[]; servicios: string[]; eps: string[]; anios: number[] };
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [tipo, setTipo] = useState(valores.tipo);

  function aplicar(form: FormData) {
    const q = new URLSearchParams(params.toString());
    for (const k of ["tipo", "anio", "mes", "trimestre", "sede", "servicio", "sexo", "eps"]) {
      const v = String(form.get(k) ?? "");
      if (v) q.set(k, v);
      else q.delete(k);
    }
    router.push(`?${q.toString()}`);
  }

  return (
    <form action={aplicar} className="barra-modulo p-4" aria-label="Filtros del centro de datos">
      <div className="flex flex-wrap items-end gap-3">
        <div className="enc-campo">
          <span>Periodo</span>
          <div className="enc-interruptor" role="radiogroup" aria-label="Tipo de periodo">
            {[["mensual", "Mensual"], ["trimestral", "Trimestral"], ["anual", "Anual"]].map(([v, l]) => (
              <label key={v} data-activo={tipo === v}>
                <input type="radio" name="tipo" value={v} checked={tipo === v} onChange={() => setTipo(v)} className="sr-only" />
                {l}
              </label>
            ))}
          </div>
        </div>
        <label className="enc-campo w-[104px]">
          <span>Año</span>
          <select name="anio" defaultValue={valores.anio} className="enc-control">
            {opciones.anios.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </label>
        {tipo === "mensual" && (
          <label className="enc-campo w-[140px]">
            <span>Mes</span>
            <select name="mes" defaultValue={valores.mes} className="enc-control">
              {MESES.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </label>
        )}
        {tipo === "trimestral" && (
          <label className="enc-campo w-[140px]">
            <span>Trimestre</span>
            <select name="trimestre" defaultValue={valores.trimestre} className="enc-control">
              {[1, 2, 3, 4].map((t) => (
                <option key={t} value={t}>{t}º trimestre</option>
              ))}
            </select>
          </label>
        )}
        <div className="flex items-center gap-2 sm:ml-auto">
          <button type="submit" className="enc-boton enc-boton-primario">
            <Filter aria-hidden="true" />
            Aplicar filtros
          </button>
          <button type="button" onClick={() => router.push("?")} className="enc-boton" title="Limpiar filtros" aria-label="Limpiar filtros">
            <RotateCcw aria-hidden="true" />
          </button>
        </div>
      </div>
      {/* Variables de la encuesta */}
      <div className="mt-4 grid grid-cols-1 gap-3 border-t border-border/60 pt-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="enc-campo">
          <span>Sede</span>
          <select name="sede" defaultValue={valores.sede} className="enc-control">
            <option value="">Todas las sedes</option>
            {opciones.sedes.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="enc-campo">
          <span>Servicio</span>
          <select name="servicio" defaultValue={valores.servicio} className="enc-control">
            <option value="">Todos los servicios</option>
            {opciones.servicios.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="enc-campo">
          <span>Sexo</span>
          <select name="sexo" defaultValue={valores.sexo} className="enc-control">
            <option value="">Ambos sexos</option>
            <option value="Femenino">Femenino</option>
            <option value="Masculino">Masculino</option>
          </select>
        </label>
        <label className="enc-campo">
          <span>EPS</span>
          <select name="eps" defaultValue={valores.eps} className="enc-control">
            <option value="">Todas las EPS</option>
            {opciones.eps.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
    </form>
  );
}
