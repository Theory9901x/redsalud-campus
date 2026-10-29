"use client";

import { useState, type ReactNode } from "react";
import { CalendarPlus, Plus } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

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
  centrado = false,
}: {
  etiqueta: string;
  titulo: string;
  descripcion?: string;
  icono?: keyof typeof ICONOS;
  children: ReactNode;
  className?: string;
  centrado?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const Icono = ICONOS[icono];
  if (centrado) return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger className={cn("inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 py-3 font-sans text-base font-semibold text-primary-foreground", className)}>
        <Icono className="h-5 w-5" aria-hidden="true" />{etiqueta}
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="reunion-dialog flex h-[90dvh] max-h-[960px] flex-col gap-0 overflow-hidden p-0 font-sans sm:max-w-3xl">
        <DialogHeader className="shrink-0 border-b bg-background px-6 py-5 pr-14">
          <DialogTitle className="font-sans text-2xl font-bold leading-tight">{titulo}</DialogTitle>
          {descripcion && <DialogDescription className="text-base leading-relaxed">{descripcion}</DialogDescription>}
          <DialogClose className="absolute right-4 top-4 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold">Cerrar</DialogClose>
        </DialogHeader>
        <div className="form-premium reunion-form min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </DialogContent>
    </Dialog>
  );
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
