"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * PANEL EN LÍNEA del constructor de cursos.
 *
 * Los formularios de módulo, lección, cuestionario y pregunta se abren AQUÍ
 * MISMO, dentro del temario y debajo de lo que se está editando -como en
 * cualquier constructor-, no en un diálogo flotante por fuera del módulo.
 * Al abrirse se trae a la vista y enfoca el primer campo.
 */
export function PanelEnLinea({
  titulo,
  descripcion,
  onCerrar,
  children,
}: {
  titulo: string;
  descripcion?: string;
  onCerrar: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nodo = ref.current;
    if (!nodo) return;
    nodo.scrollIntoView({ block: "nearest", behavior: "smooth" });
    nodo.querySelector<HTMLElement>("input:not([type=hidden]), textarea, select")?.focus({ preventScroll: true });
  }, []);

  return (
    <div
      ref={ref}
      className="order-last mt-2 w-full basis-full rounded-xl border border-primary/30 border-l-4 border-l-primary bg-card p-4 shadow-sm sm:p-5"
      role="region"
      aria-label={titulo}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h4 className="font-display text-[15px] font-bold text-foreground">{titulo}</h4>
          {descripcion && <p className="mt-0.5 text-xs text-muted-foreground">{descripcion}</p>}
        </div>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onCerrar} aria-label="Cerrar">
          <X className="h-4 w-4" />
        </Button>
      </div>
      {children}
    </div>
  );
}

/** Pie común de los formularios en línea: guardar + cancelar. */
export function PieFormulario({
  pending,
  etiqueta,
  onCancelar,
}: {
  pending: boolean;
  etiqueta: string;
  onCancelar: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
      <Button type="button" variant="outline" onClick={onCancelar} disabled={pending}>
        Cancelar
      </Button>
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando..." : etiqueta}
      </Button>
    </div>
  );
}
