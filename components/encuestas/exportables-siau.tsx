"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const campo = "h-10 rounded-xl border border-border/60 bg-card/70 px-3 text-[13px] font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary/30";

/**
 * EXPORTABLES POR PERIODO, siempre por separado: se elige explícitamente
 * mensual / trimestral / anual y se descarga cada uno de los tres archivos
 * (informe PDF, Excel SIHO, datos crudos). Los filtros de variable de la
 * página (sede, servicio, sexo, EPS) también viajan al exportable.
 */
export function ExportablesSiau({ inicial, filtros }: { inicial: { tipo: string; anio: number; mes: number; trimestre: number }; filtros: Record<string, string | undefined> }) {
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

  const archivos = [
    { href: `/api/encuestas/siau/informe?${consulta}`, Icono: FileText, titulo: "Informe general (PDF)", detalle: "Todas las secciones del centro de datos para el periodo" },
    { href: `/api/encuestas/siau/siho?${consulta}`, Icono: FileSpreadsheet, titulo: "Excel del ente de control (SIHO)", detalle: "Estructura oficial: datos + resumen por IPS con fórmulas" },
    { href: `/api/encuestas/siau/crudo?${consulta}`, Icono: Table2, titulo: "Datos crudos (.xlsx)", detalle: "Una fila por encuesta, valor numérico y etiqueta por pregunta" },
  ];

  return (
    <section className="comite-tarjeta p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-[15px] font-bold text-foreground"><Download className="h-4 w-4 text-primary" aria-hidden="true" />Exportables por periodo</h2>
          <p className="mt-1 text-[12px] text-muted-foreground">Cada periodo se exporta por separado. Nombre del archivo: SIAU_&lt;tipo&gt;_&lt;periodo&gt;_&lt;fecha&gt;. Cada descarga queda registrada.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl bg-muted/60 p-1">
            {[["mensual", "Mensual"], ["trimestral", "Trimestral"], ["anual", "Anual"]].map(([v, l]) => (
              <button key={v} type="button" onClick={() => setTipo(v)} className={cn("rounded-lg px-3 py-1.5 text-[12.5px] font-bold transition-all", tipo === v ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}>{l}</button>
            ))}
          </div>
          <select value={anio} onChange={(e) => setAnio(Number(e.target.value))} className={campo} aria-label="Año">
            {[anioActual - 2, anioActual - 1, anioActual, anioActual + 1].map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          {tipo === "mensual" && (
            <select value={mes} onChange={(e) => setMes(Number(e.target.value))} className={campo} aria-label="Mes">
              {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          )}
          {tipo === "trimestral" && (
            <select value={trimestre} onChange={(e) => setTrimestre(Number(e.target.value))} className={campo} aria-label="Trimestre">
              {[1, 2, 3, 4].map((t) => <option key={t} value={t}>{t}º trimestre</option>)}
            </select>
          )}
        </div>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        {archivos.map((a) => (
          <a key={a.titulo} href={a.href} className="group flex items-start gap-3 rounded-2xl border border-border/60 bg-card/70 p-4 transition-all hover:-translate-y-px hover:border-primary/40 hover:shadow-md">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary"><a.Icono className="h-5 w-5" aria-hidden="true" /></span>
            <span className="min-w-0">
              <span className="block text-[13.5px] font-bold text-foreground">{a.titulo}</span>
              <span className="block text-[11.5px] text-muted-foreground">{a.detalle}</span>
              <span className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] font-bold text-primary"><Download className="h-3 w-3" aria-hidden="true" />{etiqueta}</span>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
