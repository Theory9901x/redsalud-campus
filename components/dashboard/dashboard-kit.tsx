import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Kit de dashboard compartido por los tres roles (estudiante, tutor, admin).
 * Los tres consumen ESTOS componentes; lo único que cambia son los datos y
 * el token --accent que fija DashboardShell. Si hace falta una variante, se
 * hace por prop, nunca copiando el componente.
 *
 * Todos son Server Components: no llevan estado ni interacción, así que no
 * suman nada al bundle de cliente.
 */

export type AccentRole = "student" | "tutor" | "admin";

const ACCENT_CLASS: Record<AccentRole, string> = {
  student: "accent-student",
  tutor: "accent-tutor",
  admin: "accent-admin",
};

/** Contenedor raíz: fija el acento del rol y el ritmo vertical. */
export function DashboardShell({
  role,
  children,
  className,
}: {
  role: AccentRole;
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn(ACCENT_CLASS[role], "space-y-6", className)}>{children}</div>;
}

/** Hero tipo HUD: saludo + fecha a la izquierda, acciones rápidas a la derecha. */
export function DashboardHero({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  const today = new Date().toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <section className="hud-hero hud-grid noise-overlay px-6 py-7 text-white sm:px-8">
      {/* Orbes del mesh: animan solo transform, compuesto en GPU. */}
      <div className="mesh-orb -left-24 top-[-30%] h-72 w-72 bg-[color-mix(in_oklch,var(--accent)_60%,transparent)]" />
      <div className="mesh-orb mesh-orb-slow -right-16 bottom-[-40%] h-64 w-64 bg-primary/40" />

      <div className="relative flex flex-wrap items-end justify-between gap-5">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-[color-mix(in_oklch,var(--accent)_70%,white)] backdrop-blur">
            {eyebrow}
          </span>
          <h1 className="mt-3 font-display text-2xl font-extrabold tracking-tight text-balance sm:text-3xl">
            {title}
          </h1>
          {subtitle && <p className="mt-1.5 max-w-lg text-sm text-white/70">{subtitle}</p>}
          {/* first-letter, no `capitalize`: este último pone mayúscula en cada
              palabra ("Martes, 21 De Julio De 2026"). */}
          <p className="mt-1 text-xs text-white/45 first-letter:uppercase">{today}</p>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </section>
  );
}

/** Acción rápida del hero (botón futurista sobre el navy). */
export function QuickAction({ href, label, icon: Icon }: { href: string; label: string; icon: LucideIcon }) {
  return (
    <Link href={href} className="btn-hud focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

/** Tarjeta de KPI: ícono en contenedor de acento + número hero con degradado. */
export function KpiCard({
  label,
  value,
  icon: Icon,
  trend,
  href,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  /** Micro-tendencia opcional; `positive` decide el color, no el signo del texto. */
  trend?: { text: string; positive: boolean };
  href?: string;
}) {
  const content = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_oklch,var(--accent)_14%,transparent)] text-[var(--accent)]">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="kpi-number text-2xl">{value}</p>
        <p className="mt-1 text-xs leading-tight text-muted-foreground">{label}</p>
        {trend && (
          <p className={cn("mt-0.5 text-[11px] font-medium", trend.positive ? "text-success" : "text-muted-foreground")}>
            {trend.text}
          </p>
        )}
      </div>
    </>
  );

  const className = cn(
    "surface-clay flex items-center gap-3 px-4 py-4 transition-all duration-200",
    href && "hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
  );

  return href ? (
    <Link href={href} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

/** Panel con borde luminoso: envuelve gráfica, actividad y listas. */
export function DashboardPanel({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("panel-hud p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-extrabold text-foreground">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export type ActivityItem = {
  at: Date;
  text: string;
  icon: LucideIcon;
  /** Clases de color del nodo (fondo + texto), p. ej. "bg-success/10 text-success". */
  tone: string;
};

/** Timeline vertical con línea de acento visible y un nodo por tipo de evento. */
export function ActivityTimeline({ items }: { items: ActivityItem[] }) {
  return (
    <div className="relative max-h-[420px] overflow-y-auto pr-1">
      <span
        aria-hidden="true"
        className="absolute bottom-2 left-[15px] top-2 w-[2.5px] rounded-full bg-[color-mix(in_oklch,var(--accent)_28%,transparent)]"
      />
      <ul className="space-y-4">
        {items.map((item, index) => (
          <li key={index} className="relative flex items-start gap-3">
            <span className={cn("relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full", item.tone)}>
              <item.icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 pt-1">
              <p className="text-sm leading-snug text-foreground/85">{item.text}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {item.at.toLocaleDateString("es-CO", { day: "numeric", month: "short" })}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export type AttentionItem = { title: string; problem: string; cta: string; href: string };

/** Lista de cosas que requieren acción, cada una con su CTA directo. */
export function AttentionList({ items, allClearText }: { items: AttentionItem[]; allClearText: string }) {
  if (items.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-xl bg-success/10 px-4 py-3 text-sm text-success">{allClearText}</p>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {items.map((item, index) => (
        <li key={index} className="flex flex-wrap items-center justify-between gap-2 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{item.title}</p>
            <p className="text-xs text-muted-foreground">{item.problem}</p>
          </div>
          <Link href={item.href} className="btn-hud-ghost shrink-0 py-1.5 text-xs">
            {item.cta}
          </Link>
        </li>
      ))}
    </ul>
  );
}
