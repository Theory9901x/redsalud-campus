import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BarChart3, CheckCircle2, Clock, FileSpreadsheet, FileText, Users2 } from "lucide-react";
import { requireSurveyAccess } from "@/lib/auth-helpers";
import { getResultadosEncuesta } from "@/lib/encuestas/consultas";
import { GraficaEvolucion, GraficaOpciones, GraficaDistribucion } from "@/components/encuestas/graficas-resultados";
import { cn } from "@/lib/utils";

/**
 * PANEL DE RESULTADOS: tabulación y estadísticas de una encuesta.
 * KPIs de participación, cumplimiento con semaforización, puntaje por
 * bloque cuando la encuesta califica, evolución diaria y detalle por
 * pregunta. Solo para quien gestiona la encuesta.
 */
export default async function ResultadosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSurveyAccess(id).catch(() => notFound());

  const datos = await getResultadosEncuesta(id);
  if (!datos) notFound();
  const { encuesta, totales, minutosPromedio, puntaje, cumplimiento, evolucion, porPregunta } = datos;
  const acento = encuesta.themeColor || "#6D3BF5";

  const semaforo =
    cumplimiento.porcentaje >= 85
      ? { texto: "Cumple", clase: "border-success/40 bg-success/10 text-success" }
      : cumplimiento.porcentaje >= 70
        ? { texto: "Aceptable", clase: "border-warning/50 bg-warning/15 text-warning-foreground" }
        : { texto: "Crítico", clase: "border-destructive/40 bg-destructive/10 text-destructive" };

  const kpis = [
    { etiqueta: "Respuestas totales", valor: String(totales.respuestas), Icono: Users2 },
    { etiqueta: "Completadas", valor: String(totales.completadas), Icono: CheckCircle2 },
    { etiqueta: "Parciales (abandonos)", valor: String(totales.parciales), Icono: BarChart3 },
    {
      etiqueta: "Tasa de finalización",
      valor: `${totales.tasaFinalizacion}%`,
      detalle: minutosPromedio !== null ? `${minutosPromedio} min promedio` : undefined,
      Icono: Clock,
    },
  ];

  return (
    <main className="canvas-vivo min-h-screen">
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        <Link
          href="/encuestas"
          className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Encuestas
        </Link>

        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: acento }}>
              Resultados · {encuesta.code}
            </p>
            <h1 className="mt-1 font-display text-[clamp(1.6rem,3.4vw,2.1rem)] font-extrabold leading-tight tracking-tight text-foreground">
              {encuesta.title}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/encuestas/${id}/respuestas`}
              className="rounded-xl border border-border/60 bg-card/70 px-4 py-2.5 text-[13px] font-bold text-foreground transition-colors hover:border-primary/40"
            >
              Respuestas
            </Link>
            <a
              href={`/api/encuestas/${encuesta.slug}/csv`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-card/70 px-4 py-2.5 text-[13px] font-bold text-foreground transition-colors hover:border-primary/40"
            >
              <FileSpreadsheet className="h-4 w-4" />
              CSV
            </a>
            <a
              href={`/api/encuestas/${encuesta.slug}/informe`}
              className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-bold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: acento }}
            >
              <FileText className="h-4 w-4" />
              Informe PDF
            </a>
          </div>
        </header>

        {/* Cumplimiento con semaforización */}
        <section className="surface-vivo">
          <div className="flex flex-wrap items-center justify-between gap-4 p-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                {cumplimiento.base === "puntaje" ? "Cumplimiento general (acierto)" : "Cumplimiento general (finalización)"}
              </p>
              <p className="mt-1 font-display text-[2.8rem] font-black leading-none tracking-tight cifra-vivo">
                {cumplimiento.porcentaje}%
              </p>
            </div>
            <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] font-bold", semaforo.clase)}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {semaforo.texto}
            </span>
          </div>
        </section>

        {/* KPIs */}
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Indicadores de participación">
          {kpis.map((k) => (
            <div key={k.etiqueta} className="surface-vivo">
              <div className="flex h-full flex-col justify-between gap-3 p-5">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${acento}1a`, color: acento }}
                >
                  <k.Icono className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                </span>
                <div>
                  <p className="font-display text-[1.75rem] font-extrabold leading-none tracking-tight tabular-nums text-foreground">
                    {k.valor}
                  </p>
                  <p className="mt-1.5 text-[12px] leading-tight text-muted-foreground">{k.etiqueta}</p>
                  {k.detalle && <p className="text-[11px] text-muted-foreground/80">{k.detalle}</p>}
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* Puntaje por bloque (solo si la encuesta califica) */}
        {puntaje && puntaje.porBloque.length > 0 && (
          <section className="surface-lumen p-6">
            <h2 className="font-display text-[15px] font-bold text-foreground">Puntaje por bloque</h2>
            <div className="mt-4 space-y-4">
              {puntaje.porBloque.map((b) => {
                const color = b.porcentaje >= 85 ? "var(--success)" : b.porcentaje >= 70 ? "var(--warning)" : "var(--destructive)";
                return (
                  <div key={b.pageId}>
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-[13.5px] font-semibold text-foreground">{b.titulo}</p>
                      <p className="shrink-0 text-[13px] font-bold tabular-nums" style={{ color }}>
                        {b.obtenido}/{b.posible} ({b.porcentaje}%)
                      </p>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full" style={{ width: `${b.porcentaje}%`, backgroundColor: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Evolución */}
        {evolucion.length > 1 && (
          <section className="surface-lumen p-6">
            <h2 className="font-display text-[15px] font-bold text-foreground">Evolución de respuestas</h2>
            <GraficaEvolucion datos={evolucion} acento={acento} />
          </section>
        )}

        {/* Por pregunta */}
        <div className="space-y-5">
          {porPregunta.map((p) => (
            <section key={p.id} className="surface-lumen p-6">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-[14.5px] font-semibold leading-snug text-foreground">{p.prompt}</h3>
                <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                  {p.respuestas} {p.respuestas === 1 ? "respuesta" : "respuestas"}
                </span>
              </div>
              {p.aciertos != null && (
                <span
                  className="mt-2 inline-block rounded-full px-2.5 py-1 text-[11px] font-bold"
                  style={{ backgroundColor: `${acento}1a`, color: acento }}
                >
                  Aciertos: {p.aciertos}%
                </span>
              )}

              <div className="mt-4">
                {p.opciones ? (
                  <GraficaOpciones opciones={p.opciones} acento={acento} />
                ) : p.distribucion ? (
                  <GraficaDistribucion distribucion={p.distribucion} promedio={p.promedio ?? null} acento={acento} />
                ) : (
                  <ListaTextos textos={p.textos ?? []} />
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}

function ListaTextos({ textos }: { textos: string[] }) {
  if (textos.length === 0) return <p className="text-[13px] italic text-muted-foreground">Sin respuestas de texto.</p>;
  return (
    <ul className="space-y-1.5">
      {textos.slice(0, 12).map((t, i) => (
        <li key={i} className="rounded-xl bg-muted/40 px-4 py-2.5 text-[13px] text-foreground">
          “{t}”
        </li>
      ))}
      {textos.length > 12 && (
        <li className="px-1 text-[12px] text-muted-foreground">y {textos.length - 12} más — completas en el CSV.</li>
      )}
    </ul>
  );
}
