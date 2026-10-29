import Link from "next/link";
import { CalendarRange, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Submódulos de «Mis capacitaciones» (personal): sus planes y lo que está en
 * vivo ahora. Con llamadas abiertas, la pestaña En vivo lo dice con su conteo.
 */
export function PestanasCapacitaciones({ activa, enVivo }: { activa: "planes" | "en-vivo" | "independientes"; enVivo: number }) {
  const pestanas = [
    { clave: "planes", href: "/mis-capacitaciones", etiqueta: "Mis planes", Icono: CalendarRange },
    { clave: "independientes", href: "/mis-capacitaciones/independientes", etiqueta: "Capacitaciones independientes", Icono: CalendarRange },
    { clave: "en-vivo", href: "/mis-capacitaciones/en-vivo", etiqueta: "En vivo", Icono: Radio },
  ] as const;
  return (
    <nav aria-label="Submódulos de capacitaciones" className="inline-flex rounded-[14px] border border-border/70 bg-card/80 p-1 shadow-[var(--shadow-1)]">
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
            {p.clave === "en-vivo" && enVivo > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[oklch(0.58_0.2_25)] px-1.5 py-0.5 font-mono text-[10px] font-bold leading-none text-white">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" aria-hidden="true" />
                {enVivo}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
