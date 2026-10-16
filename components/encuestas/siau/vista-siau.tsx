import Link from "next/link";
import { ArrowLeft, BarChart3, Building2, Gauge, Inbox, MessageSquareText, Sparkles, TrendingUp, Users2 } from "lucide-react";
import type { InformeSiau, Periodo } from "@/lib/encuestas/metrics";
import { TEMAS_SUGERENCIAS } from "@/lib/encuestas/temas";
import { etiquetaFecha, etiquetaHora } from "@/components/training-plans/labels";
import { FiltrosSiau } from "@/components/encuestas/filtros-siau";
import { LineaTendencia } from "@/components/encuestas/graficas-siau";
import { ExportablesSiau } from "@/components/encuestas/exportables-siau";
import { CabeceraSiau } from "@/components/encuestas/siau/cabecera-siau";
import { PestanasSiau } from "@/components/encuestas/siau/pestanas-siau";
import { RankingSiau } from "@/components/encuestas/siau/ranking-siau";
import { LeyendaCaritas, ListaPreguntasSiau, TopPreguntas } from "@/components/encuestas/siau/preguntas-siau";
import { CrucesSiau } from "@/components/encuestas/siau/cruces-siau";
import { SugerenciasSiau } from "@/components/encuestas/siau/sugerencias-siau";
import { SEM_DE_NIVEL } from "@/components/encuestas/siau/semaforo";

/** Texto con espacios normalizados (U+202F y similares) para no desajustar la hidratación. */
const plano = (s: string) => s.replace(/\s/g, " ");

export type ExportacionRegistrada = { id: string; createdAt: Date; description: string | null; user: { fullName: string } | null };

/**
 * VISTA del centro de datos SIAU (solo presentación: recibe el informe ya
 * calculado). Se lee de arriba abajo:
 *
 *   1. Cabecera: la adherencia como instrumento (anillo + semáforo) y las
 *      lecturas del periodo (encuestas, variación, puntaje, sedes).
 *   2. Barra de filtros en una fila (periodo + variables), con fichas.
 *   3. Análisis en pestañas: visión general, sedes, preguntas, cruces y
 *      sugerencias.
 *   4. Estación ÚNICA de exportación: todas las descargas de la encuesta
 *      (las del periodo y las de histórico completo) y su registro.
 */
export function VistaSiau({
  informe,
  encuesta,
  opciones,
  periodo,
  filtros,
  consulta,
  exportaciones,
}: {
  informe: InformeSiau;
  encuesta: { id: string; code: string; title: string; slug: string };
  opciones: { sedes: string[]; servicios: string[]; eps: string[] };
  periodo: Periodo;
  filtros: { sede?: string; servicio?: string; sexo?: string; eps?: string };
  consulta: string;
  exportaciones: ExportacionRegistrada[];
}) {
  const { metricas: m, metricasPrevias: prev, rango, rangoPrevio } = informe;
  const hoy = new Date();
  const anioActual = hoy.getFullYear();
  const anios = [anioActual - 2, anioActual - 1, anioActual, anioActual + 1];

  // Sugerencias: temas por palabras clave (calculados aquí; las RegExp no viajan al cliente).
  const temas = TEMAS_SUGERENCIAS.map((t) => ({ tema: t.tema, n: m.sugerencias.filter((s) => t.claves.test(s.texto)).length }))
    .filter((t) => t.n > 0)
    .sort((a, b) => b.n - a.n);
  const sugerencias = m.sugerencias.map((s) => ({
    fecha: plano(etiquetaFecha(s.fecha)),
    sede: s.sede,
    servicio: s.servicio,
    texto: s.texto,
    temas: TEMAS_SUGERENCIAS.filter((t) => t.claves.test(s.texto)).map((t) => t.tema),
  }));

  const conteoSedes = (nivel: "success" | "warning" | "destructive") => informe.porSede.filter((s) => s.semaforo === nivel).length;
  const conteoPreguntas = (nivel: "success" | "warning" | "destructive") => m.porPregunta.filter((p) => p.semaforo === nivel).length;
  const adherenciaP2 = m.porPregunta.find((p) => p.clave === "p2")?.adherencia ?? null;
  const preguntasCruce = m.porPregunta.map((p) => ({ clave: p.clave, numero: p.numero }));
  const sinCruce = (lista: typeof informe.porSede) => lista.map((c) => ({ valor: c.valor, total: c.total, adherencia: c.adherencia, porPregunta: c.porPregunta }));

  const pestanas = [
    {
      id: "general",
      etiqueta: "Visión general",
      icono: <TrendingUp aria-hidden="true" />,
      contenido: (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <section className="siau-sup siau-tarjeta flex min-w-0 flex-col xl:col-span-2">
            <h2 className="siau-h2">
              <i>01</i>Tendencia mensual de adherencia
            </h2>
            <p className="siau-bajada">
              Líneas de referencia: 85 % (cumple) y 70 % (aceptable).
              {prev && prev.adherenciaGeneral !== null ? ` Periodo anterior: ${prev.adherenciaGeneral}% con ${prev.total} encuestas.` : ""}
            </p>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
              <span className="siau-mono inline-flex items-center gap-1.5">
                <i className="h-0.5 w-4 rounded bg-primary" /> Adherencia
              </span>
              <span className="siau-mono inline-flex items-center gap-1.5">
                <i className="h-0 w-4 border-t border-dashed border-muted-foreground" /> Puntaje
              </span>
            </div>
            <div className="mt-2 flex min-h-64 flex-1 flex-col [&>*]:flex-1">
              <LineaTendencia datos={informe.tendencia} referencia={prev?.adherenciaGeneral ?? null} />
            </div>
          </section>
          <section className="siau-sup siau-tarjeta min-w-0">
            <h2 className="siau-h2">
              <Gauge aria-hidden="true" />
              Semáforo de preguntas
            </h2>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(
                [
                  ["success", "Cumplen"],
                  ["warning", "Aceptables"],
                  ["destructive", "Críticas"],
                ] as const
              ).map(([nivel, texto]) => (
                <div key={nivel} className="siau-pozo px-3 py-2.5" data-siau-sem={SEM_DE_NIVEL[nivel]}>
                  <span className="siau-punto" />
                  <b className="mt-1.5 block font-mono text-[1.35rem] font-semibold leading-none text-foreground">{conteoPreguntas(nivel)}</b>
                  <span className="siau-mono !text-[0.52rem]">{texto}</span>
                </div>
              ))}
            </div>
            <h3 className="siau-mono mt-5 inline-flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              Mejores preguntas
            </h3>
            <TopPreguntas preguntas={m.mejores} />
            <h3 className="siau-mono mt-5 inline-flex items-center gap-1.5">
              <Gauge className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              Por mejorar
            </h3>
            <TopPreguntas preguntas={m.peores} />
          </section>
        </div>
      ),
    },
    {
      id: "sedes",
      etiqueta: "Sedes",
      icono: <Building2 aria-hidden="true" />,
      conteo: informe.porSede.length,
      contenido: (
        <section className="siau-sup siau-tarjeta min-w-0">
          <h2 className="siau-h2">
            <i>02</i>Ranking de sedes
          </h2>
          <p className="siau-bajada">Adherencia general por sede, de mayor a menor. La marca vertical es el promedio institucional ({m.adherenciaGeneral ?? "—"}%).</p>
          <div className="mt-4">
            <RankingSiau
              filas={informe.porSede.map((s) => ({ nombre: s.valor, valor: s.adherencia, n: s.total, puntaje: s.puntaje }))}
              referencia={m.adherenciaGeneral}
              etiquetaReferencia="institucional"
            />
          </div>
        </section>
      ),
    },
    {
      id: "preguntas",
      etiqueta: "Por pregunta",
      icono: <BarChart3 aria-hidden="true" />,
      conteo: m.porPregunta.length,
      contenido: (
        <div className="space-y-5">
          <section className="siau-sup siau-tarjeta min-w-0">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="siau-h2">
                  <i>03</i>Adherencia por pregunta
                </h2>
                <p className="siau-bajada">Favorables sobre válidas, con la distribución de respuestas. Despliega una pregunta para ver el conteo por opción.</p>
              </div>
              <LeyendaCaritas />
            </div>
            <div className="mt-4">
              <ListaPreguntasSiau preguntas={m.porPregunta} variaciones={informe.variacionPorPregunta} />
            </div>
          </section>
          <section className="siau-sup siau-tarjeta min-w-0">
            <h2 className="siau-h2">
              <i>04</i>P2 · Trato del personal por perfil
            </h2>
            <p className="siau-bajada">Adherencia de cada perfil; la marca vertical es la adherencia general de P2 ({adherenciaP2 ?? "—"}%).</p>
            <div className="mt-4">
              <RankingSiau filas={m.porPerfil.map((p) => ({ nombre: p.perfil ?? "", valor: p.adherencia, n: p.validas, puntaje: p.puntaje }))} referencia={adherenciaP2} unidad="válidas" etiquetaReferencia="P2" />
            </div>
          </section>
        </div>
      ),
    },
    {
      id: "cruces",
      etiqueta: "Cruces por variable",
      icono: <Users2 aria-hidden="true" />,
      contenido: (
        <CrucesSiau
          preguntas={preguntasCruce}
          variables={[
            { id: "servicio", etiqueta: "Servicio (P1)", filas: sinCruce(informe.porServicio) },
            { id: "sexo", etiqueta: "Sexo", filas: sinCruce(informe.porSexo) },
            { id: "eps", etiqueta: "EPS", filas: sinCruce(informe.porEps) },
            { id: "sede", etiqueta: "Sede", filas: sinCruce(informe.porSede) },
          ]}
        />
      ),
    },
    {
      id: "sugerencias",
      etiqueta: "Sugerencias",
      icono: <MessageSquareText aria-hidden="true" />,
      conteo: m.sugerencias.length,
      contenido: <SugerenciasSiau sugerencias={sugerencias} temas={temas} />,
    },
  ];

  return (
    <div className="siau-pagina space-y-5">
      <Link href="/encuestas" className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Encuestas
      </Link>

      <CabeceraSiau
        codigo={encuesta.code}
        titulo={encuesta.title}
        encuestaId={encuesta.id}
        periodo={rango.etiqueta}
        periodoPrevio={rangoPrevio.etiqueta}
        adherencia={m.adherenciaGeneral}
        total={m.total}
        totalPrevio={prev ? prev.total : null}
        variacion={informe.variacionGeneral}
        puntaje={m.puntajeGeneral}
        sedes={{
          conDatos: informe.porSede.filter((s) => s.valor !== "Sin dato").length,
          verde: conteoSedes("success"),
          amarillo: conteoSedes("warning"),
          rojo: conteoSedes("destructive"),
        }}
      />

      <FiltrosSiau
        key={consulta}
        valores={{ tipo: periodo.tipo, anio: periodo.anio, mes: periodo.mes ?? 1, trimestre: periodo.trimestre ?? 1, sede: filtros.sede ?? "", servicio: filtros.servicio ?? "", sexo: filtros.sexo ?? "", eps: filtros.eps ?? "" }}
        opciones={{ ...opciones, anios }}
        periodo={rango.etiqueta}
        periodoPrevio={rangoPrevio.etiqueta}
      />

      {m.total === 0 ? (
        <div className="siau-sup siau-tarjeta siau-revelar flex flex-col items-center gap-2 px-6 py-10 text-center" style={{ ["--i" as string]: 2 }}>
          <span className="siau-pozo grid h-12 w-12 place-items-center !rounded-2xl text-primary">
            <Inbox className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="mt-1 font-display text-[15px] font-bold text-foreground">Sin encuestas en este periodo</p>
          <p className="max-w-md text-[13px] text-muted-foreground">
            No hay respuestas para {rango.etiqueta} con los filtros elegidos. Cambia el periodo o quita filtros; la estación de exportación sigue disponible abajo.
          </p>
        </div>
      ) : (
        <div className="siau-revelar" style={{ ["--i" as string]: 2 }}>
          <PestanasSiau pestanas={pestanas} />
        </div>
      )}

      <ExportablesSiau
        key={`exportar-${consulta}`}
        inicial={{ tipo: periodo.tipo, anio: periodo.anio, mes: periodo.mes ?? hoy.getMonth() + 1, trimestre: periodo.trimestre ?? Math.floor(hoy.getMonth() / 3) + 1 }}
        anios={anios}
        filtros={filtros}
        slug={encuesta.slug}
        registro={exportaciones.map((e) => ({
          id: e.id,
          descripcion: e.description ?? "Exportación",
          detalle: plano(`${e.user?.fullName ?? "—"} · ${etiquetaFecha(e.createdAt)} ${etiquetaHora(e.createdAt)}`),
        }))}
      />

      <p className="font-mono text-[10.5px] leading-relaxed text-muted-foreground">
        Consulta: {consulta || "periodo actual"} · Adherencia = respuestas favorables sobre válidas (Res. 0256 de 2016); puntaje = promedio de la escala sobre su máximo. Fórmulas en
        lib/encuestas/metrics.ts.
      </p>
    </div>
  );
}
