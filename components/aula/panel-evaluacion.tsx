"use client";

import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Lightbulb,
  PenLine,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Columna derecha de la evaluación: resumen, ficha del curso y consejos.
 *
 * Es la parte del diseño de referencia que faltaba. Los tres paneles son de
 * lectura -no hay ningún control aquí-, así que no compiten por la atención
 * con las preguntas, pero responden lo que el estudiante se pregunta a mitad
 * de una prueba: cuánto llevo, hasta cuándo tengo, con cuánto apruebo.
 *
 * El resumen NO muestra puntaje estimado: mientras el intento está abierto el
 * servidor no ha calificado nada, y una cifra inventada aquí sería la peor
 * clase de mentira. Por eso la tercera métrica es "marcadas", no "aciertos".
 */

const ANILLO_RADIO = 16;
const CIRCUNFERENCIA = 2 * Math.PI * ANILLO_RADIO;

export function PanelEvaluacion({
  respondidas,
  total,
  marcadas,
  area,
  tutor,
  fechaLimite,
  passingScore,
}: {
  respondidas: number;
  total: number;
  marcadas: number;
  area: string | null;
  tutor: string;
  fechaLimite: Date | null;
  passingScore: number;
}) {
  const pct = total === 0 ? 0 : Math.round((respondidas / total) * 100);
  const pendientes = total - respondidas;

  return (
    <div className="space-y-4">
      {/* ---- Resumen ---- */}
      <section className="surface-glass p-5">
        <h2 className="font-display text-sm font-bold text-foreground">Resumen de evaluación</h2>
        <div className="mt-4 flex items-center gap-5">
          <svg
            width="92"
            height="92"
            viewBox="0 0 42 42"
            className="shrink-0"
            role="img"
            aria-label={`${pct} por ciento de la evaluación respondida`}
          >
            <circle
              cx="21"
              cy="21"
              r={ANILLO_RADIO}
              fill="none"
              strokeWidth="5"
              stroke="color-mix(in oklch, var(--accent) 15%, transparent)"
            />
            <circle
              cx="21"
              cy="21"
              r={ANILLO_RADIO}
              fill="none"
              strokeWidth="5"
              stroke="var(--accent)"
              strokeLinecap="round"
              strokeDasharray={`${(pct / 100) * CIRCUNFERENCIA} ${CIRCUNFERENCIA}`}
              transform="rotate(-90 21 21)"
              style={{ transition: "stroke-dasharray var(--duration-signature) var(--ease-signature)" }}
            />
            <text x="21" y="21" textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--foreground)">
              {pct}%
            </text>
            <text x="21" y="27" textAnchor="middle" fontSize="4.2" fill="var(--muted-foreground)">
              Completado
            </text>
          </svg>

          <dl className="min-w-0 flex-1 space-y-2 text-[12.5px]">
            <Metrica color="var(--success)" etiqueta="Respondidas" valor={respondidas} />
            <Metrica color="var(--warning)" etiqueta="Pendientes" valor={pendientes} />
            <Metrica color="var(--accent)" etiqueta="Marcadas" valor={marcadas} />
          </dl>
        </div>

        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_oklch,var(--accent)_14%,transparent)]">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>Progreso</span>
          <span className="font-semibold text-foreground">
            {respondidas} de {total}
          </span>
        </p>
      </section>

      {/* ---- Ficha del curso ---- */}
      <section className="surface-glass p-5">
        <h2 className="font-display text-sm font-bold text-foreground">Información del curso</h2>
        <dl className="mt-3">
          {area && <Fila icono={BookOpen} etiqueta="Área" valor={area} />}
          <Fila icono={UserRound} etiqueta="Responsable" valor={tutor} />
          <Fila
            icono={CalendarDays}
            etiqueta="Fecha límite"
            valor={
              fechaLimite
                ? fechaLimite.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })
                : "Sin fecha límite"
            }
          />
          <Fila icono={ShieldCheck} etiqueta="Criterio de aprobación" valor={`Obtener ${passingScore}% o más`} />
        </dl>
      </section>

      {/* ---- Consejos ---- */}
      <section className="surface-glass p-5">
        <h2 className="font-display text-sm font-bold text-foreground">Consejos para tu evaluación</h2>
        <ul className="mt-3 space-y-3 text-[12.5px] text-muted-foreground">
          <Consejo icono={BookOpen}>Lee con calma cada pregunta antes de responder.</Consejo>
          <Consejo icono={PenLine}>En las abiertas, responde con tus propias palabras.</Consejo>
          <Consejo icono={Lightbulb}>Sé concreto: vale más una idea clara que tres a medias.</Consejo>
          <Consejo icono={Sparkles}>
            Puedes marcar una pregunta y volver a ella; se guarda sola mientras respondes.
          </Consejo>
        </ul>
      </section>
    </div>
  );
}

function Metrica({ color, etiqueta, valor }: { color: string; etiqueta: string; valor: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <dt className="min-w-0 flex-1 truncate text-muted-foreground">{etiqueta}</dt>
      <dd className="shrink-0 font-bold tabular-nums text-foreground">{valor}</dd>
    </div>
  );
}

function Fila({ icono: Icono, etiqueta, valor }: { icono: LucideIcon; etiqueta: string; valor: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-border py-2.5 last:border-b-0">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[color-mix(in_oklch,var(--accent)_14%,transparent)] text-[var(--accent)]">
        <Icono className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <dt className="text-[11.5px] text-muted-foreground">{etiqueta}</dt>
        <dd className="truncate text-[13px] font-semibold text-foreground">{valor}</dd>
      </div>
    </div>
  );
}

function Consejo({ icono: Icono, children }: { icono: LucideIcon; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[color-mix(in_oklch,var(--accent)_12%,transparent)] text-[var(--accent)]">
        <Icono className="h-3.5 w-3.5" />
      </span>
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}

/** Icono de "guardado" reutilizado en el pie de cada pregunta. */
export function RespuestaGuardada() {
  return (
    <span className="inline-flex items-center gap-1 font-semibold text-success">
      <CheckCircle2 className="h-3.5 w-3.5" />
      Respuesta guardada
    </span>
  );
}
