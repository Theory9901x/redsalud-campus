"use client";

import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Abre la evaluación en una VENTANA EMERGENTE en vez de navegar: quien está
 * en la videollamada presenta su presaber/postsaber sin salirse de la sala.
 * Si el navegador bloquea el popup, cae a abrirla en una pestaña nueva -la
 * llamada sigue viva igual porque tampoco se navega la pestaña actual-.
 */
export function AbrirEvaluacionPopup({
  href,
  etiqueta,
  className,
}: {
  href: string;
  etiqueta: string;
  className?: string;
}) {
  function abrir() {
    const ancho = Math.min(980, window.screen.availWidth - 80);
    const alto = Math.min(860, window.screen.availHeight - 80);
    const ventana = window.open(
      href,
      "evaluacion-jornada",
      `popup=yes,width=${ancho},height=${alto},left=${(window.screen.availWidth - ancho) / 2},top=40`
    );
    if (!ventana) window.open(href, "_blank");
  }

  return (
    <button
      type="button"
      onClick={abrir}
      className={cn(
        "flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition-transform hover:-translate-y-0.5",
        className
      )}
    >
      {etiqueta}
      <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
    </button>
  );
}
