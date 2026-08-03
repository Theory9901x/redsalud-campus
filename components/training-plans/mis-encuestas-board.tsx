"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ShieldQuestion,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Target,
  User,
  CheckCircle2,
  ArrowRight,
  SlidersHorizontal,
} from "lucide-react";
import { EmptyState } from "@/components/brand/empty-state";
import { cn } from "@/lib/utils";

export type EvaluacionCiclo = {
  activityId: string;
  titulo: string;
  area: string;
  tutorName: string | null;
  planTitle: string;
  momento: "PRESABER" | "POSTSABER";
  yaPresentado: boolean;
  timeLimitMinutes: number | null;
  passingScore: number;
};

export type EncuestaPendiente = {
  id: string;
  title: string;
  trainingPlan: { title: string };
  trainingActivity: { title: string; area: { name: string; tutor: { fullName: string } | null } | null } | null;
  _count: { questions: number };
};

type Tarjeta = {
  key: string;
  tab: "PRESABER" | "POSTSABER" | "ENCUESTA";
  area: string;
  titulo: string;
  descripcion: string;
  planTitle: string;
  tutorName: string | null;
  meta: { icon: typeof Clock; label: string; sub: string }[];
  href: string;
  ctaLabel: string;
  yaPresentado: boolean;
};

const DESCRIPCIONES: Record<Tarjeta["tab"], string> = {
  PRESABER: "Evalúa lo que sabes antes de tomar la capacitación.",
  POSTSABER: "Evalúa lo aprendido, al cierre de la capacitación.",
  ENCUESTA: "Encuesta de opinión: no tiene nota, cuenta tu punto de vista.",
};

const TABS = [
  { id: "TODAS", etiqueta: "Todas" },
  { id: "PRESABER", etiqueta: "Presaber" },
  { id: "POSTSABER", etiqueta: "Postsaber" },
  { id: "ENCUESTA", etiqueta: "Encuestas" },
] as const;
type TabId = (typeof TABS)[number]["id"];

function armarTarjetas(evaluaciones: EvaluacionCiclo[], encuestas: EncuestaPendiente[]): Tarjeta[] {
  const deCiclo: Tarjeta[] = evaluaciones.map((ev) => ({
    key: `${ev.activityId}-${ev.momento}`,
    tab: ev.momento,
    area: ev.area,
    titulo: ev.titulo,
    descripcion: DESCRIPCIONES[ev.momento],
    planTitle: ev.planTitle,
    tutorName: ev.tutorName,
    meta: [
      { icon: Clock, label: ev.timeLimitMinutes ? `${ev.timeLimitMinutes} min` : "Sin límite", sub: "Duración estimada" },
      { icon: Target, label: `${ev.passingScore}%`, sub: "Mínimo para aprobar" },
    ],
    href: `/c/${ev.activityId}/${ev.momento === "PRESABER" ? "presaber" : "postsaber"}`,
    ctaLabel: "Presentar ahora",
    yaPresentado: ev.yaPresentado,
  }));

  const deEncuestas: Tarjeta[] = encuestas.map((e) => ({
    key: e.id,
    tab: "ENCUESTA",
    area: e.trainingActivity?.area?.name ?? "Plan general",
    titulo: e.title,
    descripcion: DESCRIPCIONES.ENCUESTA,
    planTitle: e.trainingPlan.title,
    tutorName: e.trainingActivity?.area?.tutor?.fullName ?? null,
    meta: [
      {
        icon: ClipboardList,
        label: `${e._count.questions} ${e._count.questions === 1 ? "pregunta" : "preguntas"}`,
        sub: "Extensión",
      },
    ],
    href: `/mis-encuestas/${e.id}`,
    ctaLabel: "Responder",
    yaPresentado: false,
  }));

  return [...deCiclo, ...deEncuestas].sort((a, b) => a.area.localeCompare(b.area, "es") || a.titulo.localeCompare(b.titulo, "es"));
}

const TAB_STYLES: Record<Tarjeta["tab"], { badge: string; icon: string; Icon: typeof ShieldQuestion }> = {
  PRESABER: { badge: "bg-warning/15 text-warning-foreground", icon: "bg-warning/15 text-warning-foreground", Icon: ShieldQuestion },
  POSTSABER: { badge: "bg-primary/10 text-primary", icon: "bg-primary/10 text-primary", Icon: ClipboardCheck },
  ENCUESTA: { badge: "bg-success/15 text-success", icon: "bg-success/15 text-success", Icon: ClipboardList },
};

/**
 * El tablero de "Mis encuestas y evaluaciones": todo lo que está ABIERTO
 * ahora mismo para presentar -presaber, postsaber y encuestas de opinión-,
 * en tarjetas iguales sin importar de dónde vengan, con pestañas para
 * separarlas por tipo. Cada tarjeta lleva directo a presentarla: cero pasos
 * intermedios, que era justo la queja ("sigue siendo engorroso").
 */
export function MisEncuestasBoard({
  evaluaciones,
  encuestas,
}: {
  evaluaciones: EvaluacionCiclo[];
  encuestas: EncuestaPendiente[];
}) {
  const [tab, setTab] = useState<TabId>("TODAS");
  const [ocultarPresentadas, setOcultarPresentadas] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);

  const tarjetas = useMemo(() => armarTarjetas(evaluaciones, encuestas), [evaluaciones, encuestas]);

  const filtradas = useMemo(() => {
    return tarjetas
      .filter((t) => tab === "TODAS" || t.tab === tab)
      .filter((t) => !ocultarPresentadas || !t.yaPresentado);
  }, [tarjetas, tab, ocultarPresentadas]);

  const conteos = useMemo(() => {
    const c: Record<TabId, number> = { TODAS: tarjetas.length, PRESABER: 0, POSTSABER: 0, ENCUESTA: 0 };
    for (const t of tarjetas) c[t.tab]++;
    return c;
  }, [tarjetas]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-extrabold text-foreground">Evaluaciones disponibles</h2>
          <p className="text-xs text-muted-foreground">Presaber, postsaber y encuestas abiertas para ti.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-full bg-muted p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                  tab === t.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.etiqueta}
                {conteos[t.id] > 0 && (
                  <span className={cn("text-[10px]", tab === t.id ? "text-primary-foreground/80" : "text-muted-foreground/70")}>
                    {conteos[t.id]}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuAbierto((v) => !v)}
              className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              Filtros
            </button>
            {menuAbierto && (
              <div className="absolute right-0 top-full z-10 mt-1.5 w-56 rounded-lg border border-border bg-card p-3 shadow-lg">
                <label className="flex items-center gap-2 text-xs text-foreground">
                  <input
                    type="checkbox"
                    checked={ocultarPresentadas}
                    onChange={(e) => setOcultarPresentadas(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-input"
                  />
                  Ocultar ya presentadas
                </label>
              </div>
            )}
          </div>
        </div>
      </div>

      {filtradas.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nada disponible con este filtro"
          description="Cuando se habilite una evaluación o encuesta, aparecerá aquí."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {filtradas.map((t) => {
            const estilo = TAB_STYLES[t.tab];
            return (
              <Link
                key={t.key}
                href={t.href}
                className="surface-clay group flex flex-col gap-3 p-5 transition-all duration-200 hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", estilo.icon)}>
                    <estilo.Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", estilo.badge)}>
                    {t.tab === "ENCUESTA" ? "Encuesta" : t.tab === "PRESABER" ? "Presaber" : "Postsaber"}
                  </span>
                </div>

                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t.area}</p>
                  <p className="mt-0.5 font-display text-sm font-bold leading-snug text-foreground">{t.titulo}</p>
                  <p className="mt-1 text-xs leading-snug text-muted-foreground">{t.descripcion}</p>
                </div>

                <div className="flex items-center gap-4 border-t border-border/60 pt-3">
                  {t.meta.map((m) => (
                    <span key={m.sub} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <m.icon className="h-3.5 w-3.5 text-muted-foreground/70" aria-hidden="true" />
                      <span className="font-semibold text-foreground">{m.label}</span>
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-3">
                  <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                    <User className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{t.tutorName ?? t.planTitle}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground transition-transform group-hover:translate-x-0.5">
                    {t.ctaLabel}
                    <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  </span>
                </div>

                {t.yaPresentado && (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-success">
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Ya presentado antes
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
