"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  Clock,
  Target,
  CheckCircle2,
  ArrowRight,
  SlidersHorizontal,
  Headphones,
  ShieldCheck,
  Award,
  HeartPulse,
  Users,
  Wrench,
  Pill,
  Stethoscope,
  Activity,
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

/**
 * Ícono y color por ÁREA, no por tipo de evaluación: es lo que da variedad
 * visual a la grilla, igual que el diseño de referencia. El ícono se elige
 * por palabras clave del nombre real del área (dato honesto, no inventado);
 * el color rota sobre los tokens semánticos ya existentes en el sistema
 * -nunca un hex nuevo-, así que la paleta se mantiene consistente en claro y
 * oscuro sin tocar globals.css.
 */
const PALETA_AREA = [
  { bg: "bg-primary/10", text: "text-primary", label: "text-primary" },
  { bg: "bg-success/15", text: "text-success", label: "text-success" },
  { bg: "bg-warning/15", text: "text-warning-foreground", label: "text-warning-foreground" },
] as const;

function iconoArea(area: string) {
  const a = area.toLowerCase();
  if (a.includes("atención") || a.includes("atencion") || a.includes("usuario")) return Headphones;
  if (a.includes("seguridad")) return ShieldCheck;
  if (a.includes("calidad")) return Award;
  if (a.includes("humaniza")) return HeartPulse;
  if (a.includes("talento humano")) return Users;
  if (a.includes("mantenimiento")) return Wrench;
  if (a.includes("farmac")) return Pill;
  if (a.includes("salud pública") || a.includes("salud publica")) return Stethoscope;
  if (a.includes("ruta")) return Activity;
  return ClipboardList;
}

function estiloArea(area: string) {
  let hash = 0;
  for (let i = 0; i < area.length; i++) hash = (hash * 31 + area.charCodeAt(i)) >>> 0;
  return PALETA_AREA[hash % PALETA_AREA.length];
}

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase();
}

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
    href: `/evaluaciones/${e.id}`,
    ctaLabel: "Responder",
    yaPresentado: false,
  }));

  return [...deCiclo, ...deEncuestas].sort((a, b) => a.area.localeCompare(b.area, "es") || a.titulo.localeCompare(b.titulo, "es"));
}

const TIPO_BADGE: Record<Tarjeta["tab"], string> = {
  PRESABER: "bg-warning/15 text-warning-foreground",
  POSTSABER: "bg-primary/10 text-primary",
  ENCUESTA: "bg-success/15 text-success",
};
const TIPO_ETIQUETA: Record<Tarjeta["tab"], string> = {
  PRESABER: "Presaber",
  POSTSABER: "Postsaber",
  ENCUESTA: "Encuesta",
};

/**
 * El tablero de "Evaluaciones de capacitación": todo lo que está ABIERTO
 * ahora mismo para presentar -presaber, postsaber y encuestas de opinión-,
 * en tarjetas iguales sin importar de dónde vengan, con pestañas para
 * separarlas por tipo. Cada tarjeta lleva directo a presentarla: cero pasos
 * intermedios, que era justo la queja original ("sigue siendo engorroso").
 */
export function EvaluacionesBoard({
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
    return tarjetas.filter((t) => tab === "TODAS" || t.tab === tab).filter((t) => !ocultarPresentadas || !t.yaPresentado);
  }, [tarjetas, tab, ocultarPresentadas]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-[21px]">
            Disponibles ahora
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Presaber, postsaber y encuestas abiertas para ti en este momento.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1 rounded-full border border-border/60 bg-card/80 p-1 shadow-sm backdrop-blur-sm">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                  tab === t.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.etiqueta}
              </button>
            ))}
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuAbierto((v) => !v)}
              className="flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-sm hover:bg-accent"
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              Filtros
            </button>
            {menuAbierto && (
              <div className="absolute right-0 top-full z-10 mt-2 w-60 rounded-xl border border-border bg-card p-3.5 shadow-xl">
                <label className="flex items-center gap-2.5 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={ocultarPresentadas}
                    onChange={(e) => setOcultarPresentadas(e.target.checked)}
                    className="h-4 w-4 rounded border-input"
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
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filtradas.map((t) => {
            const Icono = iconoArea(t.area);
            const color = estiloArea(t.area);
            return (
              <Link
                key={t.key}
                href={t.href}
                className="surface-lumen lumen-edge lumen-hover group flex flex-col gap-4 p-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl", color.bg)}>
                    <Icono className={cn("h-5 w-5", color.text)} aria-hidden="true" />
                  </span>
                  <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide", TIPO_BADGE[t.tab])}>
                    {TIPO_ETIQUETA[t.tab]}
                  </span>
                </div>

                <div className="min-w-0">
                  <p className={cn("text-[11px] font-bold uppercase tracking-wide", color.label)}>{t.area}</p>
                  <p className="mt-1 font-display text-base font-bold leading-snug text-foreground">{t.titulo}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t.descripcion}</p>
                </div>

                <div className="flex items-center gap-5 border-t border-border/60 pt-4">
                  {t.meta.map((m) => (
                    <span key={m.sub} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <m.icon className="h-4 w-4 text-muted-foreground/70" aria-hidden="true" />
                      <span className="font-semibold text-foreground">{m.label}</span>
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-4">
                  <span className="flex min-w-0 items-center gap-2.5 text-xs text-muted-foreground">
                    {t.tutorName ? (
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                        {iniciales(t.tutorName)}
                      </span>
                    ) : null}
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-foreground">{t.planTitle}</span>
                      {t.tutorName && <span className="block truncate">Tutor: {t.tutorName}</span>}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground transition-transform group-hover:translate-x-0.5">
                    {t.ctaLabel}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                </div>

                {t.yaPresentado && (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-success">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Ya presentado antes
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
