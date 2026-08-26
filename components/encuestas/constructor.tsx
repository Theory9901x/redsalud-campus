"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Rocket,
  Settings2,
  Square,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { leerConfig, ETIQUETA_TIPO, type ConfigPregunta } from "@/lib/encuestas/tipos";
import { SURVEY_QUESTION_TYPE_ICONS } from "@/components/training-plans/survey-labels";
import { EditorPregunta } from "@/components/encuestas/editor-pregunta";
import { BotonEnlacePublico } from "@/components/encuestas/boton-enlace-publico";
import { ETIQUETA_ESTADO } from "@/components/encuestas/tarjeta-encuesta";
import {
  actualizarBloqueAction,
  actualizarEncuestaAction,
  cambiarEstadoEncuestaAction,
  crearBloqueAction,
  eliminarBloqueAction,
  eliminarEncuestaAction,
  eliminarPreguntaAction,
  moverPreguntaAction,
} from "@/app/encuestas/acciones-constructor";
import type { SurveyQuestionType, SurveyStatus } from "@prisma/client";

type PreguntaData = {
  id: string;
  type: SurveyQuestionType;
  prompt: string;
  description: string | null;
  imageUrl: string | null;
  isRequired: boolean;
  config: unknown;
};

type BloqueData = {
  id: string;
  title: string;
  description: string | null;
  attachmentUrl: string | null;
  attachmentName: string | null;
  questions: PreguntaData[];
};

export type EncuestaConstructor = {
  id: string;
  code: string;
  slug: string;
  title: string;
  description: string | null;
  themeColor: string | null;
  status: SurveyStatus;
  showScoreToRespondent: boolean;
  requireLogin: boolean;
  allowMultipleResponses: boolean;
  estimatedMinutes: number | null;
  thankYouMessage: string | null;
  pages: BloqueData[];
  trainingActivity: { id: string; title: string } | null;
  trainingPlan: { id: string; title: string } | null;
  _count: { responses: number };
};

export type OpcionesAdscripcion = {
  planes: { id: string; titulo: string }[];
  actividades: { id: string; titulo: string; planId: string; plan: string }[];
};

/**
 * El CONSTRUCTOR: los bloques a la izquierda del flujo de trabajo, cada uno
 * con sus preguntas, su material y su edición en línea. La vista previa
 * real es el propio enlace público -no una imitación que luego difiera-.
 */
export function Constructor({
  encuesta,
  adscripcion,
}: {
  encuesta: EncuestaConstructor;
  adscripcion: OpcionesAdscripcion;
}) {
  const router = useRouter();
  const [ocupado, startTransition] = useTransition();
  const [editando, setEditando] = useState<{ bloqueId: string; pregunta: PreguntaData | null } | null>(null);
  const [ajustesAbiertos, setAjustesAbiertos] = useState(false);

  const acento = encuesta.themeColor || "#6D3BF5";
  const totalPreguntas = encuesta.pages.reduce((s, p) => s + p.questions.length, 0);

  function correr(fn: () => Promise<{ error: string | null }>) {
    startTransition(async () => {
      const r = await fn();
      if (r?.error) toast.error(r.error);
      router.refresh();
    });
  }

  return (
    <div className="mt-5 space-y-5">
      {/* Cabecera de trabajo */}
      <header className="surface-vivo">
        <div className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: acento }}>
                Constructor · {encuesta.code}
              </p>
              <TituloEditable encuesta={encuesta} onGuardar={correr} />
              {encuesta.trainingActivity && (
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  Capacitación: <span className="font-semibold text-foreground">{encuesta.trainingActivity.title}</span>
                </p>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-bold",
                  encuesta.status === "PUBLISHED"
                    ? "border-success/40 bg-success/10 text-success"
                    : "border-border/60 bg-card/60 text-muted-foreground"
                )}
              >
                <span
                  className={cn("h-1.5 w-1.5 rounded-full", encuesta.status === "PUBLISHED" ? "bg-success" : "bg-muted-foreground/50")}
                />
                {ETIQUETA_ESTADO[encuesta.status]}
              </span>

              {encuesta.status !== "DRAFT" && (
                <BotonEnlacePublico slug={encuesta.slug} titulo={encuesta.title} acento={acento} />
              )}

              <button
                type="button"
                onClick={() => setAjustesAbiertos((v) => !v)}
                title="Ajustes"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-card/70 text-muted-foreground transition-colors hover:text-foreground"
              >
                <Settings2 className="h-4 w-4" />
              </button>

              {encuesta.status === "DRAFT" ? (
                <button
                  type="button"
                  disabled={ocupado || totalPreguntas === 0}
                  onClick={() => correr(() => cambiarEstadoEncuestaAction(encuesta.id, "PUBLISHED"))}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold text-white shadow-md transition-transform hover:translate-y-[-1px] disabled:opacity-50"
                  style={{ backgroundColor: acento }}
                >
                  {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                  Publicar
                </button>
              ) : encuesta.status === "PUBLISHED" ? (
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => correr(() => cambiarEstadoEncuestaAction(encuesta.id, "CLOSED"))}
                  className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-card/70 px-4 py-2.5 text-[13px] font-bold text-foreground"
                >
                  <Square className="h-3.5 w-3.5" />
                  Cerrar
                </button>
              ) : (
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => correr(() => cambiarEstadoEncuestaAction(encuesta.id, "PUBLISHED"))}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold text-white"
                  style={{ backgroundColor: acento }}
                >
                  <Rocket className="h-4 w-4" />
                  Reabrir
                </button>
              )}
            </div>
          </div>

          {ajustesAbiertos && <PanelAjustes encuesta={encuesta} adscripcion={adscripcion} onGuardar={correr} />}
        </div>
      </header>

      {/* Bloques */}
      {encuesta.pages.map((bloque, indice) => (
        <section key={bloque.id} className="surface-lumen overflow-hidden">
          <BloqueCabecera
            encuestaId={encuesta.id}
            bloque={bloque}
            indice={indice}
            total={encuesta.pages.length}
            acento={acento}
            onGuardar={correr}
          />

          <div className="space-y-2 px-5 pb-5">
            {bloque.questions.length === 0 && (
              <p className="rounded-xl border border-dashed border-border/70 px-4 py-6 text-center text-[13px] text-muted-foreground">
                Este bloque no tiene preguntas todavía.
              </p>
            )}
            {bloque.questions.map((pregunta, i) => {
              const Icono = SURVEY_QUESTION_TYPE_ICONS[pregunta.type];
              const config = leerConfig(pregunta.config);
              return (
                <div
                  key={pregunta.id}
                  className="group flex items-start gap-3 rounded-xl border border-border/50 bg-card/60 px-4 py-3 transition-colors hover:border-border"
                >
                  <span
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${acento}1a`, color: acento }}
                  >
                    <Icono className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-semibold leading-snug text-foreground">
                      {i + 1}. {pregunta.prompt}
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                      {ETIQUETA_TIPO[pregunta.type]}
                      {pregunta.isRequired && " · obligatoria"}
                      {config.opcionCorrectaId && (
                        <span className="font-semibold" style={{ color: acento }}>
                          {" "}· califica ({config.puntos ?? 0} pts)
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <BotonIcono
                      titulo="Subir"
                      onClick={() => correr(() => moverPreguntaAction(encuesta.id, pregunta.id, "arriba"))}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </BotonIcono>
                    <BotonIcono
                      titulo="Bajar"
                      onClick={() => correr(() => moverPreguntaAction(encuesta.id, pregunta.id, "abajo"))}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </BotonIcono>
                    <BotonIcono titulo="Editar" onClick={() => setEditando({ bloqueId: bloque.id, pregunta })}>
                      <Pencil className="h-3.5 w-3.5" />
                    </BotonIcono>
                    <BotonIcono
                      titulo="Eliminar"
                      destructivo
                      onClick={() => correr(() => eliminarPreguntaAction(encuesta.id, pregunta.id))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </BotonIcono>
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              onClick={() => setEditando({ bloqueId: bloque.id, pregunta: null })}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed py-3 text-[13px] font-semibold transition-colors"
              style={{ borderColor: `${acento}66`, color: acento }}
            >
              <Plus className="h-4 w-4" />
              Agregar pregunta
            </button>
          </div>
        </section>
      ))}

      <div className="flex items-center justify-between">
        <button
          type="button"
          disabled={ocupado}
          onClick={() => correr(() => crearBloqueAction(encuesta.id))}
          className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-card/70 px-4 py-2.5 text-[13px] font-bold text-foreground transition-colors hover:border-primary/40"
        >
          <Plus className="h-4 w-4 text-primary" />
          Nuevo bloque
        </button>

        {encuesta._count.responses === 0 && (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => {
              if (confirm("¿Eliminar esta encuesta por completo?")) {
                correr(() => eliminarEncuestaAction(encuesta.id));
              }
            }}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-destructive/80 transition-colors hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Eliminar encuesta
          </button>
        )}
      </div>

      {editando && (
        <EditorPregunta
          encuestaId={encuesta.id}
          bloqueId={editando.bloqueId}
          pregunta={editando.pregunta}
          acento={acento}
          onCerrar={() => {
            setEditando(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function BotonIcono({
  titulo,
  onClick,
  destructivo,
  children,
}: {
  titulo: string;
  onClick: () => void;
  destructivo?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
        destructivo
          ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
      )}
    >
      {children}
    </button>
  );
}

function TituloEditable({
  encuesta,
  onGuardar,
}: {
  encuesta: EncuestaConstructor;
  onGuardar: (fn: () => Promise<{ error: string | null }>) => void;
}) {
  const [texto, setTexto] = useState(encuesta.title);
  return (
    <input
      value={texto}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={() => {
        if (texto.trim() !== encuesta.title && texto.trim().length >= 5) {
          onGuardar(() => actualizarEncuestaAction(encuesta.id, { title: texto }));
        }
      }}
      aria-label="Título de la encuesta"
      className="mt-1 w-full max-w-xl bg-transparent font-display text-2xl font-extrabold tracking-tight text-foreground outline-none focus:border-b focus:border-primary/50"
    />
  );
}

function BloqueCabecera({
  encuestaId,
  bloque,
  indice,
  total,
  acento,
  onGuardar,
}: {
  encuestaId: string;
  bloque: BloqueData;
  indice: number;
  total: number;
  acento: string;
  onGuardar: (fn: () => Promise<{ error: string | null }>) => void;
}) {
  const [titulo, setTitulo] = useState(bloque.title);
  const [adjunto, setAdjunto] = useState(false);
  const [urlAdjunto, setUrlAdjunto] = useState(bloque.attachmentUrl ?? "");
  const [nombreAdjunto, setNombreAdjunto] = useState(bloque.attachmentName ?? "");

  return (
    <div className="border-b border-border/50 px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[12px] font-extrabold text-white"
            style={{ backgroundColor: acento }}
          >
            {indice + 1}
          </span>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            onBlur={() => {
              if (titulo.trim() !== bloque.title) {
                onGuardar(() => actualizarBloqueAction(encuestaId, bloque.id, { title: titulo }));
              }
            }}
            aria-label={`Título del bloque ${indice + 1}`}
            className="w-full min-w-0 bg-transparent font-display text-[15px] font-bold text-foreground outline-none"
          />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setAdjunto((v) => !v)}
            title="Material del bloque"
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-semibold transition-colors",
              bloque.attachmentUrl ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
            style={bloque.attachmentUrl ? { color: acento } : undefined}
          >
            <FileText className="h-3.5 w-3.5" />
            {bloque.attachmentUrl ? "Material" : "Sin material"}
            <ChevronDown className={cn("h-3 w-3 transition-transform", adjunto && "rotate-180")} />
          </button>
          {total > 1 && (
            <BotonIcono
              titulo="Eliminar bloque"
              destructivo
              onClick={() => {
                if (confirm(`¿Eliminar el bloque «${bloque.title}» con sus preguntas?`)) {
                  onGuardar(() => eliminarBloqueAction(encuestaId, bloque.id));
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </BotonIcono>
          )}
        </div>
      </div>

      {adjunto && (
        <div className="mt-3 grid grid-cols-1 gap-2 rounded-xl border border-border/50 bg-muted/30 p-3 sm:grid-cols-[1fr_220px_auto]">
          <input
            value={urlAdjunto}
            onChange={(e) => setUrlAdjunto(e.target.value)}
            placeholder="URL del material (PDF o presentación, p. ej. /api/media/…)"
            className="h-9 rounded-lg border border-input bg-background px-3 text-[12.5px] outline-none"
          />
          <input
            value={nombreAdjunto}
            onChange={(e) => setNombreAdjunto(e.target.value)}
            placeholder="Nombre visible"
            className="h-9 rounded-lg border border-input bg-background px-3 text-[12.5px] outline-none"
          />
          <button
            type="button"
            onClick={() =>
              onGuardar(() =>
                actualizarBloqueAction(encuestaId, bloque.id, {
                  attachmentUrl: urlAdjunto.trim() || null,
                  attachmentName: nombreAdjunto.trim() || null,
                })
              )
            }
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-bold text-white"
            style={{ backgroundColor: acento }}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Guardar
          </button>
          <p className="text-[11px] leading-snug text-muted-foreground sm:col-span-3">
            El material se muestra embebido dentro del bloque: quien responde lee la guía sin salir del formulario.
          </p>
        </div>
      )}
    </div>
  );
}

function PanelAjustes({
  encuesta,
  adscripcion,
  onGuardar,
}: {
  encuesta: EncuestaConstructor;
  adscripcion: OpcionesAdscripcion;
  onGuardar: (fn: () => Promise<{ error: string | null }>) => void;
}) {
  const [minutos, setMinutos] = useState(encuesta.estimatedMinutes?.toString() ?? "");
  const [gracias, setGracias] = useState(encuesta.thankYouMessage ?? "");
  const [planId, setPlanId] = useState(encuesta.trainingPlan?.id ?? "");
  const [actividadId, setActividadId] = useState(encuesta.trainingActivity?.id ?? "");

  const actividadesDelPlan = planId
    ? adscripcion.actividades.filter((a) => a.planId === planId)
    : adscripcion.actividades;

  function guardarAdscripcion(nuevoPlan: string, nuevaActividad: string) {
    setPlanId(nuevoPlan);
    setActividadId(nuevaActividad);
    onGuardar(() =>
      actualizarEncuestaAction(encuesta.id, {
        trainingPlanId: nuevoPlan || null,
        trainingActivityId: nuevaActividad || null,
      })
    );
  }

  const opciones: { clave: "requireLogin" | "allowMultipleResponses" | "showScoreToRespondent"; titulo: string; detalle: string; valor: boolean }[] = [
    {
      clave: "requireLogin",
      titulo: "Exigir sesión iniciada",
      detalle: "Solo personal con cuenta puede responder, aunque el enlace sea público.",
      valor: encuesta.requireLogin,
    },
    {
      clave: "allowMultipleResponses",
      titulo: "Permitir varias respuestas",
      detalle: "La misma persona puede responder más de una vez.",
      valor: encuesta.allowMultipleResponses,
    },
    {
      clave: "showScoreToRespondent",
      titulo: "Mostrar el puntaje al terminar",
      detalle: "Para evaluaciones de conocimiento con clave de respuesta.",
      valor: encuesta.showScoreToRespondent,
    },
  ];

  return (
    <div className="mt-5 grid grid-cols-1 gap-4 border-t border-border/50 pt-5 lg:grid-cols-2">
      <div className="space-y-2.5">
        {opciones.map((o) => (
          <label
            key={o.clave}
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/50 bg-card/50 px-4 py-3"
          >
            <input
              type="checkbox"
              defaultChecked={o.valor}
              onChange={(e) => onGuardar(() => actualizarEncuestaAction(encuesta.id, { [o.clave]: e.target.checked }))}
              className="mt-0.5 h-4 w-4 rounded border-input"
            />
            <span>
              <span className="block text-[13px] font-semibold text-foreground">{o.titulo}</span>
              <span className="block text-[11.5px] leading-snug text-muted-foreground">{o.detalle}</span>
            </span>
          </label>
        ))}
      </div>

      <div className="space-y-3">
        {/* Trazabilidad: plan y capacitación, alineado con el resto del sistema */}
        <div className="grid grid-cols-1 gap-3">
          <div className="space-y-1">
            <label htmlFor="ads-plan" className="text-[12.5px] font-semibold text-foreground">
              Plan de capacitación
            </label>
            <select
              id="ads-plan"
              value={planId}
              onChange={(e) => guardarAdscripcion(e.target.value, "")}
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none"
            >
              <option value="">Sin plan (institucional)</option>
              {adscripcion.planes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.titulo}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="ads-actividad" className="text-[12.5px] font-semibold text-foreground">
              Capacitación concreta
            </label>
            <select
              id="ads-actividad"
              value={actividadId}
              onChange={(e) => {
                const id = e.target.value;
                const actividad = adscripcion.actividades.find((a) => a.id === id);
                guardarAdscripcion(actividad ? actividad.planId : planId, id);
              }}
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none"
            >
              <option value="">{planId ? "Todo el plan (sin jornada concreta)" : "Ninguna"}</option>
              {actividadesDelPlan.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.titulo} · {a.plan}
                </option>
              ))}
            </select>
            <p className="text-[11px] leading-snug text-muted-foreground">
              Sus resultados alimentan la medición de lo que elijas aquí.
            </p>
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="minutos" className="text-[12.5px] font-semibold text-foreground">
            Duración estimada (minutos)
          </label>
          <input
            id="minutos"
            type="number"
            min={1}
            value={minutos}
            onChange={(e) => setMinutos(e.target.value)}
            onBlur={() =>
              onGuardar(() =>
                actualizarEncuestaAction(encuesta.id, { estimatedMinutes: minutos ? Number(minutos) : null })
              )
            }
            className="h-10 w-32 rounded-xl border border-input bg-background px-3 text-sm outline-none"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="gracias" className="text-[12.5px] font-semibold text-foreground">
            Mensaje de agradecimiento
          </label>
          <textarea
            id="gracias"
            rows={3}
            value={gracias}
            onChange={(e) => setGracias(e.target.value)}
            onBlur={() => onGuardar(() => actualizarEncuestaAction(encuesta.id, { thankYouMessage: gracias || null }))}
            placeholder="Se muestra al enviar la respuesta."
            className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none"
          />
        </div>
      </div>
    </div>
  );
}
