"use client";

import { useSearchParams } from "next/navigation";
import { FileDown } from "lucide-react";

/**
 * Descarga el informe PDF con exactamente los filtros que hay en pantalla:
 * reenvía los searchParams actuales al endpoint, que recomputa las cifras en
 * SQL antes de imprimir.
 */
export function BotonInforme() {
  const searchParams = useSearchParams();
  const params = new URLSearchParams(searchParams.toString());
  params.delete("page");
  params.delete("pageSize");

  return (
    <a
      href={`/api/reportes/informe?${params.toString()}`}
      className="btn-hud shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
    >
      <FileDown className="h-4 w-4" />
      Generar informe PDF
    </a>
  );
}
