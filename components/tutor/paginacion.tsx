import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Paginación de servidor (enlaces, sin JS): anterior, ventana de páginas y siguiente. */
export function Paginacion({
  pagina,
  paginas,
  total,
  href,
}: {
  pagina: number;
  paginas: number;
  total: number;
  href: (n: number) => string;
}) {
  if (paginas <= 1) return null;
  const desde = Math.max(1, Math.min(pagina - 2, paginas - 4));
  const ventana = Array.from({ length: Math.min(5, paginas) }, (_, i) => desde + i);
  const boton = "grid h-8 min-w-8 place-items-center rounded-lg border px-2 font-mono text-[11px] font-semibold tabular-nums transition-colors";
  return (
    <nav aria-label="Paginación" className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-border pt-3">
      <p className="mono-label">
        Página {pagina} de {paginas} · {total} registros
      </p>
      <div className="flex items-center gap-1">
        {pagina > 1 ? (
          <Link href={href(pagina - 1)} className={cn(boton, "border-border text-muted-foreground hover:border-primary/50 hover:text-primary")} aria-label="Página anterior">
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        ) : null}
        {ventana.map((n) => (
          <Link
            key={n}
            href={href(n)}
            aria-current={n === pagina ? "page" : undefined}
            className={cn(
              boton,
              n === pagina
                ? "border-transparent bg-[color-mix(in_oklch,var(--navy)_88%,var(--primary))] text-white shadow-[inset_0_-2px_0_var(--primary)]"
                : "border-border text-muted-foreground hover:border-primary/50 hover:text-primary"
            )}
          >
            {n}
          </Link>
        ))}
        {pagina < paginas ? (
          <Link href={href(pagina + 1)} className={cn(boton, "border-border text-muted-foreground hover:border-primary/50 hover:text-primary")} aria-label="Página siguiente">
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
