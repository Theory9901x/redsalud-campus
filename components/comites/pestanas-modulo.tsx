import Link from "next/link";
import { CalendarRange, Gavel, Presentation } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Pestañas submodulares: Planes de capacitación · Comités · Reuniones. Son
 * módulos con gestión y medición aparte que comparten el mismo espacio del menú.
 */
export function PestanasModulo({ activa }: { activa: "planes" | "comites" | "reuniones" }) {
  const pestanas = [
    { clave: "planes", href: "/admin/planes-capacitacion", etiqueta: "Planes de capacitación", Icono: CalendarRange },
    { clave: "comites", href: "/admin/comites", etiqueta: "Comités", Icono: Gavel },
    { clave: "reuniones", href: "/admin/reuniones", etiqueta: "Reuniones", Icono: Presentation },
  ] as const;

  return (
    <nav aria-label="Submódulos" className="inline-flex rounded-[14px] border border-border/70 bg-card/80 p-1 shadow-[var(--shadow-1)]">
      {pestanas.map((p) => {
        const activo = p.clave === activa;
        return (
          <Link
            key={p.clave}
            href={p.href}
            aria-current={activo ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-[10px] px-4 py-2 text-[13px] font-semibold transition-all duration-200",
              activo
                ? "bg-[color-mix(in_oklch,var(--navy)_88%,var(--primary))] text-white shadow-[inset_0_-2px_0_var(--primary)] [&_svg]:text-[color-mix(in_oklch,var(--primary)_70%,white)]"
                : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground"
            )}
          >
            <p.Icono className="h-4 w-4" aria-hidden="true" />
            {p.etiqueta}
          </Link>
        );
      })}
    </nav>
  );
}
