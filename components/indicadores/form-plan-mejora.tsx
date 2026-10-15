"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { crearPlanMejoraAction, type EstadoAccion } from "@/app/admin/planes-capacitacion/[id]/indicadores/actions";
import type { ContextoFormulario, Medicion } from "@/lib/indicadores-gestion";
import { CATALOGO, ROMANO, formatearValor, type CodigoIndicador } from "@/components/indicadores/catalogo";

const inicial: EstadoAccion = { error: null };
const OTRO = "__otro__";

/**
 * Precarga cuando el plan nace de UNA capacitación (acción rápida de la
 * fila "Por capacitación"): área, capacitación, trimestre y el hallazgo ya
 * redactado con la medición de esa jornada.
 */
export type PrecargaMejora = {
  areaId: string | null;
  areaNombre: string | null;
  activityId: string;
  activityTitulo: string;
  trimestre: number | null;
  hallazgo: string;
};

/**
 * NUEVO PLAN DE MEJORA. Se asigna a algo concreto: vigencia y trimestre, área
 * o proceso, capacitación del PIC (filtrada por el área elegida) y
 * responsable (usuario de la plataforma o cargo). El hallazgo se precarga
 * con la medición del trimestre elegido para que el plan nazca del dato; si
 * viene `precarga`, con la de ESA capacitación.
 */
export function FormPlanMejora({
  planId,
  codigo,
  contexto,
  trimestres,
  trimestreInicial,
  areaFija,
  precarga = null,
  alCrear,
}: {
  planId: string;
  codigo: CodigoIndicador;
  contexto: ContextoFormulario;
  trimestres: Medicion[];
  trimestreInicial: number;
  /** Área impuesta por el alcance (tutor de área o ?area=): no se puede cambiar. */
  areaFija: { id: string; nombre: string } | null;
  precarga?: PrecargaMejora | null;
  alCrear: () => void;
}) {
  const ficha = CATALOGO[codigo];
  const [state, accion, pendiente] = useActionState(crearPlanMejoraAction, inicial);
  const [trimestre, setTrimestre] = useState<string>(precarga ? (precarga.trimestre ? String(precarga.trimestre) : "") : String(trimestreInicial));
  const [areaId, setAreaId] = useState<string>(areaFija?.id ?? precarga?.areaId ?? "");
  const [activityId, setActivityId] = useState<string>(precarga?.activityId ?? "");
  const [responsable, setResponsable] = useState<string>("");

  const actividades = useMemo(() => contexto.actividades.filter((a) => !areaId || a.areaId === areaId), [contexto.actividades, areaId]);
  // Al cambiar de área, la capacitación elegida deja de valer si no es de esa área.
  const activityValida = actividades.some((a) => a.id === activityId) ? activityId : "";

  const hallazgoSugerido = useMemo(() => {
    if (precarga) return precarga.hallazgo;
    const t = trimestre ? trimestres[Number(trimestre) - 1] : null;
    if (!t) return "";
    return `${t.etiqueta}: ${ficha.corto} en ${formatearValor(codigo, t.valor)} (${ficha.columnas[1].toLowerCase()} ${t.variables[1]} sobre ${ficha.columnas[0].toLowerCase()} ${t.variables[0]}). Meta: ${ficha.meta}`;
  }, [precarga, trimestre, trimestres, codigo, ficha]);

  useEffect(() => {
    if (state.ok) {
      toast.success("Plan de mejora creado.");
      alCrear();
    }
  }, [state, alCrear]);

  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="planId" value={planId} />
      <input type="hidden" name="codigo" value={codigo} />
      <input type="hidden" name="anio" value={contexto.anio} />

      <div className="ind-form-contexto">
        <span className="mono-label">Indicador</span>
        <b>
          {codigo} · {ficha.nombre}
        </b>
        {precarga && (
          <small className="mt-1 block text-[12px] text-muted-foreground">
            Nace de la capacitación <b className="inline text-foreground">{precarga.activityTitulo}</b>
            {precarga.areaNombre ? ` · ${precarga.areaNombre}` : ""}
          </small>
        )}
      </div>

      <label className="grid gap-1">
        <span>Título del plan de mejora</span>
        <input name="titulo" required minLength={5} placeholder="Ej.: Reforzar la convocatoria de la jornada de PAI" />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="grid gap-1">
          <span>Vigencia</span>
          <input value={contexto.anio} readOnly aria-readonly="true" />
        </label>
        <label className="grid gap-1">
          <span>Trimestre de la medición</span>
          <select name="trimestre" value={trimestre} onChange={(e) => setTrimestre(e.target.value)}>
            <option value="">Toda la vigencia</option>
            {trimestres.map((t) => (
              <option key={t.trimestre ?? 0} value={t.trimestre ?? ""}>
                Trimestre {ROMANO[(t.trimestre ?? 1) - 1]} · {formatearValor(codigo, t.valor)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="grid gap-1">
          <span>Área / proceso</span>
          {areaFija ? (
            <>
              <input type="hidden" name="areaId" value={areaFija.id} />
              <input value={areaFija.nombre} readOnly aria-readonly="true" />
            </>
          ) : (
            <select name="areaId" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
              <option value="">Institucional (todo el plan)</option>
              {contexto.areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
          )}
        </label>
        <label className="grid gap-1">
          <span>Capacitación del PIC (opcional)</span>
          <select name="activityId" value={activityValida} onChange={(e) => setActivityId(e.target.value)}>
            <option value="">Sin capacitación puntual</option>
            {actividades.map((a) => (
              <option key={a.id} value={a.id}>
                {a.titulo}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="grid gap-1">
          <span>Responsable</span>
          <select name="responsableUserId" value={responsable === OTRO ? "" : responsable} onChange={(e) => setResponsable(e.target.value)} required={responsable !== OTRO}>
            <option value="">Elegir persona…</option>
            {contexto.responsables.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre}
              </option>
            ))}
          </select>
          <button type="button" className="ind-enlace-mini" onClick={() => setResponsable(responsable === OTRO ? "" : OTRO)}>
            {responsable === OTRO ? "Elegir una persona de la plataforma" : "El responsable es un cargo, no un usuario"}
          </button>
          {responsable === OTRO && <input name="responsableLabel" required placeholder="Ej.: Profesional líder PAI" className="mt-1" />}
        </label>
        <label className="grid gap-1">
          <span>Fecha de compromiso</span>
          <input type="date" name="fechaCompromiso" required />
        </label>
      </div>

      <label className="grid gap-1">
        <span>Hallazgo</span>
        <textarea key={hallazgoSugerido} name="hallazgo" rows={3} required minLength={10} defaultValue={hallazgoSugerido} />
      </label>

      <label className="grid gap-1">
        <span>Acciones comprometidas</span>
        <textarea name="acciones" rows={4} required minLength={10} placeholder="Qué se va a hacer, quién y cuándo. Una acción por línea." />
      </label>

      {state.error && (
        <p role="alert" className="ind-error">
          {state.error}
        </p>
      )}
      <div className="flex justify-end">
        <button type="submit" disabled={pendiente} className="ind-boton-primario">
          <Save className="h-4 w-4" aria-hidden="true" />
          {pendiente ? "Creando…" : "Crear plan de mejora"}
        </button>
      </div>
    </form>
  );
}
