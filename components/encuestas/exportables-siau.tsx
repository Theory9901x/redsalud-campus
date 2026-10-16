"use client";

import { useEffect, useState } from "react";
import { MotionConfig, motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUp,
  CalendarDays,
  CalendarRange,
  Check,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  FileType2,
  Filter,
  History,
  Infinity as Siempre,
  RotateCcw,
  Sheet,
  Table2,
} from "lucide-react";
import { enfocarExportacion } from "@/components/encuestas/siau/movimiento";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const NOMBRE_FILTRO: Record<string, string> = { sede: "Sede", servicio: "Servicio", sexo: "Sexo", eps: "EPS" };
const TIPOS = [
  ["mensual", "Mensual"],
  ["trimestral", "Trimestral"],
  ["anual", "Anual"],
] as const;

type Opcion = {
  href: string;
  Icono: LucideIcon;
  formato: "pdf" | "xlsx" | "csv" | "docx";
  titulo: string;
  para: string;
  detalle: string;
  alcance: string;
  destacado?: boolean;
};

/**
 * ESTACIÓN ÚNICA DE EXPORTACIÓN SIAU. Todo lo que se descarga de la
 * encuesta vive aquí, en tres pasos: (1) el periodo -mensual, trimestral o
 * anual-, (2) los filtros de la vista que viajan al archivo y (3) el
 * archivo, con su formato, qué contiene y para quién es. Debajo, el
 * registro de descargas. Los enlaces apuntan a los mismos endpoints de
 * siempre; esto solo los ordena.
 */
export function ExportablesSiau({
  inicial,
  anios,
  filtros,
  slug,
  registro,
}: {
  inicial: { tipo: string; anio: number; mes: number; trimestre: number };
  /** Años del selector, calculados en el servidor. */
  anios: number[];
  filtros: Record<string, string | undefined>;
  /** Slug de la encuesta SIAU, para sus descargas de histórico completo. */
  slug: string;
  /** Últimas descargas, con la fecha ya formateada en el servidor. */
  registro: { id: string; descripcion: string; detalle: string }[];
}) {
  const [tipo, setTipo] = useState(inicial.tipo);
  const [anio, setAnio] = useState(inicial.anio);
  const [mes, setMes] = useState(inicial.mes);
  const [trimestre, setTrimestre] = useState(inicial.trimestre);

  // Llegada con #exportar (desde la ficha de resultados u otro enlace).
  useEffect(() => {
    if (window.location.hash === "#exportar") {
      const t = window.setTimeout(enfocarExportacion, 150);
      return () => window.clearTimeout(t);
    }
  }, []);

  const q = new URLSearchParams({ tipo, anio: String(anio) });
  if (tipo === "mensual") q.set("mes", String(mes));
  if (tipo === "trimestral") q.set("trimestre", String(trimestre));
  for (const [k, v] of Object.entries(filtros)) if (v) q.set(k, v);
  const consulta = q.toString();
  const etiqueta = tipo === "mensual" ? `${MESES[mes - 1]} ${anio}` : tipo === "trimestral" ? `${trimestre}º trimestre ${anio}` : `Año ${anio}`;
  const filtrosActivos = Object.entries(filtros).filter(([, v]) => v) as [string, string][];
  const alcancePeriodo = `${etiqueta}${filtrosActivos.length ? ` · ${filtrosActivos.length} ${filtrosActivos.length === 1 ? "filtro" : "filtros"}` : ""}`;
  const comoLaVista =
    tipo === inicial.tipo && anio === inicial.anio && (tipo !== "mensual" || mes === inicial.mes) && (tipo !== "trimestral" || trimestre === inicial.trimestre);

  function volverALaVista() {
    setTipo(inicial.tipo);
    setAnio(inicial.anio);
    setMes(inicial.mes);
    setTrimestre(inicial.trimestre);
  }

  const delPeriodo: Opcion[] = [
    {
      href: `/api/encuestas/siau/informe?${consulta}`,
      Icono: FileText,
      formato: "pdf",
      titulo: "Informe general",
      para: "Para presentar",
      detalle: "Todas las secciones del centro de datos: tendencia, sedes, preguntas, cruces y sugerencias. Listo para comité o gerencia.",
      alcance: alcancePeriodo,
      destacado: true,
    },
    {
      href: `/api/encuestas/siau/siho?${consulta}`,
      Icono: FileSpreadsheet,
      formato: "xlsx",
      titulo: "Excel SIHO",
      para: "Ente de control",
      detalle: "Estructura oficial del reporte: hoja de datos y resumen por IPS con fórmulas.",
      alcance: alcancePeriodo,
    },
    {
      href: `/api/encuestas/siau/crudo?${consulta}`,
      Icono: Table2,
      formato: "xlsx",
      titulo: "Datos crudos",
      para: "Para análisis",
      detalle: "Una fila por encuesta, con el valor numérico y la etiqueta de cada pregunta.",
      alcance: alcancePeriodo,
    },
  ];
  const deLaEncuesta: Opcion[] = [
    {
      href: `/api/encuestas/${slug}/informe`,
      Icono: FileText,
      formato: "pdf",
      titulo: "Resultados de la encuesta",
      para: "Para radicar",
      detalle: "Métricas, gráficas y la tabulación completa por pregunta de todas las respuestas, con la fecha de generación.",
      alcance: "Histórico completo · sin filtros",
    },
    {
      href: `/api/encuestas/${slug}/csv`,
      Icono: Sheet,
      formato: "csv",
      titulo: "Base de respuestas",
      para: "Soporte documental",
      detalle: "Una fila por respuesta completa y una columna por pregunta, con fecha, canal y puntaje. Se abre en Excel.",
      alcance: "Histórico completo · sin filtros",
    },
    {
      href: `/api/encuestas/${slug}/formato-docx`,
      Icono: FileType2,
      formato: "docx",
      titulo: "Formato oficial en Word",
      para: "Para imprimir o aplicar",
      detalle: "El instrumento institucional sin diligenciar, con su encabezado, para aplicar en papel o archivar.",
      alcance: "No depende del periodo",
    },
  ];

  return (
    <MotionConfig reducedMotion="user">
      <section id="exportar" tabIndex={-1} className="siau-sup siau-estacion siau-revelar" aria-labelledby="siau-exportar-titulo">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3.5">
            <span className="siau-estacion-icono" aria-hidden="true">
              <Download />
            </span>
            <div className="min-w-0">
              <p className="siau-ceja">Centro de exportación</p>
              <h2 id="siau-exportar-titulo" className="mt-1 font-display text-[1.3rem] font-extrabold tracking-tight text-foreground">
                Exportar datos SIAU
              </h2>
              <p className="siau-bajada max-w-2xl">
                Todas las descargas de la encuesta en un solo lugar: elige el periodo, revisa los filtros que se aplican y descarga el archivo que necesitas. Cada descarga del periodo
                queda registrada.
              </p>
            </div>
          </div>
        </div>

        <div className="siau-estacion-grid">
          {/* Pasos 1 y 2: qué se va a exportar */}
          <div className="min-w-0">
            <div className="siau-pozo siau-paso">
              <p className="siau-paso-titulo">
                <span className="siau-paso-n">1</span>
                Periodo a exportar
              </p>
              <div className="mt-3 space-y-2.5">
                <div className="siau-segmento flex w-full" role="radiogroup" aria-label="Tipo de periodo a exportar">
                  {TIPOS.map(([v, l]) => (
                    <button key={v} type="button" role="radio" aria-checked={tipo === v} data-activo={tipo === v} onClick={() => setTipo(v)} className="flex-1 justify-center">
                      {tipo === v && <motion.span layoutId="siau-exportar-periodo" className="siau-pastilla" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
                      {l}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <label className="siau-campo">
                    <span>Año</span>
                    <span className="siau-selector">
                      <select value={anio} onChange={(e) => setAnio(Number(e.target.value))} className="siau-control">
                        {anios.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="siau-selector-flecha" aria-hidden="true" />
                    </span>
                  </label>
                  {tipo === "mensual" && (
                    <label className="siau-campo">
                      <span>Mes</span>
                      <span className="siau-selector">
                        <CalendarDays className="siau-selector-icono" aria-hidden="true" />
                        <select value={mes} onChange={(e) => setMes(Number(e.target.value))} className="siau-control">
                          {MESES.map((m, i) => (
                            <option key={m} value={i + 1}>
                              {m}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="siau-selector-flecha" aria-hidden="true" />
                      </span>
                    </label>
                  )}
                  {tipo === "trimestral" && (
                    <label className="siau-campo">
                      <span>Trimestre</span>
                      <span className="siau-selector">
                        <CalendarDays className="siau-selector-icono" aria-hidden="true" />
                        <select value={trimestre} onChange={(e) => setTrimestre(Number(e.target.value))} className="siau-control">
                          {[1, 2, 3, 4].map((t) => (
                            <option key={t} value={t}>
                              {t}º trimestre
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="siau-selector-flecha" aria-hidden="true" />
                      </span>
                    </label>
                  )}
                </div>
                <div className="flex min-h-8 items-center">
                  {comoLaVista ? (
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--siau-tinta)]">
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      Mismo periodo de la vista
                    </span>
                  ) : (
                    <button type="button" onClick={volverALaVista} className="siau-boton siau-boton-mini">
                      <RotateCcw aria-hidden="true" />
                      Volver al periodo de la vista
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="siau-pozo siau-paso">
              <p className="siau-paso-titulo">
                <span className="siau-paso-n">2</span>
                Filtros que se aplican
              </p>
              {filtrosActivos.length > 0 ? (
                <ul className="mt-2.5 flex flex-wrap gap-1.5">
                  {filtrosActivos.map(([k, v]) => (
                    <li key={k} className="siau-chip">
                      <Filter aria-hidden="true" />
                      <span>
                        {NOMBRE_FILTRO[k] ?? k}: <b className="font-semibold">{v}</b>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">Ninguno: se exportan todas las sedes, servicios, sexos y EPS.</p>
              )}
              <a href="#filtros" className="mt-2.5 inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--siau-tinta)] hover:underline">
                <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                Cambiar filtros en la barra de arriba
              </a>
              <div className="siau-resumen">
                <span className="siau-mono">Se exportará</span>
                <b>{etiqueta}</b>
                <code>
                  SIAU_&lt;INFORME · SIHO · DATOS&gt;_{tipo === "mensual" ? `${anio}-${String(mes).padStart(2, "0")}` : tipo === "trimestral" ? `${anio}-T${trimestre}` : anio}_&lt;fecha&gt;
                </code>
              </div>
            </div>
          </div>

          {/* Paso 3: el archivo */}
          <div className="min-w-0">
            <GrupoOpciones
              titulo="Del periodo elegido"
              nota={
                <>
                  <CalendarRange className="h-3.5 w-3.5" aria-hidden="true" />
                  {alcancePeriodo}
                </>
              }
              opciones={delPeriodo}
            />
            <GrupoOpciones
              titulo="De toda la encuesta"
              nota={
                <>
                  <Siempre className="h-3.5 w-3.5" aria-hidden="true" />
                  No usan el periodo ni los filtros
                </>
              }
              opciones={deLaEncuesta}
            />
          </div>
        </div>

        <details className="siau-pozo siau-registro">
          <summary>
            <span className="siau-mono inline-flex items-center gap-2">
              <History className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              Registro de descargas del periodo · {registro.length ? `últimas ${registro.length}` : "sin descargas aún"}
            </span>
            <ChevronDown aria-hidden="true" />
          </summary>
          {registro.length > 0 ? (
            <ul>
              {registro.map((e) => (
                <li key={e.id}>
                  <span>{e.descripcion}</span>
                  <span>{e.detalle}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 pb-4 text-[12.5px] text-muted-foreground">Cuando alguien descargue el informe, el Excel SIHO o los datos crudos, quedará aquí.</p>
          )}
        </details>
      </section>
    </MotionConfig>
  );
}

function GrupoOpciones({ titulo, nota, opciones }: { titulo: string; nota: React.ReactNode; opciones: Opcion[] }) {
  return (
    <div className="siau-grupo">
      <div className="siau-grupo-titulo">
        <span className="siau-paso-n">3</span>
        <h3>{titulo}</h3>
        <span className="siau-mono inline-flex items-center gap-1.5">{nota}</span>
      </div>
      <ul className="siau-opciones">
        {opciones.map((o) => (
          <li key={o.href} className="min-w-0">
            <a href={o.href} className="siau-opcion" data-destacado={o.destacado ?? false}>
              <span className="siau-formato" data-formato={o.formato} aria-hidden="true">
                <o.Icono />
                <b>{o.formato.toUpperCase()}</b>
              </span>
              <span className="min-w-0">
                <span className="siau-opcion-titulo">
                  <strong>{o.titulo}</strong>
                  <span className="siau-para">{o.para}</span>
                </span>
                <p>{o.detalle}</p>
                <span className="siau-opcion-alcance">
                  <CalendarRange aria-hidden="true" />
                  {o.alcance}
                </span>
              </span>
              <span className="siau-descargar">
                <Download aria-hidden="true" />
                Descargar {o.formato.toUpperCase()}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
