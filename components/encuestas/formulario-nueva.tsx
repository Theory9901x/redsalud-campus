"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useActionState } from "react";
import { Info, Loader2, Sparkles } from "lucide-react";
import { crearEncuestaAction, type EstadoAccion } from "@/app/encuestas/acciones-constructor";
import { ETIQUETA_AUDIENCIA } from "@/components/encuestas/tarjeta-encuesta";

const estadoInicial: EstadoAccion = { error: null };

/** Paleta de acentos propuesta; el color identifica la encuesta en el listado y su formulario. */
const ACENTOS = ["#6D3BF5", "#0EA5E9", "#0D9488", "#E11D48", "#EA580C", "#16A34A"];

const campo =
  "h-11 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none transition-colors focus:border-primary/60";

export type ActividadOpcion = {
  id: string;
  titulo: string;
  planId: string;
  areaId: string | null;
  plan: string;
};

/**
 * Adscripción en cascada Área › Plan › Capacitación: la misma trazabilidad
 * del resto del sistema. El área solo FILTRA; lo que se guarda es el plan
 * (encuesta del plan completo) o la capacitación (que define su plan).
 *
 * `modo="satisfaccion"` (tutor): la encuesta es la de satisfacción de UNA
 * capacitación de su área -obligatoria la capacitación, opcional la
 * encuesta- y el título se propone a partir de ella.
 */
export function FormularioNuevaEncuesta({
  areas,
  planes,
  actividades,
  plantillas,
  inicial,
  modo = "libre",
}: {
  areas: { id: string; nombre: string }[];
  planes: { id: string; titulo: string }[];
  actividades: ActividadOpcion[];
  plantillas: { id: string; titulo: string }[];
  /** Lugar preseleccionado al llegar desde un plan o una capacitación. */
  inicial?: { planId?: string; actividadId?: string };
  /** "satisfaccion": encuesta de satisfacción de una capacitación (tutor de área). */
  modo?: "libre" | "satisfaccion";
}) {
  const satisfaccion = modo === "satisfaccion";
  const [estado, accion, pendiente] = useActionState(crearEncuestaAction, estadoInicial);
  // Al llegar desde una capacitación se preselecciona su lugar: área › plan › capacitación.
  const actividadInicial = actividades.find((a) => a.id === inicial?.actividadId);
  const planInicial = actividadInicial?.planId ?? (planes.some((p) => p.id === inicial?.planId) ? inicial?.planId : undefined);
  const [areaId, setAreaId] = useState(actividadInicial?.areaId ?? "");
  const [planId, setPlanId] = useState(planInicial ?? "");
  const [actividadId, setActividadId] = useState(actividadInicial?.id ?? "");
  // En satisfacción el título se propone con la capacitación elegida, hasta
  // que la persona lo escriba a su gusto.
  const tituloPropuesto = (id: string) => {
    const a = actividades.find((x) => x.id === id);
    return a ? `Satisfacción de la capacitación · ${a.titulo}`.slice(0, 180) : "Satisfacción de la capacitación";
  };
  const [titulo, setTitulo] = useState(satisfaccion ? tituloPropuesto(actividadInicial?.id ?? "") : "");
  const [tituloEditado, setTituloEditado] = useState(false);

  // Planes visibles: los que tienen jornadas del área elegida.
  const planesFiltrados = useMemo(() => {
    if (!areaId) return planes;
    const conArea = new Set(actividades.filter((a) => a.areaId === areaId).map((a) => a.planId));
    return planes.filter((p) => conArea.has(p.id));
  }, [areaId, planes, actividades]);

  const actividadesFiltradas = useMemo(
    () =>
      actividades.filter(
        (a) => satisfaccion || ((!areaId || a.areaId === areaId) && (!planId || a.planId === planId))
      ),
    [areaId, planId, actividades, satisfaccion]
  );

  function elegirActividad(id: string) {
    setActividadId(id);
    // La capacitación define su plan: se refleja para que se VEA la cadena.
    const actividad = actividades.find((a) => a.id === id);
    if (actividad) setPlanId(actividad.planId);
    if (satisfaccion && !tituloEditado) setTitulo(tituloPropuesto(id));
  }

  return (
    <form action={accion} className="space-y-5">
      {satisfaccion && (
        <p className="flex items-start gap-2 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-[12.5px] leading-snug text-foreground/85">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span>
            <b className="font-semibold">Es opcional.</b> La encuesta de satisfacción se crea solo si el área así lo desea; la capacitación
            funciona igual sin ella. Queda adscrita a la capacitación que elijas.
          </span>
        </p>
      )}
      <div className="space-y-1.5">
        <label htmlFor="title" className="text-[13px] font-semibold text-foreground">
          Título <span className="text-destructive">*</span>
        </label>
        {satisfaccion ? (
          <input
            id="title"
            name="title"
            required
            minLength={5}
            value={titulo}
            onChange={(e) => {
              setTitulo(e.target.value);
              setTituloEditado(true);
            }}
            className={campo}
          />
        ) : (
          <input id="title" name="title" required minLength={5} placeholder="Encuesta de satisfacción de…" className={campo} />
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="description" className="text-[13px] font-semibold text-foreground">
          Descripción
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          placeholder={
            satisfaccion
              ? "Ej. Cuéntanos cómo te pareció la capacitación: tu opinión nos ayuda a mejorarla."
              : "Qué mide y a quién va dirigida (se muestra en la portada del formulario)."
          }
          className="w-full resize-y rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-primary/60"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="audience" className="text-[13px] font-semibold text-foreground">
            Audiencia
          </label>
          <select id="audience" name="audience" className={campo}>
            {Object.entries(ETIQUETA_AUDIENCIA).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>
                {etiqueta}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[13px] font-semibold text-foreground">Color de identidad</label>
          <div className="flex h-11 items-center gap-2">
            {ACENTOS.map((color, i) => (
              <label key={color} className="cursor-pointer">
                <input
                  type="radio"
                  name="themeColor"
                  value={color}
                  defaultChecked={i === 0}
                  className="peer sr-only"
                />
                <span
                  className="block h-8 w-8 rounded-full border-2 border-transparent transition-transform peer-checked:scale-110 peer-checked:border-foreground/60"
                  style={{ backgroundColor: color }}
                />
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Adscripción: área › plan › capacitación */}
      <fieldset className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
        <legend className="px-1 text-[13px] font-semibold text-foreground">
          {satisfaccion ? (
            <>
              Capacitación de tu área <span className="text-destructive">*</span>
            </>
          ) : (
            <>
              Adscripción <span className="font-normal text-muted-foreground">(opcional)</span>
            </>
          )}
        </legend>

        {satisfaccion ? (
          <>
            <input type="hidden" name="trainingPlanId" value={planId} />
            <p className="text-sm leading-relaxed text-muted-foreground">Elige una sola capacitación de tu área. Esta encuesta se aplicará únicamente a la capacitación seleccionada.</p>
          </>
        ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="areaFiltro" className="text-[12px] font-semibold text-muted-foreground">
              Área (para filtrar)
            </label>
            <select
              id="areaFiltro"
              value={areaId}
              onChange={(e) => {
                setAreaId(e.target.value);
                setPlanId("");
                setActividadId("");
              }}
              className={campo}
            >
              <option value="">{satisfaccion ? "Todas mis áreas" : "Todas las áreas"}</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="trainingPlanId" className="text-[12px] font-semibold text-muted-foreground">
              Plan de capacitación
            </label>
            <select
              id="trainingPlanId"
              name="trainingPlanId"
              value={planId}
              onChange={(e) => {
                setPlanId(e.target.value);
                setActividadId("");
              }}
              className={campo}
            >
              <option value="">{satisfaccion ? "Todos los planes" : "Sin plan (institucional)"}</option>
              {planesFiltrados.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.titulo}
                </option>
              ))}
            </select>
          </div>
        </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="trainingActivityId" className="text-[12px] font-semibold text-muted-foreground">
            Capacitación concreta
          </label>
          <select
            id="trainingActivityId"
            name="trainingActivityId"
            value={actividadId}
            onChange={(e) => elegirActividad(e.target.value)}
            required={satisfaccion}
            disabled={satisfaccion && actividades.length === 0}
            className={campo}
          >
            <option value="" disabled={satisfaccion}>
              {satisfaccion ? "Elige la capacitación" : planId ? "Todo el plan (sin jornada concreta)" : "Ninguna"}
            </option>
            {actividadesFiltradas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.titulo} · {a.plan}
              </option>
            ))}
          </select>
          {satisfaccion && actividades.length === 0 && <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3 text-sm"><p>Tu área aún no tiene capacitaciones disponibles. Crea una capacitación propia para poder asignarle la encuesta.</p><Link href="/tutor/capacitaciones/nueva" className="inline-flex min-h-10 items-center font-semibold text-primary hover:underline">Crear capacitación de mi área →</Link></div>}
          <p className="text-[11.5px] leading-snug text-muted-foreground">
            {satisfaccion
              ? "Los resultados se consultan en Encuestas, adscritos a esa capacitación como su medición de satisfacción."
              : "Con capacitación, los resultados alimentan la medición de esa jornada; solo con plan, la del plan completo; sin ninguno, queda como encuesta institucional suelta."}
          </p>
        </div>
      </fieldset>

      {plantillas.length > 0 && (
        <div className="space-y-1.5">
          <label htmlFor="plantillaId" className="text-[13px] font-semibold text-foreground">
            Partir de una plantilla <span className="font-normal text-muted-foreground">(opcional)</span>
          </label>
          <select id="plantillaId" name="plantillaId" className={campo}>
            <option value="">Empezar en blanco</option>
            {plantillas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.titulo}
              </option>
            ))}
          </select>
        </div>
      )}

      {estado.error && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          {estado.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pendiente || (satisfaccion && !actividadId)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-success px-5 py-3.5 text-[14px] font-bold text-white shadow-lg shadow-primary/25 transition-transform hover:translate-y-[-1px] disabled:opacity-60"
      >
        {pendiente ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {pendiente ? "Creando…" : "Crear y abrir el constructor"}
      </button>
    </form>
  );
}
