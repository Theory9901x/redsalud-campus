"use client";

import { useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * Panel lateral de CREAR, como PanelDeslizable del módulo de planes, pero
 * controlado: el formulario recibe `cerrar` para plegarlo al terminar sin
 * recargar la página. El disparador es [data-slot="sheet-trigger"], que el
 * modo de solo lectura ya oculta.
 */
export function PanelLateral({
  etiqueta,
  titulo,
  descripcion,
  children,
  className,
}: {
  etiqueta: string;
  titulo: string;
  descripcion?: string;
  children: (cerrar: () => void) => ReactNode;
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  return (
    <Sheet open={abierto} onOpenChange={setAbierto}>
      <SheetTrigger className={cn("ind-boton-primario", className)} data-escritura>
        <Plus className="h-4 w-4" aria-hidden="true" />
        {etiqueta}
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto border-l border-border/70 p-0 sm:!max-w-[540px]">
        <SheetHeader className="ind-panel-cabecera">
          <p className="mono-label !text-white/60">Plan de mejora</p>
          <SheetTitle className="font-display text-lg font-bold text-white">{titulo}</SheetTitle>
          {descripcion && <SheetDescription className="text-[13px] text-white/70">{descripcion}</SheetDescription>}
        </SheetHeader>
        <div className="form-premium px-6 pb-8 pt-3">{children(() => setAbierto(false))}</div>
      </SheetContent>
    </Sheet>
  );
}
