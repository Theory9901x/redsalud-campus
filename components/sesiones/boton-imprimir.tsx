"use client";

import { Printer } from "lucide-react";

/** Botón de imprimir la ficha; se oculta a sí mismo en la impresión. */
export function BotonImprimir() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-success px-5 py-3 text-[14px] font-bold text-white shadow-lg shadow-primary/25 print:hidden"
    >
      <Printer className="h-4 w-4" aria-hidden="true" />
      Imprimir o proyectar
    </button>
  );
}
