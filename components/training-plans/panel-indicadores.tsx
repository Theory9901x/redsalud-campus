"use client";

import { MotionConfig, motion } from "framer-motion";
import { TrendingUp, Layers, Users2, type LucideIcon } from "lucide-react";
import type { PlanIndicadores, Indicadores } from "@/lib/plan-indicadores";
import { semaforo, UMBRAL_VERDE, UMBRAL_AMARILLO, type Semaforo } from "@/lib/semaforo-indicadores";
import { cn } from "@/lib/utils";

const ROMANO = ["I", "II", "III", "IV"];

const TEXTO_SEMAFORO: Record<Semaforo, string> = {
  verde: "text-success",
  amarillo: "text-warning-foreground",
  rojo: "text-destructive",
  "sin-datos": "text-muted-foreground",
};

const PUNTO_SEMAFORO: Record<Semaforo, string> = {
  verde: "bg-success",
  amarillo: "bg-warning",
  rojo: "bg-destructive",
  "sin-datos": "bg-muted-foreground/40",
};

const GLOW: Record<Semaforo, string> = {
  verde: "glow-exito",
  amarillo: "glow-alerta",
  rojo: "glow-critico",
  "sin-datos": "",
};

const VEREDICTO: Record<Semaforo, string> = {
  verde: "Cumple",
  amarillo: "En alerta",
  rojo: "Crítico",
  "sin-datos": "Sin datos",
};

/** Una fila de la tabla de mediciones de una ficha. */
type Medicion = {
  corte: string;
  celdas: string[];
  valor: number | null;
  formatearValor: (v: number) => string;
};

type Ficha = {
  codigo: string;
  nombre: string;
  principal: boolean;
  Icono: LucideIcon;
  /** Valor del acumulado del año, ya formateado, y su semáforo. */
  valorGrande: string;
  sem: Semaforo;
  resumen: string;
  ficha: { campo: string; contenido: string }[];
  columnasMedicion: string[];
  mediciones: Medicion[];
  analisis: string;
};

function filaMediciones(
  datos: PlanIndicadores,
  extraer: (i: Indicadores) => { celdas: string[]; valor: number | null },
  formatearValor: (v: number) => string
): Medicion[] {
  const filas: Medicion[] = datos.porTrimestre.map((t) => ({
    corte: `Trimestre ${ROMANO[t.trimestre - 1]}`,
    ...extraer(t.indicadores),
    formatearValor,
  }));
  filas.push({ corte: "Acumulado año", ...extraer(datos.anual), formatearValor });
  return filas;
}

function construirFichas(datos: PlanIndicadores): Ficha[] {
  const a = datos.anual;

  const adherenciaAnalisis =
    a.adherencia.valor === null
      ? "Aún no hay personas con el ciclo presaber–postsaber completo en jornadas cerradas, así que el indicador no tiene línea base. Se poblará solo, a medida que las áreas cierren sus jornadas con evaluación presentada."
      : a.adherencia.valor > 0
        ? `El personal que completó el ciclo mejoró en promedio ${a.adherencia.valor} puntos porcentuales entre el presaber y el postsaber (${a.adherencia.personas} ${a.adherencia.personas === 1 ? "persona" : "personas"} en ${a.adherencia.actividadesCerradas} ${a.adherencia.actividadesCerradas === 1 ? "jornada cerrada" : "jornadas cerradas"}). ${semaforo(a.adherencia.valor) === "verde" ? "El resultado cumple la meta institucional." : "El resultado está por debajo de la meta: revisar en la desagregación por área dónde está la menor mejora."}`
        : `El promedio de variación es ${a.adherencia.valor} pp: el personal no está mejorando entre presaber y postsaber. Revisar el contenido y la metodología de las jornadas cerradas.`;

  const sinContenido = a.cobertura.total - a.cobertura.conContenido;
  const areasSinContenido = datos.porArea.filter((ar) => ar.cobertura.valor === 0 && ar.cobertura.total > 0);
  const coberturaAnalisis =
    `${a.cobertura.conContenido} de ${a.cobertura.total} líneas del PIC tienen curso montado (${a.cobertura.valor}%). ` +
    (sinContenido === 0
      ? "Todo el plan tiene contenido publicado."
      : `Faltan ${sinContenido} líneas por montar${areasSinContenido.length > 0 ? `; las áreas sin ningún contenido son: ${areasSinContenido.map((x) => x.areaNombre).join(", ")}` : ""}.`);

  const asistenciaAnalisis =
    a.asistencia.asistentes === 0
      ? "Todavía no hay registros de asistencia. El registro es automático: se llena solo cuando el personal entra a la sala o presenta su evaluación, o cuando el área lo marca manualmente."
      : `Se registran ${a.asistencia.asistentes} asistencias sobre ${a.asistencia.audiencia} convocatorias (${a.asistencia.valor}%). El denominador cuenta convocatorias —pares persona × capacitación—, no personas distintas: la misma persona está convocada a varias líneas.`;

  return [
    {
      codigo: "PIC-ADH-01",
      nombre: "Adherencia institucional del conocimiento",
      principal: true,
      Icono: TrendingUp,
      valorGrande:
        a.adherencia.valor === null ? "—" : `${a.adherencia.valor > 0 ? "+" : ""}${a.adherencia.valor} pp`,
      sem: semaforo(a.adherencia.valor),
      resumen: "Cuánto mejora el conocimiento del personal entre el presaber y el postsaber.",
      ficha: [
        {
          campo: "Objetivo",
          contenido:
            "Medir la apropiación real del conocimiento impartido: la mejora de cada persona entre su evaluación previa (presaber) y su evaluación posterior (postsaber) a la capacitación.",
        },
        {
          campo: "Fórmula",
          contenido:
            "((Promedio postsaber − Promedio presaber) ÷ Promedio presaber) × 100, calculada POR PERSONA y luego promediada sobre quienes tienen ambos intentos completos.",
        },
        { campo: "Unidad", contenido: "Puntos porcentuales (pp)" },
        {
          campo: "Fuente de datos",
          contenido:
            "Intentos de evaluación con momento presaber/postsaber, congelados al crear cada intento. En jornadas cerradas se lee del informe congelado del acta: el histórico no cambia aunque se toquen registros después.",
        },
        {
          campo: "Periodicidad",
          contenido:
            "Cálculo automático y en tiempo real. Una jornada entra al indicador cuando su responsable la CIERRA; no requiere ningún registro manual.",
        },
        { campo: "Responsable", contenido: "Talento Humano (líder del PIC). La medición la hace la plataforma." },
        {
          campo: "Alcance",
          contenido: "Institucional, con desagregación por área y por trimestre según la programación del PIC.",
        },
      ],
      columnasMedicion: ["Corte", "Cerradas", "Personas", "Resultado"],
      mediciones: filaMediciones(
        datos,
        (i) => ({
          celdas: [String(i.adherencia.actividadesCerradas), String(i.adherencia.personas)],
          valor: i.adherencia.valor,
        }),
        (v) => `${v > 0 ? "+" : ""}${v} pp`
      ),
      analisis: adherenciaAnalisis,
    },
    {
      codigo: "PIC-COB-02",
      nombre: "Cobertura de contenido del PIC",
      principal: false,
      Icono: Layers,
      valorGrande: `${a.cobertura.valor}%`,
      sem: semaforo(a.cobertura.valor),
      resumen: "Qué proporción de las líneas del plan ya tiene su curso montado en la plataforma.",
      ficha: [
        {
          campo: "Objetivo",
          contenido:
            "Vigilar que cada capacitación programada en el PIC tenga su contenido (presentación y evaluación) publicado y disponible para el personal.",
        },
        { campo: "Fórmula", contenido: "(Líneas del PIC con curso vinculado ÷ Total de líneas del PIC) × 100." },
        { campo: "Unidad", contenido: "Porcentaje (%)" },
        {
          campo: "Fuente de datos",
          contenido: "Vínculo actividad → curso de cada línea del plan. Sin registro manual.",
        },
        {
          campo: "Periodicidad",
          contenido: "Cálculo automático y en tiempo real: cambia al montar o desvincular contenido.",
        },
        { campo: "Responsable", contenido: "Cada área responde por sus líneas; Talento Humano consolida." },
        { campo: "Alcance", contenido: "Institucional, con desagregación por área y por trimestre." },
      ],
      columnasMedicion: ["Corte", "Programadas", "Con contenido", "Resultado"],
      mediciones: filaMediciones(
        datos,
        (i) => ({
          celdas: [String(i.cobertura.total), String(i.cobertura.conContenido)],
          valor: i.cobertura.valor,
        }),
        (v) => `${v}%`
      ),
      analisis: coberturaAnalisis,
    },
    {
      codigo: "PIC-ASI-03",
      nombre: "Asistencia efectiva",
      principal: false,
      Icono: Users2,
      valorGrande: `${a.asistencia.valor}%`,
      sem: semaforo(a.asistencia.valor),
      resumen: "Cuántas de las convocatorias del plan terminan en una asistencia registrada.",
      ficha: [
        {
          campo: "Objetivo",
          contenido:
            "Medir la participación real del personal convocado: quién efectivamente llegó a cada capacitación, frente a la audiencia objetivo que el plan define para esa línea.",
        },
        {
          campo: "Fórmula",
          contenido:
            "(Asistencias registradas ÷ Convocatorias) × 100, donde cada convocatoria es un par persona × capacitación según la audiencia objetivo de la línea.",
        },
        { campo: "Unidad", contenido: "Porcentaje (%), con conteo absoluto «X de Y»." },
        {
          campo: "Fuente de datos",
          contenido:
            "Registro de asistencia automático (entrar a la sala o presentar la evaluación lo deja solo) y manual del área cuando aplica.",
        },
        {
          campo: "Periodicidad",
          contenido: "Cálculo automático y en tiempo real, con cada asistencia que se registra.",
        },
        { campo: "Responsable", contenido: "Cada área en su jornada; Talento Humano consolida." },
        { campo: "Alcance", contenido: "Institucional, con desagregación por área, actividad y trimestre." },
      ],
      columnasMedicion: ["Corte", "Convocatorias", "Asistencias", "Resultado"],
      mediciones: filaMediciones(
        datos,
        (i) => ({
          celdas: [String(i.asistencia.audiencia), String(i.asistencia.asistentes)],
          valor: i.asistencia.audiencia > 0 ? i.asistencia.valor : null,
        }),
        (v) => `${v}%`
      ),
      analisis: asistenciaAnalisis,
    },
  ];
}

/** Fila de la ficha técnica: campo a la izquierda, contenido a la derecha. */
function FilaFicha({ campo, contenido }: { campo: string; contenido: string }) {
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 px-5 py-3">
      <dt className="text-[10px] font-bold uppercase leading-4 tracking-wide text-muted-foreground">{campo}</dt>
      <dd className="text-[12px] leading-relaxed text-foreground/85">{contenido}</dd>
    </div>
  );
}

/**
 * Indicadores del plan, cada uno con su FICHA TÉCNICA completa, como
 * cualquier indicador institucional: objetivo, fórmula, unidad, fuente,
 * periodicidad, responsable, semaforización explícita, mediciones por
 * trimestre y análisis del resultado.
 *
 * Tres columnas, una por indicador: el resumen bonito sin la ficha no le
 * sirve a quien tiene que reportar el indicador ante un ente de control.
 */
export function PanelIndicadores({ datos }: { datos: PlanIndicadores }) {
  const fichas = construirFichas(datos);

  return (
    <MotionConfig reducedMotion="user">
      <div className="space-y-6">
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-3">
          {fichas.map((f, i) => (
            <motion.article
              key={f.codigo}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col gap-5"
              aria-label={`Indicador ${f.nombre}`}
            >
              {/* Cabecera: el valor vigente del acumulado, con su veredicto. */}
              <div className={cn("surface-vivo", GLOW[f.sem])}>
                <div className="flex h-full flex-col gap-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                        <f.Icono className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                          {f.codigo}
                          {f.principal && <span className="ml-1.5 text-primary">· Principal</span>}
                        </p>
                        <p className="font-display text-[14px] font-bold leading-snug text-foreground">{f.nombre}</p>
                      </div>
                    </div>
                    <span className={cn("shrink-0 text-[11px] font-bold uppercase tracking-wide", TEXTO_SEMAFORO[f.sem])}>
                      {VEREDICTO[f.sem]}
                    </span>
                  </div>
                  <div>
                    {f.sem === "sin-datos" ? (
                      <p className="font-display text-xl font-extrabold leading-tight tracking-tight text-muted-foreground">
                        Sin datos todavía
                      </p>
                    ) : (
                      <p
                        className={cn(
                          "font-display text-[2.6rem] font-black leading-none tracking-tight tabular-nums",
                          f.principal ? "cifra-vivo" : "text-foreground"
                        )}
                      >
                        {f.valorGrande}
                      </p>
                    )}
                    <p className="mt-1.5 text-[12px] leading-snug text-muted-foreground">{f.resumen}</p>
                  </div>
                </div>
              </div>

              {/* La ficha técnica propiamente dicha. */}
              <div className="surface-lumen overflow-hidden">
                <div className="border-b border-border/60 px-5 py-3">
                  <h3 className="font-display text-[13px] font-bold uppercase tracking-wide text-foreground">
                    Ficha técnica
                  </h3>
                </div>

                <dl className="divide-y divide-border/40">
                  {f.ficha.map((fila) => (
                    <FilaFicha key={fila.campo} campo={fila.campo} contenido={fila.contenido} />
                  ))}

                  {/* Semaforización: los umbrales, con su color, dentro de la ficha. */}
                  <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 px-5 py-3">
                    <dt className="text-[10px] font-bold uppercase leading-4 tracking-wide text-muted-foreground">
                      Semaforización
                    </dt>
                    <dd className="flex flex-wrap gap-1.5">
                      {[
                        { sem: "verde" as const, texto: `≥ ${UMBRAL_VERDE}%`, etiqueta: "Cumple" },
                        { sem: "amarillo" as const, texto: `${UMBRAL_AMARILLO}–${UMBRAL_VERDE - 0.1}%`, etiqueta: "En alerta" },
                        { sem: "rojo" as const, texto: `< ${UMBRAL_AMARILLO}%`, etiqueta: "Crítico" },
                      ].map((u) => (
                        <span
                          key={u.sem}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-card/60 px-2.5 py-1 text-[11px] font-semibold",
                            f.sem === u.sem ? TEXTO_SEMAFORO[u.sem] : "text-muted-foreground"
                          )}
                        >
                          <span className={cn("h-2 w-2 rounded-full", PUNTO_SEMAFORO[u.sem])} aria-hidden="true" />
                          {u.etiqueta} {u.texto}
                        </span>
                      ))}
                    </dd>
                  </div>
                </dl>

                {/* Mediciones por corte: se generan solas desde la programación. */}
                <div className="border-t border-border/60">
                  <p className="px-5 pt-3 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    Mediciones
                  </p>
                  <table className="mt-2 w-full text-left">
                    <thead>
                      <tr className="border-b border-border/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {f.columnasMedicion.map((c, j) => (
                          <th
                            key={c}
                            scope="col"
                            className={cn(
                              "px-5 py-2 font-bold",
                              j > 0 && "px-2 text-right",
                              j === f.columnasMedicion.length - 1 && "pr-5"
                            )}
                          >
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {f.mediciones.map((m) => {
                        const sm = semaforo(m.valor);
                        const acumulado = m.corte === "Acumulado año";
                        return (
                          <tr
                            key={m.corte}
                            className={cn(
                              "border-b border-border/30 last:border-0",
                              acumulado && "bg-foreground/[0.03] font-semibold"
                            )}
                          >
                            <td className="px-5 py-2 text-[12px] text-foreground">{m.corte}</td>
                            {m.celdas.map((c, j) => (
                              <td key={j} className="px-2 py-2 text-right text-[12px] tabular-nums text-muted-foreground">
                                {c}
                              </td>
                            ))}
                            <td className="py-2 pl-2 pr-5 text-right">
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1.5 text-[12px] font-bold tabular-nums",
                                  TEXTO_SEMAFORO[sm]
                                )}
                              >
                                <span className={cn("h-2 w-2 rounded-full", PUNTO_SEMAFORO[sm])} aria-hidden="true" />
                                {m.valor === null ? "—" : m.formatearValor(m.valor)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Análisis del resultado vigente, generado desde los datos. */}
                <div className="border-t border-border/60 px-5 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Análisis</p>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-foreground/85">{f.analisis}</p>
                </div>
              </div>
            </motion.article>
          ))}
        </div>

        {/* Desagregación por área del acumulado: el nivel de detalle común. */}
        {datos.porArea.length > 1 && (
          <section aria-label="Indicadores por área" className="surface-lumen overflow-hidden">
            <div className="border-b border-border/60 px-5 py-3.5">
              <h3 className="font-display text-sm font-bold text-foreground">
                Desagregación por área · acumulado del año
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Las mismas tres fórmulas, aplicadas al universo de cada área.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="px-5 py-2.5 font-bold">Área</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-bold">Adherencia</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-bold">Cobertura</th>
                    <th scope="col" className="px-5 py-2.5 text-right font-bold">Asistencia</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.porArea.map((a) => (
                    <tr key={a.areaId} className="border-b border-border/40 last:border-0">
                      <td className="px-5 py-3 font-medium text-foreground">{a.areaNombre}</td>
                      <td className={cn("px-3 py-3 text-right font-bold tabular-nums", TEXTO_SEMAFORO[semaforo(a.adherencia.valor)])}>
                        {a.adherencia.valor === null ? "—" : `${a.adherencia.valor > 0 ? "+" : ""}${a.adherencia.valor} pp`}
                      </td>
                      <td className={cn("px-3 py-3 text-right font-bold tabular-nums", TEXTO_SEMAFORO[semaforo(a.cobertura.valor)])}>
                        {a.cobertura.valor}%
                        <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                          ({a.cobertura.conContenido}/{a.cobertura.total})
                        </span>
                      </td>
                      <td className={cn("px-5 py-3 text-right font-bold tabular-nums", TEXTO_SEMAFORO[semaforo(a.asistencia.valor)])}>
                        {a.asistencia.valor}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </MotionConfig>
  );
}
