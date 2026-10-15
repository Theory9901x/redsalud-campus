"use client";

import { useState, type ReactNode } from "react";
import { Check, FileSpreadsheet, FileText, FileType2, RotateCcw, Table2 } from "lucide-react";
import { CentroExportacion, TarjetaExporte } from "@/components/encuestas/ficha-encuesta";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const NOMBRE_FILTRO: Record<string, string> = { sede: "Sede", servicio: "Servicio", sexo: "Sexo", eps: "EPS" };

/**
 * CENTRO DE EXPORTACIÓN SIAU. Todos los archivos en un solo bloque: se elige
 * explícitamente el periodo (mensual / trimestral / anual) y se descarga
 * cada archivo por separado (informe PDF, Excel SIHO, datos crudos), más el
 * formato oficial en Word, que no depende del periodo. Arranca en el
 * periodo de la vista, y los filtros de variable de la página (sede,
 * servicio, sexo, EPS) también viajan al exportable.
 */
export function ExportablesSiau({
  inicial,
  filtros,
  formatoHref,
  pie,
}: {
  inicial: { tipo: string; anio: number; mes: number; trimestre: number };
  filtros: Record<string, string | undefined>;
  /** Formato oficial (.docx) de la encuesta. */
  formatoHref?: string;
  /** Registro de las últimas descargas. */
  pie?: ReactNode;
}) {
  const [tipo, setTipo] = useState(inicial.tipo);
  const [anio, setAnio] = useState(inicial.anio);
  const [mes, setMes] = useState(inicial.mes);
  const [trimestre, setTrimestre] = useState(inicial.trimestre);
  const anioActual = new Date().getFullYear();

  const q = new URLSearchParams({ tipo, anio: String(anio) });
  if (tipo === "mensual") q.set("mes", String(mes));
  if (tipo === "trimestral") q.set("trimestre", String(trimestre));
  for (const [k, v] of Object.entries(filtros)) if (v) q.set(k, v);
  const consulta = q.toString();
  const etiqueta = tipo === "mensual" ? `${MESES[mes - 1]} ${anio}` : tipo === "trimestral" ? `${trimestre}º trimestre ${anio}` : `Año ${anio}`;
  const filtrosActivos = Object.entries(filtros).filter(([, v]) => v);

  const comoLaVista =
    tipo === inicial.tipo &&
    anio === inicial.anio &&
    (tipo !== "mensual" || mes === inicial.mes) &&
    (tipo !== "trimestral" || trimestre === inicial.trimestre);

  function volverALaVista() {
    setTipo(inicial.tipo);
    setAnio(inicial.anio);
    setMes(inicial.mes);
    setTrimestre(inicial.trimestre);
  }

  return (
    <CentroExportacion
      id="exportar"
      titulo="Exportables del centro de datos"
      bajada={
        <>
          Cada periodo se exporta por separado y cada descarga queda registrada. Nombre del archivo:{" "}
          <code className="font-mono text-[11.5px] text-foreground">SIAU_&lt;tipo&gt;_&lt;periodo&gt;_&lt;fecha&gt;</code>.
        </>
      }
      pie={pie}
    >
      {/* Periodo a exportar */}
      <div className="flex flex-wrap items-end gap-3 rounded-[14px] border border-border/70 bg-[color-mix(in_oklch,var(--foreground)_2%,var(--card))] p-3">
        <div className="enc-campo">
          <span>Periodo a exportar</span>
          <div className="enc-interruptor" role="group" aria-label="Tipo de periodo">
            {[["mensual", "Mensual"], ["trimestral", "Trimestral"], ["anual", "Anual"]].map(([v, l]) => (
              <button key={v} type="button" data-activo={tipo === v} aria-pressed={tipo === v} onClick={() => setTipo(v)}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <label className="enc-campo w-[110px]">
          <span>Año</span>
          <select value={anio} onChange={(e) => setAnio(Number(e.target.value))} className="enc-control">
            {[anioActual - 2, anioActual - 1, anioActual, anioActual + 1].map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        {tipo === "mensual" && (
          <label className="enc-campo w-[150px]">
            <span>Mes</span>
            <select value={mes} onChange={(e) => setMes(Number(e.target.value))} className="enc-control">
              {MESES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        )}
        {tipo === "trimestral" && (
          <label className="enc-campo w-[150px]">
            <span>Trimestre</span>
            <select value={trimestre} onChange={(e) => setTrimestre(Number(e.target.value))} className="enc-control">
              {[1, 2, 3, 4].map((t) => (
                <option key={t} value={t}>
                  {t}º trimestre
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="flex min-h-[2.4rem] flex-wrap items-center gap-2 sm:ml-auto">
          {comoLaVista ? (
            <span className="chip-dato chip-dato-primario">
              <Check aria-hidden="true" />
              Mismo periodo de la vista
            </span>
          ) : (
            <button type="button" onClick={volverALaVista} className="enc-boton enc-boton-mini">
              <RotateCcw aria-hidden="true" />
              Volver al periodo de la vista
            </button>
          )}
        </div>
      </div>

      {filtrosActivos.length > 0 && (
        <p className="mt-3 flex flex-wrap items-center gap-1.5 text-[12px] text-muted-foreground">
          <span className="mono-label mr-1">Filtros que viajan al archivo</span>
          {filtrosActivos.map(([k, v]) => (
            <span key={k} className="chip-dato">
              {NOMBRE_FILTRO[k] ?? k}: <b className="font-semibold text-foreground">{v}</b>
            </span>
          ))}
        </p>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TarjetaExporte
          destacado
          href={`/api/encuestas/siau/informe?${consulta}`}
          Icono={FileText}
          formato="PDF"
          titulo="Informe general"
          detalle="Todas las secciones del centro de datos para el periodo: tendencia, sedes, preguntas, cruces y sugerencias."
          pie={etiqueta}
        />
        <TarjetaExporte
          href={`/api/encuestas/siau/siho?${consulta}`}
          Icono={FileSpreadsheet}
          formato="XLSX"
          titulo="Excel SIHO (ente de control)"
          detalle="Estructura oficial: hoja de datos y resumen por IPS con fórmulas."
          pie={etiqueta}
        />
        <TarjetaExporte
          href={`/api/encuestas/siau/crudo?${consulta}`}
          Icono={Table2}
          formato="XLSX"
          titulo="Datos crudos"
          detalle="Una fila por encuesta, con el valor numérico y la etiqueta de cada pregunta."
          pie={etiqueta}
        />
        {formatoHref && (
          <TarjetaExporte
            href={formatoHref}
            Icono={FileType2}
            formato="DOCX"
            titulo="Formato oficial en Word"
            detalle="El instrumento institucional sin diligenciar, para imprimir o aplicar en papel."
            pie="No depende del periodo"
          />
        )}
      </div>
    </CentroExportacion>
  );
}
