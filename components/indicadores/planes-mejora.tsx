"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Building2, CalendarCheck2, CheckCircle2, ChevronDown, ClipboardList, GraduationCap, History, RotateCcw, UserRound } from "lucide-react";
import { toast } from "sonner";
import { agregarSeguimientoAction, cambiarEstadoPlanMejoraAction, type EstadoAccion } from "@/app/admin/planes-capacitacion/[id]/indicadores/actions";
import type { PlanMejoraVista } from "@/lib/indicadores-gestion";
import { ESTADO_MEJORA, ROMANO } from "@/components/indicadores/catalogo";
import { cn } from "@/lib/utils";

const inicial: EstadoAccion = { error: null };

const SIN_CAP = "__sin__";

/**
 * LISTA de planes de mejora del indicador. Cada tarjeta muestra a qué está
 * asignado (vigencia/trimestre, área y, en primer plano, la CAPACITACIÓN),
 * quién responde, la fecha de compromiso y el avance; se despliega para ver
 * hallazgo, acciones, la bitácora de seguimientos y las acciones de
 * gestión. Se puede filtrar por capacitación.
 */
export function ListaPlanesMejora({ planes, puedeEscribir }: { planes: PlanMejoraVista[]; puedeEscribir: boolean }) {
  const [filtro, setFiltro] = useState("");
  const capacitaciones = useMemo(
    () =>
      [...new Map(planes.filter((p) => p.activityId).map((p) => [p.activityId!, p.activityTitulo ?? "Capacitación"])).entries()]
        .map(([id, titulo]) => ({ id, titulo }))
        .sort((a, b) => a.titulo.localeCompare(b.titulo, "es")),
    [planes]
  );
  const visibles = planes.filter((p) => !filtro || (filtro === SIN_CAP ? !p.activityId : p.activityId === filtro));

  if (planes.length === 0) {
    return (
      <div className="ind-vacio">
        <ClipboardList className="h-5 w-5" aria-hidden="true" />
        <div>
          <b>Sin planes de mejora para este indicador.</b>
          <p>Cuando una capacitación quede en alerta o en crítico, créalo desde su fila en «Por capacitación» (nace ya asignado a ella) o aquí, eligiendo vigencia, área y capacitación.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="grid gap-3">
      {capacitaciones.length > 0 && (
        <div className="ind-caps-filtros">
          <label>
            <span>Capacitación</span>
            <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
              <option value="">Todas · {planes.length}</option>
              {capacitaciones.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.titulo}
                </option>
              ))}
              <option value={SIN_CAP}>Sin capacitación puntual</option>
            </select>
          </label>
          <p className="ind-caps-resumen">
            <b>{visibles.length}</b> de <b>{planes.length}</b> planes
          </p>
        </div>
      )}
      {visibles.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Ningún plan de mejora con ese filtro.</p>
      ) : (
        <ul className="grid gap-3">
          {visibles.map((p) => (
            <li key={p.id}>
              <TarjetaPlanMejora p={p} puedeEscribir={puedeEscribir} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TarjetaPlanMejora({ p, puedeEscribir }: { p: PlanMejoraVista; puedeEscribir: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const cerrado = p.estado === "CERRADO";
  return (
    <article className="ind-mejora" data-estado={p.estado}>
      <button type="button" className="ind-mejora-cabecera" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="ind-estado" data-estado={p.estado}>
              {ESTADO_MEJORA[p.estado]}
            </span>
            <span className="mono-label">
              {p.anio}
              {p.trimestre ? ` · T${ROMANO[p.trimestre - 1]}` : " · toda la vigencia"}
            </span>
            {p.activityTitulo && (
              <span className="ind-cap-badge" title={p.activityTitulo}>
                <GraduationCap className="h-3 w-3" aria-hidden="true" />
                {p.activityTitulo}
              </span>
            )}
          </div>
          <h3 className="mt-1.5 font-display text-[15px] font-bold leading-snug tracking-tight text-foreground">{p.titulo}</h3>
          <dl className="ind-mejora-datos">
            <div>
              <dt>
                <Building2 className="h-3 w-3" aria-hidden="true" />
                Área
              </dt>
              <dd>{p.areaNombre ?? "Institucional"}</dd>
            </div>
            <div>
              <dt>
                <GraduationCap className="h-3 w-3" aria-hidden="true" />
                Capacitación
              </dt>
              <dd className="truncate" title={p.activityTitulo ?? undefined}>
                {p.activityTitulo ?? "Sin capacitación puntual"}
              </dd>
            </div>
            <div>
              <dt>
                <UserRound className="h-3 w-3" aria-hidden="true" />
                Responsable
              </dt>
              <dd>{p.responsable}</dd>
            </div>
            <div>
              <dt>
                <CalendarCheck2 className="h-3 w-3" aria-hidden="true" />
                Compromiso
              </dt>
              <dd>{p.fechaCompromiso}</dd>
            </div>
          </dl>
        </div>
        <div className="ind-mejora-avance">
          <span className="mono-label">Avance</span>
          <b>{p.avance} %</b>
          <i aria-hidden="true">
            <span style={{ width: `${p.avance}%` }} />
          </i>
          <ChevronDown className={cn("mt-1 h-4 w-4 text-muted-foreground transition-transform", abierto && "rotate-180")} aria-hidden="true" />
        </div>
      </button>

      {abierto && (
        <div className="ind-mejora-cuerpo">
          <div className="grid gap-4 md:grid-cols-2">
            <section>
              <p className="mono-label">Hallazgo</p>
              <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-foreground/90">{p.hallazgo}</p>
            </section>
            <section>
              <p className="mono-label">Acciones comprometidas</p>
              <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-foreground/90">{p.acciones}</p>
            </section>
          </div>

          {cerrado && p.cierreTexto && (
            <section className="ind-cierre">
              <p className="mono-label flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                Cierre · {p.cerradoEl}
              </p>
              <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed">{p.cierreTexto}</p>
            </section>
          )}

          <section>
            <p className="mono-label flex items-center gap-1.5">
              <History className="h-3.5 w-3.5" aria-hidden="true" />
              Seguimientos · {p.seguimientos.length}
            </p>
            {p.seguimientos.length === 0 ? (
              <p className="mt-1 text-[12.5px] text-muted-foreground">Sin seguimientos todavía. Creado por {p.creadoPor ?? "—"} el {p.creadoEl}.</p>
            ) : (
              <ol className="ind-bitacora">
                {p.seguimientos.map((s) => (
                  <li key={s.id}>
                    <span className="ind-bitacora-nodo" aria-hidden="true" />
                    <div>
                      <p className="text-[13px] leading-relaxed text-foreground/90">{s.texto}</p>
                      <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                        <b className="font-mono text-foreground/80">{s.avance} %</b> · {s.autor ?? "—"} · {s.fecha}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {puedeEscribir && !cerrado && <FormSeguimiento planMejoraId={p.id} avanceActual={p.avance} />}
          {puedeEscribir && <FormEstado planMejoraId={p.id} estadoGuardado={p.estadoGuardado} />}
        </div>
      )}
    </article>
  );
}

function FormSeguimiento({ planMejoraId, avanceActual }: { planMejoraId: string; avanceActual: number }) {
  const [state, accion, pendiente] = useActionState(agregarSeguimientoAction, inicial);
  const [avance, setAvance] = useState(avanceActual);
  useEffect(() => {
    if (state.ok) toast.success("Seguimiento registrado.");
  }, [state]);
  return (
    <form action={accion} className="ind-form-seguimiento form-premium">
      <input type="hidden" name="planMejoraId" value={planMejoraId} />
      <label className="grid flex-1 gap-1">
        <span>Nuevo seguimiento</span>
        <textarea name="texto" rows={2} required minLength={5} placeholder="Qué se hizo desde el último seguimiento." />
      </label>
      <label className="grid gap-1 sm:w-[170px]">
        <span>Avance acumulado · {avance} %</span>
        <input type="range" name="avance" min={0} max={100} step={5} value={avance} onChange={(e) => setAvance(Number(e.target.value))} className="ind-rango" />
      </label>
      <button type="submit" disabled={pendiente} className="ind-boton-secundario self-end">
        {pendiente ? "Guardando…" : "Registrar"}
      </button>
      {state.error && (
        <p role="alert" className="ind-error basis-full">
          {state.error}
        </p>
      )}
    </form>
  );
}

function FormEstado({ planMejoraId, estadoGuardado }: { planMejoraId: string; estadoGuardado: PlanMejoraVista["estadoGuardado"] }) {
  const [state, accion, pendiente] = useActionState(cambiarEstadoPlanMejoraAction, inicial);
  const [cerrando, setCerrando] = useState(false);
  // Tras cerrar, la revalidación trae estadoGuardado = CERRADO y este
  // formulario pasa solo a la rama de "Reabrir": no hace falta tocar `cerrando`.
  useEffect(() => {
    if (state.ok) toast.success("Estado actualizado.");
  }, [state]);

  if (estadoGuardado === "CERRADO") {
    return (
      <form action={accion} className="flex flex-wrap items-center justify-end gap-2">
        <input type="hidden" name="planMejoraId" value={planMejoraId} />
        <input type="hidden" name="estado" value="EN_CURSO" />
        <button type="submit" disabled={pendiente} className="ind-boton-secundario">
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Reabrir
        </button>
        {state.error && <p role="alert" className="ind-error basis-full">{state.error}</p>}
      </form>
    );
  }

  return (
    <form action={accion} className="form-premium grid gap-2">
      <input type="hidden" name="planMejoraId" value={planMejoraId} />
      <input type="hidden" name="estado" value={cerrando ? "CERRADO" : estadoGuardado === "ABIERTO" ? "EN_CURSO" : "ABIERTO"} />
      {cerrando && (
        <label className="grid gap-1">
          <span>Resultado o evidencia del cierre</span>
          <textarea name="cierreTexto" rows={3} required minLength={10} placeholder="Qué se logró y con qué evidencia se cierra." />
        </label>
      )}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {cerrando ? (
          <>
            <button type="button" className="ind-boton-secundario" onClick={() => setCerrando(false)}>
              Cancelar
            </button>
            <button type="submit" disabled={pendiente} className="ind-boton-primario">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              {pendiente ? "Cerrando…" : "Confirmar cierre"}
            </button>
          </>
        ) : (
          <>
            {estadoGuardado === "ABIERTO" && (
              <button type="submit" disabled={pendiente} className="ind-boton-secundario">
                Marcar en curso
              </button>
            )}
            <button type="button" className="ind-boton-secundario" onClick={() => setCerrando(true)} data-escritura>
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              Cerrar plan
            </button>
          </>
        )}
      </div>
      {state.error && <p role="alert" className="ind-error">{state.error}</p>}
    </form>
  );
}
