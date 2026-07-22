import { Children, isValidElement } from "react";
import { cn } from "@/lib/utils";

/**
 * Entrada escalonada de bloques apilados. Server Component: la animación es
 * CSS (.stagger-in en globals.css), así que no lleva JavaScript al cliente.
 * Antes usaba Framer Motion y por eso convertía en cliente a las 19 vistas
 * que lo envuelven.
 */
export function StaggerSections({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("stagger-in", className)}>
      {Children.map(children, (child, index) =>
        isValidElement(child) ? (
          <div style={{ "--i": index } as React.CSSProperties}>{child}</div>
        ) : (
          child
        )
      )}
    </div>
  );
}
