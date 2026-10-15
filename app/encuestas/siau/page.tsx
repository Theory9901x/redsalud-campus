import Link from "next/link";
import { notFound } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Building2,
  CalendarRange,
  ChevronDown,
  Download,
  Gauge,
  GitCompareArrows,
  History,
  Inbox,
  MapPin,
  MessageSquareText,
  Minus,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TrendingUp,
  Users2,
} from "lucide-react";
import { requireTutorOrAdmin } from "@/lib/auth-helpers";
import { getInformeSiau, getEstructuraSiau, type MetricaPregunta } from "@/lib/encuestas/metrics";
import { leerPeriodo, periodoActual } from "@/lib/encuestas/periodo-url";
import { FiltrosSiau } from "@/components/encuestas/filtros-siau";
import { LineaTendencia, BarrasApiladasCaritas, BarrasRanking, COLOR_TONO } from "@/components/encuestas/graficas-siau";
import { etiquetaFecha, etiquetaHora } from "@/components/training-plans/labels";
import { leerConfig } from "@/lib/encuestas/tipos";
import { cn } from "@/lib/utils";
import { ExportablesSiau } from "@/components/encuestas/exportables-siau";
import { ultimasExportacionesSiau } from "@/lib/encuestas/registro-exportacion";
import { TEMAS_SUGERENCIAS } from "@/lib/encuestas/temas";
import { BarraPorcentaje, COLOR_SEMAFORO, EncabezadoSeccion, Semaforo } from "@/components/encuestas/ficha-encuesta";
import { ModuloHero } from "@/components/training-plans/modulo-hero";
import { AnilloPorcentaje, escalon } from "@/components/training-plans/plan-visual";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TEMAS = TEMAS_SUGERENCIAS;

function Variacion({ v }: { v: number | null }) {
  if (v === null) return <span className="mono-label">sin periodo previo</span>;
  const Icono = v > 0 ? ArrowUpRight : v < 0 ? ArrowDownRight : Minus;
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-mono text-[11px] font-semibold", v > 0 ? "text-success" : v < 0 ? "text-destructive" : "text-muted-foreground")}>
      <Icono className="h-3.5 w-3.5" aria-hidden="true" />
      {v > 0 ? "+" : ""}{v} pp vs periodo anterior
    </span>
  );
}

function Pct({ v }: { v: number | null }) {
  return <>{v === null ? "—" : `${v}%`}</>;
}

/**
 * CENTRO DE DATOS SIAU: informe general de la Encuesta de Atención al
 * Usuario por periodo, con filtros combinables, tendencia, comparativo,
 * ranking de sedes, detalle por pregunta, cruces por variable y sugerencias.
 *
 * Orden de trabajo: cabecera con la adherencia como instrumento → filtros
 * de la vista → análisis en pestañas → centro de exportación (todos los
 * archivos en un solo bloque, con el periodo elegido explícitamente).
 */
export default async function CentroDatosSiauPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireTutorOrAdmin();
  const sp = await searchParams;
  const params = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
  const periodo = leerPeriodo(params) ?? periodoActual((sp.tipo as "mensual" | "trimestral" | "anual") || "mensual");
  const filtros = { sede: sp.sede || undefined, servicio: sp.servicio || undefined, sexo: sp.sexo || undefined, eps: sp.eps || undefined };

  const [informe, estructura, exportaciones] = await Promise.all([getInformeSiau(periodo, filtros), getEstructuraSiau(), ultimasExportacionesSiau(8)]);
  if (!informe || !estructura) notFound();
  const { metricas: m, metricasPrevias: prev, rango, rangoPrevio } = informe;
  const encuesta = estructura.encuesta;
  const opcionesDe = (rol?: string, estilo?: string) => estructura.encuesta.pages.flatMap((p) => p.questions).find((q) => (rol && leerConfig(q.config).rol === rol) || (estilo && leerConfig(q.config).estilo === estilo));
  const sedes = leerConfig(opcionesDe("municipio")?.config).opciones?.map((o) => o.texto) ?? [];
  const servicios = leerConfig(opcionesDe(undefined, "servicios")?.config).opciones?.map((o) => o.texto) ?? [];
  const epss = leerConfig(opcionesDe("eps")?.config).opciones?.map((o) => o.texto) ?? [];
  const anioActual = new Date().getFullYear();
  const consulta = params.toString();

  const tonosEscala = [
    { clave: "exc", etiqueta: "Excelente / Muy buena / Sí", tono: "exc" as const },
    { clave: "bue", etiqueta: "Bueno / Buena", tono: "bue" as const },
    { clave: "reg", etiqueta: "Regular", tono: "reg" as const },
    { clave: "mal", etiqueta: "Malo / Mala", tono: "mal" as const },
    { clave: "muymal", etiqueta: "Muy malo / No", tono: "muymal" as const },
    { clave: "na", etiqueta: "No aplica", tono: "na" as const },
  ];
  const apilado = (lista: MetricaPregunta[]) =>
    lista.map((p) => {
      const fila: { nombre: string; [k: string]: number | string } = { nombre: p.perfil ?? (p.numero ? `P${p.numero}` : p.enunciado) };
      for (const t of tonosEscala) fila[t.clave] = p.distribucion.filter((d) => d.tono === t.tono).reduce((s, d) => s + d.pct, 0);
      return fila;
    });

  // Temas de sugerencias
  const temas = TEMAS.map((t) => ({ tema: t.tema, n: m.sugerencias.filter((s) => t.claves.test(s.texto)).length })).filter((t) => t.n > 0).sort((a, b) => b.n - a.n);
  const sinTema = m.sugerencias.filter((s) => !TEMAS.some((t) => t.claves.test(s.texto))).length;

  const sedesConDatos = informe.porSede.filter((s) => s.valor !== "Sin dato").length;
  const sedesEnVerde = informe.porSede.filter((s) => s.semaforo === "success").length;
  const variacion = informe.variacionGeneral;
  const filtrosChips = [
    { Icono: MapPin, valor: filtros.sede },
    { Icono: Stethoscope, valor: filtros.servicio },
    { Icono: Users2, valor: filtros.sexo },
    { Icono: ShieldCheck, valor: filtros.eps },
  ].filter((f) => f.valor);
  const chipHero = "inline-flex max-w-full items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.06] px-2.5 py-1 text-[12.5px] text-white/85";
  const iconoHero = "h-3.5 w-3.5 shrink-0 text-[color-mix(in_oklch,var(--primary)_70%,white)]";

  return (
    <div className="space-y-5">
      <Link href="/encuestas" className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Encuestas
      </Link>

      <ModuloHero
        eyebrow={`Centro de datos SIAU · ${encuesta.code}`}
        Icono={Activity}
        titulo={encuesta.title}
        descripcion={
          <div className="flex flex-wrap items-center gap-2">
            <span className={chipHero}>
              <CalendarRange className={iconoHero} aria-hidden="true" />
              <span className="truncate">{rango.etiqueta}</span>
            </span>
            {filtrosChips.map(({ Icono, valor }) => (
              <span key={valor} className={chipHero}>
                <Icono className={iconoHero} aria-hidden="true" />
                <span className="truncate">{valor}</span>
              </span>
            ))}
            <span className={chipHero}>
              <GitCompareArrows className={iconoHero} aria-hidden="true" />
              <span className="truncate">vs {rangoPrevio.etiqueta}</span>
            </span>
          </div>
        }
        cifras={[
          { valor: m.total, etiqueta: "Encuestas en el periodo", detalle: prev ? `${prev.total} en el periodo anterior` : undefined },
          {
            valor: variacion === null ? "—" : `${variacion > 0 ? "+" : ""}${variacion} pp`,
            etiqueta: "Variación de adherencia",
            detalle: variacion === null ? "sin periodo previo" : `frente a ${rangoPrevio.etiqueta}`,
          },
          { valor: m.puntajeGeneral === null ? "—" : `${m.puntajeGeneral}%`, etiqueta: "Puntaje promedio", detalle: "escala sobre su máximo" },
          { valor: sedesConDatos, etiqueta: "Sedes con datos", detalle: `${sedesEnVerde} en verde` },
        ]}
        lateral={
          <div className="flex items-center gap-4 sm:flex-col sm:gap-2.5">
            <AnilloPorcentaje valor={m.adherenciaGeneral} tamano={128} grosor={7} oscuro etiqueta="Adherencia" />
            <Semaforo tono={m.semaforo} />
          </div>
        }
        acciones={
          <>
            <a href="#exportar" className="boton-hero">
              <Download className="h-4 w-4" aria-hidden="true" />
              Exportar esta vista
            </a>
            <Link href={`/encuestas/${encuesta.id}/resultados`} className="enlace-hero">
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
              Ficha de la encuesta
            </Link>
          </>
        }
      />

      <FiltrosSiau
        valores={{ tipo: periodo.tipo, anio: periodo.anio, mes: periodo.mes ?? 1, trimestre: periodo.trimestre ?? 1, sede: filtros.sede ?? "", servicio: filtros.servicio ?? "", sexo: filtros.sexo ?? "", eps: filtros.eps ?? "" }}
        opciones={{ sedes, servicios, eps: epss, anios: [anioActual - 2, anioActual - 1, anioActual, anioActual + 1] }}
      />

      {m.total === 0 ? (
        <div className="barra-modulo flex flex-col items-center gap-2 px-6 py-10 text-center">
          <Inbox className="h-6 w-6 text-primary" aria-hidden="true" />
          <p className="font-display text-[15px] font-bold text-foreground">Sin encuestas en este periodo</p>
          <p className="max-w-md text-[13px] text-muted-foreground">
            No hay respuestas para {rango.etiqueta} con los filtros elegidos. Cambia el periodo o limpia los filtros; los exportables siguen disponibles abajo.
          </p>
        </div>
      ) : (
        <Tabs defaultValue="general">
          <TabsList className="plan-tabs">
            <TabsTrigger value="general">
              <TrendingUp aria-hidden="true" />
              Visión general
            </TabsTrigger>
            <TabsTrigger value="sedes">
              <Building2 aria-hidden="true" />
              Sedes
              <span className="conteo">{informe.porSede.length}</span>
            </TabsTrigger>
            <TabsTrigger value="preguntas">
              <BarChart3 aria-hidden="true" />
              Por pregunta
              <span className="conteo">{m.porPregunta.length}</span>
            </TabsTrigger>
            <TabsTrigger value="cruces">
              <Users2 aria-hidden="true" />
              Cruces por variable
            </TabsTrigger>
            <TabsTrigger value="sugerencias">
              <MessageSquareText aria-hidden="true" />
              Sugerencias
              <span className="conteo">{m.sugerencias.length}</span>
            </TabsTrigger>
          </TabsList>

          {/* Visión general: tendencia + mejores y peores preguntas */}
          <TabsContent value="general" className="pt-4">
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
              <section className="barra-modulo min-w-0 p-5 xl:col-span-2">
                <EncabezadoSeccion
                  numero="01"
                  titulo="Tendencia mensual de adherencia"
                  bajada={`Referencias: 85 % (cumple) y 70 % (aceptable).${prev && prev.adherenciaGeneral !== null ? ` Periodo anterior: ${prev.adherenciaGeneral}% con ${prev.total} encuestas.` : ""}`}
                />
                <div className="mt-4">
                  <LineaTendencia datos={informe.tendencia} referencia={prev?.adherenciaGeneral ?? null} />
                </div>
              </section>
              <div className="min-w-0 space-y-5">
                <ListaPreguntas titulo="Mejores preguntas" Icono={Sparkles} preguntas={m.mejores} />
                <ListaPreguntas titulo="Preguntas por mejorar" Icono={Gauge} preguntas={m.peores} />
              </div>
            </div>
          </TabsContent>

          {/* Por sede */}
          <TabsContent value="sedes" className="pt-4">
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <section className="barra-modulo min-w-0 p-5">
                <EncabezadoSeccion
                  numero="02"
                  titulo="Ranking de sedes"
                  bajada={`Adherencia general por sede; línea punteada = promedio institucional (${m.adherenciaGeneral ?? "—"}%).`}
                />
                <div className="mt-3">
                  <BarrasRanking datos={informe.porSede.map((s) => ({ nombre: s.valor, valor: s.adherencia, n: s.total }))} referencia={m.adherenciaGeneral} />
                </div>
              </section>
              <section className="barra-modulo min-w-0 overflow-hidden">
                <div className="p-5 pb-0">
                  <EncabezadoSeccion numero="03" titulo="Sede vs. promedio institucional" />
                </div>
                <div className="mt-4 overflow-x-auto">
                  <table className="enc-tabla min-w-[560px]">
                    <thead>
                      <tr>
                        <th className="text-left">Sede</th>
                        <th className="num">Encuestas</th>
                        <th className="num">Adherencia</th>
                        <th className="num">Puntaje</th>
                        <th className="num">vs instit.</th>
                        <th className="text-left">Semáforo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {informe.porSede.map((s) => {
                        const dif = s.adherencia !== null && m.adherenciaGeneral !== null ? Math.round((s.adherencia - m.adherenciaGeneral) * 10) / 10 : null;
                        return (
                          <tr key={s.valor}>
                            <td className="font-semibold text-foreground">{s.valor}</td>
                            <td className="num">{s.total}</td>
                            <td className="num font-semibold text-foreground"><Pct v={s.adherencia} /></td>
                            <td className="num text-muted-foreground"><Pct v={s.puntaje} /></td>
                            <td className={cn("num font-semibold", dif === null ? "text-muted-foreground" : dif >= 0 ? "text-success" : "text-destructive")}>
                              {dif === null ? "—" : `${dif > 0 ? "+" : ""}${dif} pp`}
                            </td>
                            <td><Semaforo tono={s.semaforo} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </TabsContent>

          {/* Por pregunta */}
          <TabsContent value="preguntas" className="space-y-5 pt-4">
            <section className="barra-modulo p-5">
              <EncabezadoSeccion numero="04" titulo="Distribución por carita" bajada="Respuestas de cada pregunta, 100 % apilado." />
              <div className="mt-3">
                <BarrasApiladasCaritas datos={apilado(m.porPregunta)} tonos={tonosEscala} />
              </div>
            </section>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {m.porPregunta.map((p, i) => (
                <article key={p.clave} className="plan-instancia revelar flex flex-col p-5" style={escalon(i)}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="enc-sello">P{p.numero}</span>
                    <Semaforo tono={p.semaforo} />
                  </div>
                  <p className="mt-3 text-[13px] font-semibold leading-snug text-foreground">{p.enunciado}</p>
                  <div className="panel-cifras mt-4 grid grid-cols-3">
                    <div className="dato-mini">
                      <b style={{ color: COLOR_SEMAFORO[p.semaforo] }}><Pct v={p.adherencia} /></b>
                      <span>Adherencia</span>
                    </div>
                    <div className="dato-mini">
                      <b><Pct v={p.puntaje} /></b>
                      <span>Puntaje</span>
                    </div>
                    <div className="dato-mini">
                      <b>{p.n}</b>
                      <span>Respuestas</span>
                    </div>
                  </div>
                  <div className="mt-2.5">
                    <Variacion v={informe.variacionPorPregunta[p.clave] ?? null} />
                  </div>
                  <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-muted">
                    {p.distribucion.filter((d) => d.n > 0).map((d) => (
                      <span key={d.opcionId} style={{ width: `${d.pct}%`, backgroundColor: COLOR_TONO[d.tono ?? "na"] }} title={`${d.texto}: ${d.n} (${d.pct}%)`} />
                    ))}
                  </div>
                  <ul className="mt-2.5 grid grid-cols-1 gap-y-1 text-[11.5px] text-muted-foreground sm:grid-cols-2 sm:gap-x-3">
                    {p.distribucion.map((d) => (
                      <li key={d.opcionId} className="flex min-w-0 items-center gap-1.5">
                        <span className="h-2 w-2 shrink-0 rounded-[3px]" style={{ backgroundColor: COLOR_TONO[d.tono ?? "na"] }} />
                        <span className="truncate" title={d.texto}>{d.texto}</span>
                        <span className="ml-auto shrink-0 font-mono tabular-nums">
                          <b className="font-semibold text-foreground">{d.n}</b> · {d.pct}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
            <section className="barra-modulo p-5">
              <EncabezadoSeccion numero="05" titulo="P2 · Trato del personal por perfil" bajada="Adherencia de cada perfil; línea punteada = adherencia general de P2." />
              <div className="mt-3">
                <BarrasRanking
                  datos={m.porPerfil.map((p) => ({ nombre: p.perfil ?? "", valor: p.adherencia, n: p.validas }))}
                  referencia={m.porPregunta.find((p) => p.clave === "p2")?.adherencia ?? null}
                />
              </div>
            </section>
          </TabsContent>

          {/* Cruces por variable */}
          <TabsContent value="cruces" className="pt-4">
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              {[
                { titulo: "Adherencia × servicio (P1)", datos: informe.porServicio },
                { titulo: "Adherencia × sexo", datos: informe.porSexo },
                { titulo: "Adherencia × EPS", datos: informe.porEps },
                { titulo: "Adherencia × sede", datos: informe.porSede },
              ].map((c, i) => (
                <section key={c.titulo} className="barra-modulo min-w-0 overflow-hidden">
                  <div className="p-5 pb-0">
                    <EncabezadoSeccion numero={String(i + 6).padStart(2, "0")} titulo={c.titulo} />
                  </div>
                  <div className="mt-3 overflow-x-auto">
                    <table className="enc-tabla min-w-[640px]">
                      <thead>
                        <tr>
                          <th className="text-left">Valor</th>
                          <th className="num">n</th>
                          <th className="num">General</th>
                          {m.porPregunta.map((p) => (
                            <th key={p.clave} className="num">P{p.numero}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {c.datos.map((fila) => (
                          <tr key={fila.valor}>
                            <td className="font-semibold text-foreground">{fila.valor}</td>
                            <td className="num">{fila.total}</td>
                            <td className="num font-semibold" style={{ color: fila.semaforo === "muted" ? undefined : COLOR_SEMAFORO[fila.semaforo] }}>
                              <Pct v={fila.adherencia} />
                            </td>
                            {m.porPregunta.map((p) => {
                              const v = fila.porPregunta[p.clave] ?? null;
                              return (
                                <td
                                  key={p.clave}
                                  className="num"
                                  style={{ background: v === null ? undefined : v >= 85 ? "color-mix(in oklch, var(--success) 14%, transparent)" : v >= 70 ? "color-mix(in oklch, var(--warning) 16%, transparent)" : "color-mix(in oklch, var(--destructive) 12%, transparent)" }}
                                >
                                  <Pct v={v} />
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>
          </TabsContent>

          {/* Sugerencias */}
          <TabsContent value="sugerencias" className="pt-4">
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
              <section className="barra-modulo min-w-0 p-5">
                <EncabezadoSeccion numero="10" titulo="Temas de las sugerencias" bajada={`${m.sugerencias.length} comentarios en el periodo, agrupados por palabras clave.`} />
                <ul className="mt-4 space-y-2.5">
                  {temas.map((t) => (
                    <li key={t.tema}>
                      <div className="flex items-baseline justify-between gap-3 text-[13px]">
                        <span className="text-foreground">{t.tema}</span>
                        <b className="font-mono text-[12.5px] font-semibold text-primary">{t.n}</b>
                      </div>
                      <BarraPorcentaje valor={m.sugerencias.length ? (t.n / m.sugerencias.length) * 100 : 0} color="var(--primary)" className="mt-1" />
                    </li>
                  ))}
                  {sinTema > 0 && (
                    <li className="flex items-baseline justify-between gap-3 text-[13px] text-muted-foreground">
                      <span>Otros</span>
                      <b className="font-mono text-[12.5px] font-semibold">{sinTema}</b>
                    </li>
                  )}
                </ul>
              </section>
              <section className="barra-modulo min-w-0 overflow-hidden xl:col-span-2">
                <div className="p-5 pb-0">
                  <EncabezadoSeccion numero="11" titulo="Sugerencias y comentarios (P9)" />
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="enc-tabla min-w-[560px]">
                    <thead>
                      <tr>
                        <th className="text-left">Fecha</th>
                        <th className="text-left">Sede</th>
                        <th className="text-left">Servicio</th>
                        <th className="text-left">Comentario</th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.sugerencias.slice(0, 60).map((s, i) => (
                        <tr key={i}>
                          <td className="whitespace-nowrap font-mono text-[11.5px] text-muted-foreground">{etiquetaFecha(s.fecha)}</td>
                          <td>{s.sede ?? "—"}</td>
                          <td className="text-muted-foreground">{s.servicio ?? "—"}</td>
                          <td className="text-foreground">{s.texto}</td>
                        </tr>
                      ))}
                      {m.sugerencias.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-muted-foreground">Sin comentarios en el periodo.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {m.sugerencias.length > 60 && <p className="mono-label px-5 py-3">Mostrando 60 de {m.sugerencias.length} · el resto va en el CSV/Excel</p>}
              </section>
            </div>
          </TabsContent>
        </Tabs>
      )}

      <ExportablesSiau
        inicial={{ tipo: periodo.tipo, anio: periodo.anio, mes: periodo.mes ?? new Date().getMonth() + 1, trimestre: periodo.trimestre ?? Math.floor(new Date().getMonth() / 3) + 1 }}
        filtros={filtros}
        formatoHref={`/api/encuestas/${encuesta.slug}/formato-docx`}
        pie={
          exportaciones.length > 0 && (
            <details className="group rounded-[12px] border border-border/70 bg-[color-mix(in_oklch,var(--foreground)_2%,var(--card))]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <span className="mono-label flex items-center gap-2">
                  <History className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  Registro de descargas · últimas {exportaciones.length}
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <ul className="divide-y divide-border/50 border-t border-border/60 text-[12.5px]">
                {exportaciones.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                    <span className="text-foreground">{e.description}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {e.user?.fullName ?? "—"} · {etiquetaFecha(e.createdAt)} {etiquetaHora(e.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )
        }
      />

      <p className="font-mono text-[10.5px] leading-relaxed text-muted-foreground">
        Consulta: {consulta || "periodo actual"} · Adherencia = respuestas favorables sobre válidas (Res. 0256 de 2016); puntaje = promedio de la escala sobre su máximo. Fórmulas en lib/encuestas/metrics.ts.
      </p>
    </div>
  );
}

function ListaPreguntas({ titulo, Icono, preguntas }: { titulo: string; Icono: LucideIcon; preguntas: MetricaPregunta[] }) {
  return (
    <section className="barra-modulo p-5">
      <EncabezadoSeccion Icono={Icono} titulo={titulo} />
      <ul className="mt-3 space-y-2.5">
        {preguntas.map((p) => (
          <li key={p.clave}>
            <div className="flex items-center gap-2.5 text-[12.5px]">
              <span className="enc-sello">P{p.numero}</span>
              <span className="min-w-0 flex-1 truncate text-foreground" title={p.enunciado}>{p.enunciado}</span>
              <b className="mono-dato shrink-0 text-[12.5px] font-semibold" style={{ color: COLOR_SEMAFORO[p.semaforo] }}>
                <Pct v={p.adherencia} />
              </b>
            </div>
            {p.adherencia !== null && <BarraPorcentaje valor={p.adherencia} className="mt-1.5" />}
          </li>
        ))}
      </ul>
    </section>
  );
}
