"use client";

import { useState, type ReactNode } from "react";
import { CalendarPlus, Plus } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const ICONOS = { mas: Plus, agendar: CalendarPlus } as const;

/**
 * Acción de CREAR que no ocupa la página: un botón que abre un panel lateral
 * con el formulario (nueva actividad, agendar jornada). Antes esos
 * formularios vivían fijos al lado del contenido y le quitaban un tercio
 * del ancho a la información que se viene a consultar.
 */
export function PanelDeslizable({
  etiqueta,
  titulo,
  descripcion,
  icono = "mas",
  children,
  className,
}: {
  etiqueta: string;
  titulo: string;
  descripcion?: string;
  icono?: keyof typeof ICONOS;
  children: ReactNode;
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const Icono = ICONOS[icono];
  return (
    <Sheet open={abierto} onOpenChange={setAbierto}>
      <SheetTrigger
        className={cn(
          "inline-flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2.5 text-[13px] font-bold text-primary-foreground transition-all duration-200 hover:-translate-y-px hover:shadow-[0_0_0_3px_color-mix(in_oklch,var(--primary)_22%,transparent),0_10px_24px_-10px_var(--primary)]",
          className
        )}
      >
        <Icono className="h-4 w-4" aria-hidden="true" />
        {etiqueta}
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto border-l border-border/70 p-0 sm:!max-w-[520px]">
        <SheetHeader className="border-b border-border/70 bg-[color-mix(in_oklch,var(--navy)_92%,var(--primary))] px-6 py-5 text-white">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[color-mix(in_oklch,var(--primary)_70%,white)]">Acción</p>
          <SheetTitle className="font-display text-lg font-bold text-white">{titulo}</SheetTitle>
          {descripcion && <SheetDescription className="text-[13px] text-white/70">{descripcion}</SheetDescription>}
        </SheetHeader>
        <div className="form-premium px-6 pb-8 pt-2">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
