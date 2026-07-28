"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileDown, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import type { TipoReporte } from "@/lib/reportes-meta";

/**
 * Exporta el panel tal y como se está viendo: arrastra los filtros activos de
 * la URL al informe, para que el PDF no pueda decir algo distinto de lo que el
 * administrador tiene delante.
 *
 * Ofrece las dos vías a propósito. La descarga en PDF depende de que el
 * servidor tenga un navegador headless instalado; abrir la hoja e imprimir con
 * Ctrl+P no depende de nada y siempre funciona, así que si el PDF falla queda
 * una salida real, no un callejón.
 */
export function ExportarReporte({ tipo = "panel" }: { tipo?: TipoReporte }) {
  const searchParams = useSearchParams();
  const [generando, setGenerando] = useState(false);

  function filtrosActuales() {
    const p = new URLSearchParams();
    for (const clave of ["municipio", "personal", "curso", "estado"]) {
      const v = searchParams.get(clave);
      if (v) p.set(clave, v);
    }
    return p.toString();
  }

  async function descargarPdf() {
    setGenerando(true);
    try {
      const query = filtrosActuales();
      const respuesta = await fetch(`/api/reportes/pdf?tipo=${tipo}${query ? `&${query}` : ""}`, {
        method: "POST",
      });

      if (!respuesta.ok) {
        const cuerpo = await respuesta.json().catch(() => ({}));
        toast.error(cuerpo.error ?? "No se pudo generar el PDF.");
        return;
      }

      // El navegador no descarga desde un POST: se materializa el archivo y se
      // dispara un enlace temporal.
      const blob = await respuesta.blob();
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `reporte-${tipo}-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      URL.revokeObjectURL(url);
      toast.success("Informe descargado.");
    } catch {
      toast.error("No se pudo conectar para generar el PDF.");
    } finally {
      setGenerando(false);
    }
  }

  const query = filtrosActuales();
  const hojaUrl = `/admin/reportes/${tipo}/imprimir${query ? `?${query}` : ""}`;

  return (
    <div className="flex shrink-0 items-center gap-2">
      <a href={hojaUrl} target="_blank" rel="noopener" className="btn-hud-ghost py-1.5 text-xs">
        <Printer className="h-3.5 w-3.5" />
        Ver hoja
      </a>
      <button type="button" onClick={descargarPdf} disabled={generando} className="btn-hud py-1.5 text-xs">
        {generando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
        {generando ? "Generando…" : "Descargar PDF"}
      </button>
    </div>
  );
}
