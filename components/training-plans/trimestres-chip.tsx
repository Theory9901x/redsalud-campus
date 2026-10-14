import { cn } from "@/lib/utils";

const MESES_TRIMESTRE = ["ene–mar", "abr–jun", "jul–sep", "oct–dic"] as const;
const ROMANO = ["I", "II", "III", "IV"] as const;

/** Trimestre calendario en curso (1–4). */
export function trimestreEnCurso(hoy: Date = new Date()): number {
  return Math.floor(hoy.getMonth() / 3) + 1;
}

/** "Trimestre III · jul–sep". */
export function nombreTrimestre(t: number, conMeses = true): string {
  return `Trimestre ${ROMANO[t - 1] ?? t}${conMeses ? ` · ${MESES_TRIMESTRE[t - 1] ?? ""}` : ""}`;
}

/**
 * Cuatro casillas T1·T2·T3·T4: encendidas las que programa el PIC, con un
 * borde el trimestre en curso. Antes el trimestre iba en un texto gris
 * ("Trimestres I, II y III") que los administradores no veían; esto se lee
 * de un vistazo y se puede comparar entre tarjetas.
 */
export function TrimestresChip({ quarters, className, tamano = "md" }: { quarters: number[]; className?: string; tamano?: "sm" | "md" }) {
  const actual = trimestreEnCurso();
  const titulo = quarters.length ? `Programado en ${quarters.map((q) => `T${q}`).join(", ")}` : "Sin trimestre programado";
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} title={titulo} aria-label={titulo}>
      {[1, 2, 3, 4].map((t) => {
        const activo = quarters.includes(t);
        return (
          <span
            key={t}
            className={cn(
              "grid place-items-center rounded-[5px] border font-mono font-semibold tabular-nums transition-colors",
              tamano === "sm" ? "h-5 w-6 text-[9.5px]" : "h-6 w-7 text-[10px]",
              activo
                ? "border-primary/45 bg-primary/12 text-primary"
                : "border-border bg-transparent text-muted-foreground/45",
              t === actual && (activo ? "border-primary bg-primary text-primary-foreground shadow-[0_0_12px_-2px_var(--primary)]" : "border-primary/60 border-dashed")
            )}
          >
            T{t}
          </span>
        );
      })}
    </span>
  );
}
