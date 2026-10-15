import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  FileSpreadsheet,
  FileText,
  FileType2,
  Gauge,
  GraduationCap,
  Layers,
  ListOrdered,
  TrendingUp,
  Users2,
} from "lucide-react";
import type { SurveyQuestionType } from "@prisma/client";
import { requireSurveyAccess } from "@/lib/auth-helpers";
import { getResultadosEncuesta } from "@/lib/encuestas/consultas";
import { ETIQUETA_TIPO } from "@/lib/encuestas/tipos";
import { GraficaEvolucion, GraficaOpciones, GraficaDistribucion } from "@/components/encuestas/graficas-resultados";
import { BotonEnlacePublico } from "@/components/encuestas/boton-enlace-publico";
import { ETIQUETA_AUDIENCIA, ETIQUETA_ESTADO } from "@/components/encuestas/tarjeta-encuesta";
import {
  BarraPorcentaje,
  CentroExportacion,
  COLOR_SEMAFORO,
  EncabezadoSeccion,
  NavFicha,
  Semaforo,
  TarjetaExporte,
  tonoDe,
} from "@/components/encuestas/ficha-encuesta";
import { ModuloHero } from "@/components/training-plans/modulo-hero";
import { Cifra } from "@/components/training-plans/plan-dinamico";
import { AnilloPorcentaje, escalon } from "@/components/training-plans/plan-visual";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const BASE_CUMPLIMIENTO = { puntaje: "Acierto", satisfaccion: "Satisfacción", finalizacion: "Finalización" } as const;
const DESCRIPCION_CUMPLIMIENTO = {
  puntaje: "Cumplimiento general por acierto",
  satisfaccion: "Índice global de satisfacción sobre respuestas válidas",
  finalizacion: "Cumplimiento general por finalización",
} as const;

/**
 * FICHA DE RESULTADOS de una encuesta, organizada de arriba abajo:
 *
 *   1. Cabecera de mando: qué encuesta es, sus cifras de participación y el
 *      cumplimiento como instrumento (anillo + semáforo).
 *   2. Barra de mando: navegar entre resultados, respuestas y constructor,
 *      y difundir (enlace público y QR).
 *   3. Centro de exportación: cada archivo con su formato y su contenido.
 *   4. Pestañas: el resumen (indicadores, bloques, evolución) y el detalle
 *      por pregunta.
 *
 * Solo para quien gestiona la encuesta.
 */
export default async function ResultadosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSurveyAccess(id).catch(() => notFound());

  const datos = await getResultadosEncuesta(id);
  if (!datos) notFound();
  const { encuesta, totales, minutosPromedio, puntaje, cumplimiento, indicadores, evolucion, porPregunta } = datos;
  const acento = encuesta.themeColor || "#6D3BF5";
  const esSiau = encuesta.code.startsWith("PM-7-SIAU");
  const conDatos = totales.respuestas > 0;
  const tono = conDatos ? tonoDe(cumplimiento.porcentaje) : "muted";
  const conBloques = Boolean(puntaje && puntaje.porBloque.length > 0);
  const hayResumen = indicadores.length > 0 || conBloques || evolucion.length > 1;

  const chips = [
    { Icono: Layers, texto: ETIQUETA_ESTADO[encuesta.status] },
    { Icono: Users2, texto: ETIQUETA_AUDIENCIA[encuesta.audience] },
    { Icono: ListOrdered, texto: `${porPregunta.length} ${porPregunta.length === 1 ? "pregunta" : "preguntas"}` },
    ...(encuesta.trainingActivity ? [{ Icono: GraduationCap, texto: encuesta.trainingActivity.title }] : []),
  ];

  return (
    <div className="space-y-5">
      <Link
        href="/encuestas"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Encuestas
      </Link>

      <div className="space-y-3">
        <ModuloHero
          eyebrow={`Ficha de resultados · ${encuesta.code}`}
          Icono={BarChart3}
          titulo={encuesta.title}
          descripcion={
            <div className="flex flex-wrap items-center gap-2">
              {chips.map(({ Icono, texto }) => (
                <span
                  key={texto}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.06] px-2.5 py-1 text-[12.5px] text-white/85"
                >
                  <Icono className="h-3.5 w-3.5 shrink-0 text-[color-mix(in_oklch,var(--primary)_70%,white)]" aria-hidden="true" />
                  <span className="truncate">{texto}</span>
                </span>
              ))}
            </div>
          }
          cifras={[
            { valor: totales.respuestas, etiqueta: "Respuestas", detalle: "iniciadas en total" },
            { valor: totales.completadas, etiqueta: "Completadas", detalle: "enviadas hasta el final" },
            { valor: totales.parciales, etiqueta: "Parciales", detalle: "abandonos" },
            {
              valor: <Cifra valor={totales.tasaFinalizacion} sufijo="%" />,
              etiqueta: "Finalización",
              detalle: minutosPromedio !== null ? `${minutosPromedio} min promedio` : "sin tiempo medido",
            },
          ]}
          lateral={
            <div className="flex items-center gap-4 sm:flex-col sm:gap-2.5" title={DESCRIPCION_CUMPLIMIENTO[cumplimiento.base]}>
              <AnilloPorcentaje
                valor={conDatos ? cumplimiento.porcentaje : null}
                tamano={128}
                grosor={7}
                oscuro
                etiqueta={BASE_CUMPLIMIENTO[cumplimiento.base]}
              />
              <Semaforo tono={tono} />
            </div>
          }
        />

        {/* Barra de mando: navegación de la ficha a la izquierda, difusión a la derecha. */}
        <div className="barra-modulo flex flex-wrap items-center justify-between gap-3 p-2.5">
          <NavFicha id={id} activa="resultados" />
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none">
            {esSiau && (
              <Link href="/encuestas/siau" className="enc-boton">
                <Activity aria-hidden="true" />
                Centro de datos SIAU
              </Link>
            )}
            {encuesta.status !== "DRAFT" && (
              <BotonEnlacePublico slug={encuesta.slug} titulo={encuesta.title} acento={acento} variante="barra" />
            )}
          </div>
        </div>
      </div>

      <CentroExportacion
        titulo="Descargas de esta encuesta"
        bajada="Cada archivo se genera en el momento con los datos vigentes. Para exportar una sola pregunta, usa su CSV en la pestaña «Por pregunta»."
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <TarjetaExporte
            destacado
            href={`/api/encuestas/${encuesta.slug}/informe`}
            Icono={FileText}
            formato="PDF"
            titulo="Informe de resultados"
            detalle="Métricas, gráficas y la tabulación completa por pregunta, con la fecha de generación."
            pie="Para presentar o radicar"
          />
          <TarjetaExporte
            href={`/api/encuestas/${encuesta.slug}/csv`}
            Icono={FileSpreadsheet}
            formato="CSV"
            titulo="Base de respuestas"
            detalle="Una fila por respuesta completa y una columna por pregunta, con encuestado, fecha, canal y puntaje."
            pie="Se abre en Excel"
          />
          <TarjetaExporte
            href={`/api/encuestas/${encuesta.slug}/formato-docx`}
            Icono={FileType2}
            formato="DOCX"
            titulo="Formato oficial en Word"
            detalle="El instrumento con su encabezado institucional y todas las preguntas, listo para imprimir o archivar."
            pie="Formato sin diligenciar"
          />
        </div>
      </CentroExportacion>

      <Tabs defaultValue={hayResumen ? "resumen" : "preguntas"}>
        <TabsList className="plan-tabs">
          <TabsTrigger value="resumen">
            <Gauge aria-hidden="true" />
            Resumen
          </TabsTrigger>
          <TabsTrigger value="preguntas">
            <ListOrdered aria-hidden="true" />
            Por pregunta
            <span className="conteo">{porPregunta.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="space-y-5 pt-4">
          {!hayResumen && (
            <div className="barra-modulo flex flex-col items-center gap-2 px-6 py-12 text-center">
              <Gauge className="h-6 w-6 text-primary" aria-hidden="true" />
              <p className="font-display text-[15px] font-bold text-foreground">El resumen se arma con las respuestas</p>
              <p className="max-w-md text-[13px] text-muted-foreground">
                Aquí aparecen los indicadores de satisfacción, el puntaje por bloque y la evolución diaria en cuanto haya
                respuestas suficientes. El detalle de cada pregunta ya está en «Por pregunta».
              </p>
            </div>
          )}

          {/* Indicadores de satisfacción (encuestas de cara al usuario) */}
          {indicadores.length > 0 && (
            <section className="barra-modulo p-5">
              <EncabezadoSeccion
                numero="01"
                titulo="Indicadores de satisfacción"
                bajada="Respuestas favorables (Excelente / Bueno / positivas) sobre las válidas: No aplica, No responde y En blanco no cuentan en el denominador (Resolución 0256 de 2016)."
              />
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {indicadores.map((ind, i) => (
                  <div key={ind.id} className="plan-instancia revelar p-4" style={escalon(i)}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[13px] font-semibold leading-snug text-foreground">{ind.etiqueta}</p>
                      <p className="mono-dato shrink-0 text-[1.35rem] font-semibold leading-none" style={{ color: COLOR_SEMAFORO[tonoDe(ind.porcentaje)] }}>
                        {ind.porcentaje}%
                      </p>
                    </div>
                    <BarraPorcentaje valor={ind.porcentaje} className="mt-3" />
                    <p className="mono-label mt-2">
                      {ind.validas} {ind.validas === 1 ? "válida" : "válidas"}
                      {ind.preguntas > 1 ? ` · ${ind.preguntas} perfiles` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {(conBloques || evolucion.length > 1) && (
            <div className={conBloques && evolucion.length > 1 ? "grid grid-cols-1 gap-5 xl:grid-cols-2" : "space-y-5"}>
              {/* Puntaje por bloque (solo si la encuesta califica) */}
              {puntaje && conBloques && (
                <section className="barra-modulo p-5">
                  <EncabezadoSeccion numero="02" titulo="Puntaje por bloque" bajada="Puntos obtenidos sobre los posibles en cada bloque de la encuesta." />
                  <div className="mt-4 space-y-4">
                    {puntaje.porBloque.map((b) => (
                      <div key={b.pageId}>
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="min-w-0 text-[13px] font-semibold text-foreground">{b.titulo}</p>
                          <p className="mono-dato shrink-0 text-[12.5px] font-semibold" style={{ color: COLOR_SEMAFORO[tonoDe(b.porcentaje)] }}>
                            {b.obtenido}/{b.posible} · {b.porcentaje}%
                          </p>
                        </div>
                        <BarraPorcentaje valor={b.porcentaje} className="mt-1.5" />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Evolución */}
              {evolucion.length > 1 && (
                <section className="barra-modulo p-5">
                  <EncabezadoSeccion numero="03" Icono={TrendingUp} titulo="Evolución de respuestas" bajada="Respuestas recibidas por día." />
                  <GraficaEvolucion datos={evolucion} acento={acento} />
                </section>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="preguntas" className="pt-4">
          {/* Dos columnas tipo informe: cada pregunta ocupa solo su alto. */}
          <div className="gap-4 xl:columns-2">
            {porPregunta.map((p, i) => (
              <article key={p.id} className="barra-modulo revelar mb-4 flex min-w-0 break-inside-avoid flex-col p-5" style={escalon(Math.min(i, 10))}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="enc-sello">P{String(i + 1).padStart(2, "0")}</span>
                    <span className="mono-label truncate">{ETIQUETA_TIPO[p.type as SurveyQuestionType] ?? p.type}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="chip-dato">
                      <Users2 aria-hidden="true" />
                      {p.respuestas} {p.respuestas === 1 ? "respuesta" : "respuestas"}
                    </span>
                    <a
                      href={`/api/encuestas/${encuesta.slug}/csv?pregunta=${p.id}`}
                      title="Exportar esta pregunta (CSV)"
                      className="enc-boton enc-boton-mini"
                    >
                      <FileSpreadsheet aria-hidden="true" />
                      CSV
                    </a>
                  </div>
                </div>

                <h3 className="mt-3 text-[14px] font-semibold leading-snug text-foreground">{p.prompt}</h3>

                {((p.favorable && p.favorable.validas > 0) || p.aciertos != null) && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {p.favorable && p.favorable.validas > 0 && (
                      <Semaforo tono={tonoDe(p.favorable.porcentaje)}>
                        Favorable {p.favorable.porcentaje}% · {p.favorable.validas} válidas
                      </Semaforo>
                    )}
                    {p.aciertos != null && <span className="chip-dato chip-dato-primario">Aciertos {p.aciertos}%</span>}
                  </div>
                )}

                <div className="mt-4 border-t border-border/60 pt-4">
                  {p.opciones ? (
                    <GraficaOpciones opciones={p.opciones} acento={acento} />
                  ) : p.distribucion ? (
                    <GraficaDistribucion distribucion={p.distribucion} promedio={p.promedio ?? null} acento={acento} />
                  ) : (
                    <ListaTextos textos={p.textos ?? []} />
                  )}
                </div>
              </article>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ListaTextos({ textos }: { textos: string[] }) {
  if (textos.length === 0) return <p className="text-[13px] italic text-muted-foreground">Sin respuestas de texto.</p>;
  return (
    <ul className="space-y-1.5">
      {textos.slice(0, 12).map((t, i) => (
        <li
          key={i}
          className="rounded-r-lg border-l-2 border-primary/50 bg-muted/40 px-3.5 py-2 text-[13px] leading-relaxed text-foreground"
        >
          {t}
        </li>
      ))}
      {textos.length > 12 && (
        <li className="mono-label px-1 pt-1">+ {textos.length - 12} más · completas en el CSV</li>
      )}
    </ul>
  );
}
