"use client";

import { MotionConfig, motion } from "framer-motion";
import { TrendingUp, Layers, Users2, type LucideIcon } from "lucide-react";
import { DotPattern } from "@/components/brand/dot-pattern";
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

/* El umbral vigente se resalta dentro de la ficha con su propio color. */
const CHIP_ACTIVO: Record<Semaforo, string> = {
  verde: "border-success/60 bg-success/10 text-success",
  amarillo: "border-warning/70 bg-warning/15 text-warning-foreground",
  rojo: "border-destructive/60 bg-destructive/10 text-destructive",
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
  /** Degradado del póster de cabecera, con el lenguaje de las tarjetas de curso. */
  banner: string;
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
      // La principal lleva el degradado de marca completo (primary → success),
      // el mismo de la acción principal de las tarjetas de curso.
      banner: "bg-gradient-to-br from-primary via-primary to-success",
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
      banner: "bg-gradient-to-br from-navy/85 to-navy",
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
      banner: "bg-gradient-to-br from-primary/75 to-primary",
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

/** Título de sección dentro del vidrio, con el tic en degradado de marca. */
function TituloSeccion({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
      <span className="h-3.5 w-1 rounded-full bg-gradient-to-b from-primary to-success" aria-hidden="true" />
      {children}
    </p>
  );
}

/**
 * Indicadores del plan, cada uno con su FICHA TÉCNICA completa, como
 * cualquier indicador institucional: objetivo, fórmula, unidad, fuente,
 * periodicidad, responsable, semaforización explícita, mediciones por
 * trimestre y análisis del resultado.
 *
 * Cada ficha es UNA tarjeta de vidrio (surface-vivo: borde en degradado,
 * blur + saturación, brillo superior) con cabecera tipo póster —el mismo
 * lenguaje de las tarjetas de curso: degradado vivo, patrón de puntos,
 * pill de estado en blanco—. El semáforo se comunica con el halo difuso
 * de la tarjeta y el punto del pill, no pintando fondos de color.
 */
export function PanelIndicadores({ datos }: { datos: PlanIndicadores }) {
  const fichas = construirFichas(datos);

  return (
    <MotionConfig reducedMotion="user">
      <div className="space-y-6">
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
          {fichas.map((f, i) => (
            <motion.article
              key={f.codigo}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.34, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
              aria-label={`Indicador ${f.nombre}`}
            >
              <div className={cn("surface-vivo", GLOW[f.sem])}>
                <div>
                  {/* Cabecera tipo póster: el indicador se presenta como una
                      tarjeta de curso, no como texto plano sobre blanco. */}
                  <div className={cn("relative overflow-hidden p-5 text-white", f.banner)}>
                    <DotPattern className="text-white/20" />
                    <f.Icono
                      className="absolute -bottom-6 -right-4 h-28 w-28 -rotate-6 text-white/10"
                      strokeWidth={1.2}
                      aria-hidden="true"
                    />
                    <div className="relative space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 shadow-sm backdrop-blur">
                          <f.Icono className="h-5 w-5 text-white" strokeWidth={2} aria-hidden="true" />
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-navy shadow-sm backdrop-blur">
                          <span className={cn("h-1.5 w-1.5 rounded-full", PUNTO_SEMAFORO[f.sem])} aria-hidden="true" />
                          {VEREDICTO[f.sem]}
                        </span>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/75">
                          {f.codigo}
                          {f.principal && " · Principal"}
                        </p>
                        <h3 className="mt-1 font-display text-[15px] font-extrabold leading-snug">{f.nombre}</h3>
                      </div>
                      <div>
                        {f.sem === "sin-datos" ? (
                          <p className="font-display text-xl font-extrabold leading-tight tracking-tight text-white/85">
                            Sin datos todavía
                          </p>
                        ) : (
                          <p
                            className={cn(
                              "font-display font-black leading-none tracking-tight tabular-nums drop-shadow-sm",
                              f.principal ? "text-[3rem]" : "text-[2.5rem]"
                            )}
                          >
                            {f.valorGrande}
                          </p>
                        )}
                        <p className="mt-1.5 text-[12px] leading-snug text-white/80">{f.resumen}</p>
                      </div>
                    </div>
                  </div>

                  {/* Cuerpo de vidrio: la ficha técnica propiamente dicha. */}
                  <div className="px-5 pb-1 pt-4">
                    <TituloSeccion>Ficha técnica</TituloSeccion>
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
                              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm",
                              f.sem === u.sem
                                ? CHIP_ACTIVO[u.sem]
                                : "border-border/50 bg-card/60 text-muted-foreground"
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
                  <div className="border-t border-border/50">
                    <div className="px-5 pt-3">
                      <TituloSeccion>Mediciones</TituloSeccion>
                    </div>
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
                                acumulado && "bg-gradient-to-r from-primary/10 to-success/10 font-semibold"
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
                  <div className="border-t border-border/50 px-5 py-4">
                    <TituloSeccion>Análisis</TituloSeccion>
                    <p className="mt-2 text-[12px] leading-relaxed text-foreground/85">{f.analisis}</p>
                  </div>
                </div>
              </div>
            </motion.article>
          ))}
        </div>

        {/* Desagregación por área del acumulado: el nivel de detalle común. */}
        {datos.porArea.length > 1 && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.34, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            aria-label="Indicadores por área"
            className="surface-vivo"
          >
            <div>
              <div className="px-5 py-4">
                <h3 className="flex items-center gap-2 font-display text-sm font-bold text-foreground">
                  <span className="h-3.5 w-1 rounded-full bg-gradient-to-b from-primary to-success" aria-hidden="true" />
                  Desagregación por área · acumulado del año
                </h3>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Las mismas tres fórmulas, aplicadas al universo de cada área.
                </p>
              </div>
              <div className="overflow-x-auto border-t border-border/50">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border/50 text-[10px] uppercase tracking-wide text-muted-foreground">
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
            </div>
          </motion.section>
        )}
      </div>
    </MotionConfig>
  );
}
