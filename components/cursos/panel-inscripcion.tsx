import Link from "next/link";
import { BookOpen, CheckCircle2, Clock, Layers, Target, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { ENROLLMENT_MODE_LABELS } from "@/components/cursos/labels";
import type { EnrollmentMode } from "@prisma/client";

/**
 * Panel lateral de la ficha del curso: avance, acción principal y datos.
 *
 * La barra de progreso antes se pintaba sola, sin etiqueta ni porcentaje. Al
 * 100 % quedaba una raya de color encima del botón que no se entendía como
 * progreso: parecía un adorno mal puesto. Ahora el avance es un bloque con su
 * título, su cifra y su barra, y cuando el curso está terminado se sustituye
 * por el sello de completado, que es lo que de verdad hay que comunicar.
 */
export function PanelInscripcion({
  courseId,
  progreso,
  completado,
  durationHours,
  passingScore,
  enrollmentMode,
  modulos,
  lecciones,
  inscritos,
  accion,
}: {
  courseId: string;
  /** Avance de quien mira. null cuando no está inscrito o no hay sesión. */
  progreso: number | null;
  completado: boolean;
  durationHours: number;
  passingScore: number;
  enrollmentMode: EnrollmentMode;
  modulos: number;
  lecciones: number;
  inscritos: number;
  /** Botón o mensaje que decide la página según la sesión y la inscripción. */
  accion: React.ReactNode;
}) {
  return (
    <div className="surface-panel surface-accent-top overflow-hidden">
      {progreso !== null && (
        <div
          className={cn(
            "border-b border-border px-6 py-5",
            completado
              ? "bg-[color-mix(in_oklch,var(--success)_10%,transparent)]"
              : "bg-[color-mix(in_oklch,var(--primary)_7%,transparent)]"
          )}
        >
          {completado ? (
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-success/15 text-success">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="font-display text-sm font-extrabold text-foreground">Curso completado</p>
                <p className="text-xs text-muted-foreground">Ya puedes descargar tu certificado.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Tu avance</p>
                <p className="font-display text-lg font-extrabold tabular-nums text-foreground">{progreso}%</p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[color-mix(in_oklch,var(--primary)_16%,transparent)]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-[var(--accent)] transition-[width] duration-700"
                  style={{ width: `${progreso}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {progreso === 0 ? "Todavía no has empezado." : "Sigue donde lo dejaste."}
              </p>
            </>
          )}
        </div>
      )}

      <div className="space-y-4 p-6">
        {accion}

        {/* Ficha técnica: etiqueta arriba y valor abajo, en vez de frases
            sueltas. Así se leen en vertical y se comparan de un vistazo. */}
        <dl className="divide-y divide-border rounded-2xl border border-border bg-card/50">
          {durationHours > 0 && (
            <Dato icono={Clock} tinte="primary" etiqueta="Duración" valor={`${durationHours} horas`} />
          )}
          <Dato icono={Target} tinte="warning" etiqueta="Puntaje mínimo" valor={`${passingScore}%`} />
          <Dato
            icono={Layers}
            tinte="accent"
            etiqueta="Contenido"
            valor={`${modulos} ${modulos === 1 ? "módulo" : "módulos"} · ${lecciones} ${lecciones === 1 ? "lección" : "lecciones"}`}
          />
          <Dato
            icono={Users}
            tinte="success"
            etiqueta="Inscripción"
            valor={ENROLLMENT_MODE_LABELS[enrollmentMode]}
          />
          {inscritos > 0 && (
            <Dato
              icono={BookOpen}
              tinte="primary"
              etiqueta="Participantes"
              valor={`${inscritos} ${inscritos === 1 ? "persona inscrita" : "personas inscritas"}`}
            />
          )}
        </dl>

        {progreso !== null && !completado && (
          <Link
            href={`/aula/${courseId}`}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-full text-muted-foreground")}
          >
            Ver el contenido del curso
          </Link>
        )}
      </div>
    </div>
  );
}

const TINTES = {
  primary: "bg-primary/10 text-primary",
  warning: "bg-warning/15 text-warning-foreground",
  success: "bg-success/10 text-success",
  accent: "bg-[color-mix(in_oklch,var(--accent)_14%,transparent)] text-[var(--accent)]",
} as const;

function Dato({
  icono: Icono,
  tinte,
  etiqueta,
  valor,
}: {
  icono: LucideIcon;
  tinte: keyof typeof TINTES;
  etiqueta: string;
  valor: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", TINTES[tinte])}>
        <Icono className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <dt className="text-[11px] font-medium text-muted-foreground">{etiqueta}</dt>
        <dd className="truncate text-[13.5px] font-semibold text-foreground">{valor}</dd>
      </div>
    </div>
  );
}
