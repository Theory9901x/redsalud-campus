"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Filter, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const campo = "h-10 rounded-xl border border-border/60 bg-card/70 px-3 text-[13px] font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary/30";

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
    <form action={aplicar} className="surface-glass flex flex-wrap items-end gap-3 p-4">
      <div className="flex items-center gap-1.5 self-center pr-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">
        <Filter className="h-3.5 w-3.5" aria-hidden="true" />
        Periodo
      </div>
      <div className="inline-flex rounded-xl bg-muted/60 p-1">
        {[["mensual", "Mensual"], ["trimestral", "Trimestral"], ["anual", "Anual"]].map(([v, l]) => (
          <label key={v} className={cn("cursor-pointer rounded-lg px-3 py-1.5 text-[12.5px] font-bold transition-all", tipo === v ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            <input type="radio" name="tipo" value={v} checked={tipo === v} onChange={() => setTipo(v)} className="sr-only" />
            {l}
          </label>
        ))}
      </div>
      <select name="anio" defaultValue={valores.anio} className={campo} aria-label="Año">
        {opciones.anios.map((a) => (
          <option key={a} value={a}>{a}</option>
        ))}
      </select>
      {tipo === "mensual" && (
        <select name="mes" defaultValue={valores.mes} className={campo} aria-label="Mes">
          {MESES.map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </select>
      )}
      {tipo === "trimestral" && (
        <select name="trimestre" defaultValue={valores.trimestre} className={campo} aria-label="Trimestre">
          {[1, 2, 3, 4].map((t) => (
            <option key={t} value={t}>{t}º trimestre</option>
          ))}
        </select>
      )}
      <span className="mx-1 hidden h-8 w-px bg-border/70 sm:block" aria-hidden="true" />
      <select name="sede" defaultValue={valores.sede} className={campo} aria-label="Sede">
        <option value="">Todas las sedes</option>
        {opciones.sedes.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <select name="servicio" defaultValue={valores.servicio} className={campo} aria-label="Servicio">
        <option value="">Todos los servicios</option>
        {opciones.servicios.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <select name="sexo" defaultValue={valores.sexo} className={campo} aria-label="Sexo">
        <option value="">Ambos sexos</option>
        <option value="Femenino">Femenino</option>
        <option value="Masculino">Masculino</option>
      </select>
      <select name="eps" defaultValue={valores.eps} className={campo} aria-label="EPS">
        <option value="">Todas las EPS</option>
        {opciones.eps.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <button type="submit" className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-r from-primary to-teal-400 px-4 text-[13px] font-bold text-white shadow-md shadow-primary/25">
        Aplicar
      </button>
      <button type="button" onClick={() => router.push("?")} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border/60 bg-card/70 px-3 text-[12.5px] font-bold text-muted-foreground hover:text-foreground" title="Limpiar filtros">
        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </form>
  );
}
