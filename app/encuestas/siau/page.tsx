import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowDownRight, ArrowUpRight, BarChart3, Building2, FileSpreadsheet, FileText, Gauge, MessageSquareText, Minus, Sparkles, TrendingUp, Users2 } from "lucide-react";
import { requireTutorOrAdmin } from "@/lib/auth-helpers";
import { getInformeSiau, getEstructuraSiau, type MetricaPregunta } from "@/lib/encuestas/metrics";
import { leerPeriodo, periodoActual } from "@/lib/encuestas/periodo-url";
import { FiltrosSiau } from "@/components/encuestas/filtros-siau";
import { LineaTendencia, BarrasApiladasCaritas, BarrasRanking, COLOR_TONO } from "@/components/encuestas/graficas-siau";
import { etiquetaFecha } from "@/components/training-plans/labels";
import { leerConfig } from "@/lib/encuestas/tipos";
import { cn } from "@/lib/utils";

const CLASE_SEMAFORO = {
  success: "bg-success/15 text-success",
  warning: "bg-warning/18 text-warning-foreground",
  destructive: "bg-destructive/10 text-destructive",
  muted: "bg-muted text-muted-foreground",
} as const;
const TEXTO_SEMAFORO = { success: "Cumple", warning: "Aceptable", destructive: "Crítico", muted: "Sin datos" } as const;

/** Temas de las sugerencias, por palabras clave (P9). */
const TEMAS: { tema: string; claves: RegExp }[] = [
  { tema: "Trato y amabilidad", claves: /amab|trato|respet|grosero|mal genio|atenci[oó]n/i },
  { tema: "Oportunidad y esperas", claves: /esper|demora|cita|turno|ficha|tiempo|tard|fila|agenda/i },
  { tema: "Instalaciones y aseo", claves: /limpi|aseo|baño|instalac|silla|comod|infraestruct/i },
  { tema: "Información y comunicación", claves: /inform|explic|comunic|duda|claridad/i },
  { tema: "Medicamentos y farmacia", claves: /medicament|farmacia|droga|f[oó]rmula/i },
  { tema: "Personal insuficiente", claves: /m[aá]s m[eé]dic|m[aá]s personal|falta.*(m[eé]dic|enfermer)|un solo/i },
];

function Variacion({ v }: { v: number | null }) {
  if (v === null) return <span className="text-[11px] text-muted-foreground">sin periodo previo</span>;
  const Icono = v > 0 ? ArrowUpRight : v < 0 ? ArrowDownRight : Minus;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[11.5px] font-bold", v > 0 ? "text-success" : v < 0 ? "text-destructive" : "text-muted-foreground")}>
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
 */
export default async function CentroDatosSiauPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireTutorOrAdmin();
  const sp = await searchParams;
  const params = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
  const periodo = leerPeriodo(params) ?? periodoActual((sp.tipo as "mensual" | "trimestral" | "anual") || "mensual");
  const filtros = { sede: sp.sede || undefined, servicio: sp.servicio || undefined, sexo: sp.sexo || undefined, eps: sp.eps || undefined };

  const [informe, estructura] = await Promise.all([getInformeSiau(periodo, filtros), getEstructuraSiau()]);
  if (!informe || !estructura) notFound();
  const { metricas: m, metricasPrevias: prev, rango, rangoPrevio } = informe;
  const encuesta = estructura.encuesta;
  const opcionesDe = (rol?: string, estilo?: string) => estructura.encuesta.pages.flatMap((p) => p.questions).find((q) => (rol && leerConfig(q.config).rol === rol) || (estilo && leerConfig(q.config).estilo === estilo));
  const sedes = leerConfig(opcionesDe("municipio")?.config).opciones?.map((o) => o.texto) ?? [];
  const servicios = leerConfig(opcionesDe(undefined, "servicios")?.config).opciones?.map((o) => o.texto) ?? [];
  const epss = leerConfig(opcionesDe("eps")?.config).opciones?.map((o) => o.texto) ?? [];
  const anioActual = new Date().getFullYear();
  const consulta = params.toString();
  const urlExport = `tipo=${periodo.tipo}&anio=${periodo.anio}${periodo.mes ? `&mes=${periodo.mes}` : ""}${periodo.trimestre ? `&trimestre=${periodo.trimestre}` : ""}${filtros.sede ? `&sede=${encodeURIComponent(filtros.sede)}` : ""}`;

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

  const kpis = [
    { etiqueta: "Encuestas en el periodo", valor: String(m.total), detalle: prev ? `${prev.total} en el periodo anterior` : "", Icono: Users2 },
    { etiqueta: "Adherencia general", valor: m.adherenciaGeneral === null ? "—" : `${m.adherenciaGeneral}%`, detalle: TEXTO_SEMAFORO[m.semaforo], Icono: Gauge, semaforo: m.semaforo, variacion: informe.variacionGeneral },
    { etiqueta: "Puntaje promedio", valor: m.puntajeGeneral === null ? "—" : `${m.puntajeGeneral}%`, detalle: "promedio de la escala sobre su máximo", Icono: TrendingUp },
    { etiqueta: "Sedes con datos", valor: String(informe.porSede.filter((s) => s.valor !== "Sin dato").length), detalle: `${informe.porSede.filter((s) => s.semaforo === "success").length} en verde`, Icono: Building2 },
  ];

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 py-8 sm:px-6">
      <Link href="/encuestas" className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Encuestas
      </Link>

      {/* Héroe */}
      <header className="comite-hero p-6 sm:p-8">
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.2em] text-white/70">
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
              Centro de datos · {encuesta.code}
            </p>
            <h1 className="mt-2 font-display text-[clamp(1.6rem,3.4vw,2.3rem)] font-extrabold leading-tight tracking-tight">{encuesta.title}</h1>
            <p className="mt-2 text-[13.5px] text-white/80">
              {rango.etiqueta}
              {filtros.sede ? ` · ${filtros.sede}` : ""}{filtros.servicio ? ` · ${filtros.servicio}` : ""}{filtros.sexo ? ` · ${filtros.sexo}` : ""}{filtros.eps ? ` · ${filtros.eps}` : ""} · comparado con {rangoPrevio.etiqueta}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={`/api/encuestas/siau/siho?${urlExport}`} className="comite-vidrio inline-flex items-center gap-1.5 px-3.5 py-2 text-[12.5px] font-bold text-white">
              <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
              Excel SIHO del periodo
            </a>
            <a href={`/api/encuestas/${encuesta.slug}/formato-docx`} className="comite-vidrio inline-flex items-center gap-1.5 px-3.5 py-2 text-[12.5px] font-bold text-white">
              <FileText className="h-4 w-4" aria-hidden="true" />
              Formato (.docx)
            </a>
          </div>
        </div>
        <div className="relative mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.etiqueta} className="comite-vidrio p-4">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/15"><k.Icono className="h-4 w-4" aria-hidden="true" /></span>
              <p className={cn("mt-3 font-display text-[1.7rem] font-extrabold leading-none tabular-nums", k.semaforo === "success" ? "text-[#7ee2b8]" : k.semaforo === "warning" ? "text-[#ffd76a]" : k.semaforo === "destructive" ? "text-[#ff9b9b]" : "")}>{k.valor}</p>
              <p className="mt-1 text-[12px] font-semibold text-white/85">{k.etiqueta}</p>
              <p className="text-[11px] text-white/60">{k.detalle}</p>
              {"variacion" in k && k.variacion !== undefined && <p className="mt-1 [&_span]:text-white/85"><Variacion v={k.variacion} /></p>}
            </div>
          ))}
        </div>
      </header>

      <FiltrosSiau
        valores={{ tipo: periodo.tipo, anio: periodo.anio, mes: periodo.mes ?? 1, trimestre: periodo.trimestre ?? 1, sede: filtros.sede ?? "", servicio: filtros.servicio ?? "", sexo: filtros.sexo ?? "", eps: filtros.eps ?? "" }}
        opciones={{ sedes, servicios, eps: epss, anios: [anioActual - 2, anioActual - 1, anioActual, anioActual + 1] }}
      />

      {m.total === 0 ? (
        <p className="comite-tarjeta p-8 text-center text-sm text-muted-foreground">No hay encuestas en este periodo con los filtros elegidos.</p>
      ) : (
        <>
          {/* Vista general: tendencia + top/peores */}
          <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className="comite-tarjeta p-6 xl:col-span-2">
              <h2 className="flex items-center gap-2 font-display text-[15px] font-bold text-foreground"><TrendingUp className="h-4 w-4 text-primary" aria-hidden="true" />Tendencia mensual de adherencia</h2>
              <p className="mt-1 text-[12px] text-muted-foreground">Líneas de referencia: 85 % (cumple) y 70 % (aceptable). {prev && prev.adherenciaGeneral !== null ? `Periodo anterior: ${prev.adherenciaGeneral}% con ${prev.total} encuestas.` : ""}</p>
              <div className="mt-4"><LineaTendencia datos={informe.tendencia} referencia={prev?.adherenciaGeneral ?? null} /></div>
            </div>
            <div className="space-y-5">
              <div className="comite-tarjeta p-5">
                <h3 className="flex items-center gap-2 font-display text-[14px] font-bold text-foreground"><Sparkles className="h-4 w-4 text-success" aria-hidden="true" />Mejores preguntas</h3>
                <ul className="mt-3 space-y-2">
                  {m.mejores.map((p) => (
                    <li key={p.clave} className="flex items-center justify-between gap-3 rounded-xl bg-success/10 px-3 py-2 text-[13px]"><span className="min-w-0 truncate"><b>P{p.numero}</b> · {p.enunciado}</span><b className="shrink-0 text-success">{p.adherencia}%</b></li>
                  ))}
                </ul>
              </div>
              <div className="comite-tarjeta p-5">
                <h3 className="flex items-center gap-2 font-display text-[14px] font-bold text-foreground"><Gauge className="h-4 w-4 text-destructive" aria-hidden="true" />Preguntas por mejorar</h3>
                <ul className="mt-3 space-y-2">
                  {m.peores.map((p) => (
                    <li key={p.clave} className="flex items-center justify-between gap-3 rounded-xl bg-destructive/10 px-3 py-2 text-[13px]"><span className="min-w-0 truncate"><b>P{p.numero}</b> · {p.enunciado}</span><b className={cn("shrink-0", p.semaforo === "success" ? "text-success" : p.semaforo === "warning" ? "text-warning-foreground" : "text-destructive")}>{p.adherencia}%</b></li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* Por sede */}
          <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <div className="comite-tarjeta p-6">
              <h2 className="flex items-center gap-2 font-display text-[15px] font-bold text-foreground"><Building2 className="h-4 w-4 text-primary" aria-hidden="true" />Ranking de sedes</h2>
              <p className="mt-1 text-[12px] text-muted-foreground">Adherencia general por sede; línea punteada = promedio institucional ({m.adherenciaGeneral ?? "—"}%).</p>
              <div className="mt-3"><BarrasRanking datos={informe.porSede.map((s) => ({ nombre: s.valor, valor: s.adherencia, n: s.total }))} referencia={m.adherenciaGeneral} /></div>
            </div>
            <div className="comite-tarjeta overflow-x-auto p-0">
              <h2 className="flex items-center gap-2 px-6 pt-6 font-display text-[15px] font-bold text-foreground"><Building2 className="h-4 w-4 text-primary" aria-hidden="true" />Sede vs. promedio institucional</h2>
              <table className="mt-4 w-full min-w-[560px] text-[12.5px]">
                <thead><tr className="border-y border-border/60 bg-muted/40 text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground"><th className="px-5 py-2.5 text-left">Sede</th><th className="px-3 py-2.5 text-right">Encuestas</th><th className="px-3 py-2.5 text-right">Adherencia</th><th className="px-3 py-2.5 text-right">Puntaje</th><th className="px-3 py-2.5 text-right">vs institucional</th><th className="px-3 py-2.5 text-left">Semáforo</th></tr></thead>
                <tbody className="divide-y divide-border/40">
                  {informe.porSede.map((s) => {
                    const dif = s.adherencia !== null && m.adherenciaGeneral !== null ? Math.round((s.adherencia - m.adherenciaGeneral) * 10) / 10 : null;
                    return (
                      <tr key={s.valor} className="hover:bg-primary/[0.04]">
                        <td className="px-5 py-2 font-semibold text-foreground">{s.valor}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{s.total}</td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums"><Pct v={s.adherencia} /></td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground"><Pct v={s.puntaje} /></td>
                        <td className={cn("px-3 py-2 text-right font-semibold tabular-nums", dif === null ? "text-muted-foreground" : dif >= 0 ? "text-success" : "text-destructive")}>{dif === null ? "—" : `${dif > 0 ? "+" : ""}${dif} pp`}</td>
                        <td className="px-3 py-2"><span className={cn("rounded-md px-2 py-0.5 text-[10.5px] font-bold", CLASE_SEMAFORO[s.semaforo])}>{TEXTO_SEMAFORO[s.semaforo]}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Por pregunta */}
          <section className="space-y-4">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold tracking-tight text-foreground"><BarChart3 className="h-4 w-4 text-primary" aria-hidden="true" />Por pregunta</h2>
            <div className="comite-tarjeta p-6">
              <p className="text-[12px] text-muted-foreground">Distribución de respuestas por carita (100 % apilado).</p>
              <div className="mt-3"><BarrasApiladasCaritas datos={apilado(m.porPregunta)} tonos={tonosEscala} /></div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {m.porPregunta.map((p) => (
                <article key={p.clave} className="comite-tarjeta p-5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[13px] font-semibold leading-snug text-foreground"><b className="text-primary">P{p.numero}</b> · {p.enunciado}</p>
                    <span className={cn("shrink-0 rounded-md px-2 py-0.5 text-[10.5px] font-bold", CLASE_SEMAFORO[p.semaforo])}>{TEXTO_SEMAFORO[p.semaforo]}</span>
                  </div>
                  <div className="mt-3 flex items-end gap-4">
                    <div><p className="font-display text-[1.7rem] font-extrabold leading-none tabular-nums text-foreground"><Pct v={p.adherencia} /></p><p className="text-[11px] text-muted-foreground">adherencia</p></div>
                    <div><p className="font-display text-[1.2rem] font-extrabold leading-none tabular-nums text-muted-foreground"><Pct v={p.puntaje} /></p><p className="text-[11px] text-muted-foreground">puntaje</p></div>
                    <div><p className="font-display text-[1.2rem] font-extrabold leading-none tabular-nums text-muted-foreground">{p.n}</p><p className="text-[11px] text-muted-foreground">respuestas</p></div>
                  </div>
                  <div className="mt-2"><Variacion v={informe.variacionPorPregunta[p.clave] ?? null} /></div>
                  <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    {p.distribucion.filter((d) => d.n > 0).map((d) => (
                      <span key={d.opcionId} style={{ width: `${d.pct}%`, backgroundColor: COLOR_TONO[d.tono ?? "na"] }} title={`${d.texto}: ${d.n} (${d.pct}%)`} />
                    ))}
                  </div>
                  <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11.5px] text-muted-foreground">
                    {p.distribucion.map((d) => (
                      <li key={d.opcionId} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLOR_TONO[d.tono ?? "na"] }} />{d.texto}: <b className="text-foreground">{d.n}</b> ({d.pct}%)</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
            <div className="comite-tarjeta p-6">
              <h3 className="font-display text-[14px] font-bold text-foreground">P2 · Trato del personal por perfil</h3>
              <div className="mt-3"><BarrasRanking datos={m.porPerfil.map((p) => ({ nombre: p.perfil ?? "", valor: p.adherencia, n: p.validas }))} referencia={m.porPregunta.find((p) => p.clave === "p2")?.adherencia ?? null} /></div>
            </div>
          </section>

          {/* Por variable */}
          <section className="space-y-4">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold tracking-tight text-foreground"><Users2 className="h-4 w-4 text-primary" aria-hidden="true" />Cruces por variable</h2>
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              {[
                { titulo: "Adherencia × servicio (P1)", datos: informe.porServicio },
                { titulo: "Adherencia × sexo", datos: informe.porSexo },
                { titulo: "Adherencia × EPS", datos: informe.porEps },
                { titulo: "Adherencia × sede", datos: informe.porSede },
              ].map((c) => (
                <div key={c.titulo} className="comite-tarjeta overflow-x-auto p-0">
                  <h3 className="px-5 pt-5 font-display text-[14px] font-bold text-foreground">{c.titulo}</h3>
                  <table className="mt-3 w-full min-w-[640px] text-[12px]">
                    <thead><tr className="border-y border-border/60 bg-muted/40 text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground"><th className="px-4 py-2 text-left">Valor</th><th className="px-2 py-2 text-right">n</th><th className="px-2 py-2 text-right">General</th>{m.porPregunta.map((p) => <th key={p.clave} className="px-2 py-2 text-right">P{p.numero}</th>)}</tr></thead>
                    <tbody className="divide-y divide-border/40">
                      {c.datos.map((fila) => (
                        <tr key={fila.valor}>
                          <td className="px-4 py-1.5 font-semibold text-foreground">{fila.valor}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{fila.total}</td>
                          <td className={cn("px-2 py-1.5 text-right font-bold tabular-nums", fila.semaforo === "success" ? "text-success" : fila.semaforo === "warning" ? "text-warning-foreground" : fila.semaforo === "destructive" ? "text-destructive" : "")}><Pct v={fila.adherencia} /></td>
                          {m.porPregunta.map((p) => {
                            const v = fila.porPregunta[p.clave] ?? null;
                            return <td key={p.clave} className="px-2 py-1.5 text-right tabular-nums" style={{ background: v === null ? undefined : v >= 85 ? "color-mix(in oklch, var(--success) 14%, transparent)" : v >= 70 ? "color-mix(in oklch, var(--warning) 16%, transparent)" : "color-mix(in oklch, var(--destructive) 12%, transparent)" }}><Pct v={v} /></td>;
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </section>

          {/* Sugerencias */}
          <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className="comite-tarjeta p-5">
              <h2 className="flex items-center gap-2 font-display text-[15px] font-bold text-foreground"><MessageSquareText className="h-4 w-4 text-primary" aria-hidden="true" />Temas de las sugerencias</h2>
              <p className="mt-1 text-[12px] text-muted-foreground">{m.sugerencias.length} comentarios en el periodo, agrupados por palabras clave.</p>
              <ul className="mt-3 space-y-2">
                {temas.map((t) => (
                  <li key={t.tema} className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2 text-[13px]"><span>{t.tema}</span><b className="text-primary">{t.n}</b></li>
                ))}
                {sinTema > 0 && <li className="flex items-center justify-between rounded-xl bg-muted/30 px-3 py-2 text-[13px] text-muted-foreground"><span>Otros</span><b>{sinTema}</b></li>}
              </ul>
            </div>
            <div className="comite-tarjeta overflow-x-auto p-0 xl:col-span-2">
              <h2 className="px-5 pt-5 font-display text-[15px] font-bold text-foreground">Sugerencias y comentarios (P9)</h2>
              <table className="mt-3 w-full min-w-[560px] text-[12.5px]">
                <thead><tr className="border-y border-border/60 bg-muted/40 text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground"><th className="px-5 py-2 text-left">Fecha</th><th className="px-3 py-2 text-left">Sede</th><th className="px-3 py-2 text-left">Servicio</th><th className="px-3 py-2 text-left">Comentario</th></tr></thead>
                <tbody className="divide-y divide-border/40">
                  {m.sugerencias.slice(0, 60).map((s, i) => (
                    <tr key={i}><td className="whitespace-nowrap px-5 py-2 text-muted-foreground">{etiquetaFecha(s.fecha)}</td><td className="px-3 py-2">{s.sede ?? "—"}</td><td className="px-3 py-2 text-muted-foreground">{s.servicio ?? "—"}</td><td className="px-3 py-2 text-foreground">{s.texto}</td></tr>
                  ))}
                  {m.sugerencias.length === 0 && <tr><td colSpan={4} className="px-5 py-6 text-center text-muted-foreground">Sin comentarios en el periodo.</td></tr>}
                </tbody>
              </table>
              {m.sugerencias.length > 60 && <p className="px-5 py-3 text-[12px] text-muted-foreground">Mostrando 60 de {m.sugerencias.length}; el resto va en el CSV/Excel.</p>}
            </div>
          </section>
        </>
      )}
      <p className="text-[11.5px] text-muted-foreground">Consulta: {consulta || "periodo actual"} · Adherencia = respuestas favorables sobre válidas (Res. 0256 de 2016); puntaje = promedio de la escala sobre su máximo. Fórmulas en lib/encuestas/metrics.ts.</p>
    </div>
  );
}
