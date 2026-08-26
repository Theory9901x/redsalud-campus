"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { admiteClave, esTipoDeOpcion, leerConfig, ETIQUETA_TIPO, type ConfigPregunta } from "@/lib/encuestas/tipos";
import { SURVEY_QUESTION_TYPE_ICONS } from "@/components/training-plans/survey-labels";
import { actualizarPreguntaAction, crearPreguntaAction, type DatosPregunta } from "@/app/encuestas/acciones-constructor";
import type { SurveyQuestionType } from "@prisma/client";

const TIPOS: SurveyQuestionType[] = [
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "YES_NO",
  "SCALE",
  "SHORT_TEXT",
  "LONG_TEXT",
  "NUMBER",
  "DATE",
  "IMAGE_CHOICE",
  "MATCHING",
];

const campo =
  "w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-primary/60";

let contadorId = 0;
function idLocal() {
  return `op-${Date.now().toString(36)}-${contadorId++}`;
}

/**
 * EDITOR de una pregunta, en un panel lateral: tipo, enunciado, opciones
 * dinámicas y -para los tipos que lo admiten- la clave de respuesta con su
 * puntaje, que es lo que convierte la encuesta en evaluación calificada.
 */
export function EditorPregunta({
  encuestaId,
  bloqueId,
  pregunta,
  acento,
  onCerrar,
}: {
  encuestaId: string;
  bloqueId: string;
  pregunta: {
    id: string;
    type: SurveyQuestionType;
    prompt: string;
    description: string | null;
    imageUrl: string | null;
    isRequired: boolean;
    config: unknown;
  } | null;
  acento: string;
  onCerrar: () => void;
}) {
  const inicial = pregunta ? leerConfig(pregunta.config) : {};
  const [tipo, setTipo] = useState<SurveyQuestionType>(pregunta?.type ?? "SINGLE_CHOICE");
  const [enunciado, setEnunciado] = useState(pregunta?.prompt ?? "");
  const [descripcion, setDescripcion] = useState(pregunta?.description ?? "");
  const [obligatoria, setObligatoria] = useState(pregunta?.isRequired ?? true);
  const [opciones, setOpciones] = useState(
    inicial.opciones ?? [
      { id: idLocal(), texto: "" },
      { id: idLocal(), texto: "" },
    ]
  );
  const [grupos, setGrupos] = useState(inicial.grupos ?? []);
  const [escalaMin, setEscalaMin] = useState(inicial.escalaMin ?? 1);
  const [escalaMax, setEscalaMax] = useState(inicial.escalaMax ?? 5);
  const [escalaEstilo, setEscalaEstilo] = useState<"numeros" | "estrellas">(inicial.escalaEstilo ?? "numeros");
  const [etiquetaMin, setEtiquetaMin] = useState(inicial.etiquetaMin ?? "");
  const [etiquetaMax, setEtiquetaMax] = useState(inicial.etiquetaMax ?? "");
  const [clave, setClave] = useState(inicial.opcionCorrectaId ?? "");
  const [puntos, setPuntos] = useState(inicial.puntos ?? 2);
  const [error, setError] = useState<string | null>(null);
  const [guardando, startTransition] = useTransition();

  function armarConfig(): ConfigPregunta {
    const config: ConfigPregunta = {};
    if (esTipoDeOpcion(tipo) && tipo !== "YES_NO") config.opciones = opciones.filter((o) => o.texto.trim());
    if (tipo === "MATCHING") {
      config.opciones = opciones.filter((o) => o.texto.trim());
      config.grupos = grupos.filter((g) => g.titulo.trim());
    }
    if (tipo === "SCALE") {
      config.escalaMin = escalaMin;
      config.escalaMax = escalaMax;
      config.escalaEstilo = escalaEstilo;
      if (etiquetaMin.trim()) config.etiquetaMin = etiquetaMin.trim();
      if (etiquetaMax.trim()) config.etiquetaMax = etiquetaMax.trim();
    }
    if (admiteClave(tipo) && clave) {
      config.opcionCorrectaId = clave;
      config.puntos = puntos;
    }
    return config;
  }

  function guardar() {
    const datos: DatosPregunta = {
      type: tipo,
      prompt: enunciado,
      description: descripcion || null,
      isRequired: obligatoria,
      config: armarConfig(),
    };
    startTransition(async () => {
      const r = pregunta
        ? await actualizarPreguntaAction(encuestaId, pregunta.id, datos)
        : await crearPreguntaAction(encuestaId, bloqueId, datos);
      if (r.error) setError(r.error);
      else onCerrar();
    });
  }

  const opcionesDeClave =
    tipo === "YES_NO" && !opciones.some((o) => o.texto.trim())
      ? [
          { id: "si", texto: "Sí" },
          { id: "no", texto: "No" },
        ]
      : opciones.filter((o) => o.texto.trim());

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-navy/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={pregunta ? "Editar pregunta" : "Nueva pregunta"}
      onClick={onCerrar}
    >
      <div
        className="h-full w-full max-w-xl overflow-y-auto border-l border-border/60 bg-background p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-extrabold tracking-tight text-foreground">
            {pregunta ? "Editar pregunta" : "Nueva pregunta"}
          </h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tipo */}
        <div className="mt-5">
          <p className="text-[12.5px] font-semibold text-foreground">Tipo de pregunta</p>
          <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {TIPOS.map((t) => {
              const Icono = SURVEY_QUESTION_TYPE_ICONS[t];
              const activo = tipo === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-[12px] font-semibold transition-all",
                    activo ? "border-transparent text-white" : "border-border/60 bg-card/60 text-foreground/80 hover:border-foreground/25"
                  )}
                  style={activo ? { backgroundColor: acento } : undefined}
                >
                  <Icono className="h-4 w-4 shrink-0" />
                  {ETIQUETA_TIPO[t]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="enunciado" className="text-[12.5px] font-semibold text-foreground">
              Enunciado <span className="text-destructive">*</span>
            </label>
            <textarea id="enunciado" rows={2} value={enunciado} onChange={(e) => setEnunciado(e.target.value)} className={cn(campo, "resize-y")} />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="descripcion" className="text-[12.5px] font-semibold text-foreground">
              Ayuda para quien responde
            </label>
            <input id="descripcion" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className={campo} />
          </div>

          {/* Opciones */}
          {(esTipoDeOpcion(tipo) || tipo === "MATCHING") && tipo !== "YES_NO" && (
            <ListaEditable
              titulo={tipo === "MATCHING" ? "Elementos para relacionar" : "Opciones"}
              items={opciones.map((o) => ({ id: o.id, texto: o.texto }))}
              onCambiar={(items) => setOpciones(items.map((i) => ({ id: i.id, texto: i.texto })))}
              acento={acento}
            />
          )}

          {tipo === "MATCHING" && (
            <ListaEditable
              titulo="Grupos de destino"
              items={grupos.map((g) => ({ id: g.id, texto: g.titulo }))}
              onCambiar={(items) => setGrupos(items.map((i) => ({ id: i.id, titulo: i.texto })))}
              acento={acento}
            />
          )}

          {tipo === "SCALE" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <label className="text-[12.5px] font-semibold text-foreground">Presentación</label>
                <div className="flex gap-2">
                  {([
                    { valor: "numeros", etiqueta: "Números" },
                    { valor: "estrellas", etiqueta: "Estrellas" },
                  ] as const).map((o) => (
                    <button
                      key={o.valor}
                      type="button"
                      onClick={() => setEscalaEstilo(o.valor)}
                      className={cn(
                        "rounded-xl border px-4 py-2 text-[12.5px] font-semibold transition-colors",
                        escalaEstilo === o.valor
                          ? "border-primary/50 bg-primary/10 text-primary"
                          : "border-border/60 bg-card/70 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {o.etiqueta}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[12.5px] font-semibold text-foreground">Rango</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={escalaMin}
                    onChange={(e) => setEscalaMin(Number(e.target.value))}
                    aria-label="Mínimo de la escala"
                    className={cn(campo, "w-20")}
                  />
                  <span className="text-muted-foreground">a</span>
                  <input
                    type="number"
                    value={escalaMax}
                    onChange={(e) => setEscalaMax(Number(e.target.value))}
                    aria-label="Máximo de la escala"
                    className={cn(campo, "w-20")}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[12.5px] font-semibold text-foreground">Etiquetas de extremos</label>
                <div className="space-y-1.5">
                  <input value={etiquetaMin} onChange={(e) => setEtiquetaMin(e.target.value)} placeholder="Muy insatisfecho" className={campo} />
                  <input value={etiquetaMax} onChange={(e) => setEtiquetaMax(e.target.value)} placeholder="Muy satisfecho" className={campo} />
                </div>
              </div>
            </div>
          )}

          {/* Clave de respuesta */}
          {admiteClave(tipo) && (
            <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
              <p className="text-[12.5px] font-bold text-foreground">Clave de respuesta (opcional)</p>
              <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">
                Al marcarla, la pregunta califica y suma al puntaje. Sin clave, es solo de opinión.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <select value={clave} onChange={(e) => setClave(e.target.value)} aria-label="Opción correcta" className={cn(campo, "max-w-[260px]")}>
                  <option value="">Sin clave (no califica)</option>
                  {opcionesDeClave.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.texto}
                    </option>
                  ))}
                </select>
                {clave && (
                  <label className="flex items-center gap-2 text-[12.5px] font-semibold text-foreground">
                    Puntos
                    <input
                      type="number"
                      min={1}
                      value={puntos}
                      onChange={(e) => setPuntos(Number(e.target.value))}
                      className={cn(campo, "w-20")}
                    />
                  </label>
                )}
              </div>
            </div>
          )}

          <label className="flex cursor-pointer items-center gap-2.5 text-[13px] font-semibold text-foreground">
            <input
              type="checkbox"
              checked={obligatoria}
              onChange={(e) => setObligatoria(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            Obligatoria
          </label>
        </div>

        {error && (
          <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
            {error}
          </p>
        )}

        <div className="mt-6 flex items-center justify-end gap-2 border-t border-border/60 pt-4">
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-xl border border-border/60 px-4 py-2.5 text-[13px] font-semibold text-muted-foreground"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={guardando}
            onClick={guardar}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-bold text-white disabled:opacity-60"
            style={{ backgroundColor: acento }}
          >
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Guardar pregunta
          </button>
        </div>
      </div>
    </div>
  );
}

function ListaEditable({
  titulo,
  items,
  onCambiar,
  acento,
}: {
  titulo: string;
  items: { id: string; texto: string }[];
  onCambiar: (items: { id: string; texto: string }[]) => void;
  acento: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[12.5px] font-semibold text-foreground">{titulo}</p>
      {items.map((item, i) => (
        <div key={item.id} className="flex items-center gap-2">
          <span className="w-5 text-right text-[12px] font-bold text-muted-foreground">{i + 1}.</span>
          <input
            value={item.texto}
            onChange={(e) => onCambiar(items.map((x) => (x.id === item.id ? { ...x, texto: e.target.value } : x)))}
            aria-label={`${titulo} ${i + 1}`}
            className={campo}
          />
          {items.length > 2 && (
            <button
              type="button"
              onClick={() => onCambiar(items.filter((x) => x.id !== item.id))}
              aria-label="Quitar"
              className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => onCambiar([...items, { id: idLocal(), texto: "" }])}
        className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold"
        style={{ color: acento }}
      >
        <Plus className="h-3.5 w-3.5" />
        Agregar
      </button>
    </div>
  );
}
