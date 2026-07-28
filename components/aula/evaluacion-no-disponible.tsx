import Link from "next/link";
import { CalendarX, Lock, PowerOff } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type MotivoNoDisponible = "bloqueada" | "inactiva" | "vencida";

/**
 * Por qué el estudiante no puede presentar la evaluación.
 *
 * Antes esto era un `redirect` mudo al aula: la persona pinchaba la
 * evaluación, aparecía de vuelta en el temario y no tenía forma de saber si
 * había fallado algo, si le faltaba contenido o si el curso estaba mal
 * configurado. Cada caso ahora dice qué pasa y qué hacer.
 */
const MOTIVOS: Record<MotivoNoDisponible, { icono: LucideIcon; titulo: string; detalle: string }> = {
  bloqueada: {
    icono: Lock,
    titulo: "Todavía no puedes presentar esta evaluación",
    detalle:
      "Este curso se sigue en orden. Termina las lecciones y las evaluaciones anteriores y esta se abrirá sola.",
  },
  inactiva: {
    icono: PowerOff,
    titulo: "Esta evaluación no está disponible",
    detalle:
      "El tutor la retiró temporalmente, probablemente porque la está ajustando. Vuelve a intentarlo más tarde.",
  },
  vencida: {
    icono: CalendarX,
    titulo: "El plazo de esta formación ya venció",
    detalle:
      "No es posible presentar la evaluación fuera de fecha. Comunícate con Talento Humano si necesitas una prórroga.",
  },
};

export function EvaluacionNoDisponible({
  motivo,
  courseId,
}: {
  motivo: MotivoNoDisponible;
  courseId: string;
}) {
  const { icono: Icono, titulo, detalle } = MOTIVOS[motivo];
  return (
    <div className="surface-glass mx-auto flex max-w-lg flex-col items-center gap-3 p-10 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-[22px] bg-[color-mix(in_oklch,var(--accent)_14%,transparent)] text-[var(--accent)]">
        <Icono className="h-7 w-7" strokeWidth={1.5} />
      </span>
      <h1 className="font-display text-xl font-extrabold text-balance text-foreground">{titulo}</h1>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{detalle}</p>
      <Link href={`/aula/${courseId}`} className={cn(buttonVariants({ variant: "outline" }), "mt-2")}>
        Volver al contenido del curso
      </Link>
    </div>
  );
}
