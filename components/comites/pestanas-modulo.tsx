import Link from "next/link";
import { CalendarRange, Gavel } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Pestañas submodulares: Planes de capacitación · Comités. Son dos módulos
 * con gestión y medición aparte que comparten el mismo espacio del menú.
 */
export function PestanasModulo({ activa }: { activa: "planes" | "comites" }) {
  const pestanas = [
    { clave: "planes", href: "/admin/planes-capacitacion", etiqueta: "Planes de capacitación", Icono: CalendarRange },
    { clave: "comites", href: "/admin/comites", etiqueta: "Comités", Icono: Gavel },
  ] as const;

  return (
    <nav aria-label="Submódulos" className="inline-flex rounded-2xl border border-border/60 bg-card/60 p-1 backdrop-blur-sm">
      {pestanas.map((p) => {
        const activo = p.clave === activa;
        return (
          <Link
            key={p.clave}
            href={p.href}
            aria-current={activo ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-bold transition-all",
              activo
                ? "bg-gradient-to-r from-primary to-teal-400 text-white shadow-md shadow-primary/25"
                : "text-muted-foreground hover:bg-card hover:text-foreground"
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
