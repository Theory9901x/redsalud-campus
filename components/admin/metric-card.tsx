import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCENT_STYLES = {
  primary: {
    bar: "bg-gradient-to-r from-primary to-primary/50",
    icon: "bg-primary/10 text-primary",
    tint: "from-white to-primary/[0.06]",
    card: "metric-card-primary",
  },
  success: {
    bar: "bg-gradient-to-r from-success to-success/50",
    icon: "bg-success/10 text-success",
    tint: "from-white to-success/[0.06]",
    card: "metric-card-success",
  },
  warning: {
    bar: "bg-gradient-to-r from-warning to-warning/50",
    icon: "bg-warning/15 text-warning-foreground",
    tint: "from-white to-warning/[0.08]",
    card: "metric-card-warning",
  },
  destructive: {
    bar: "bg-gradient-to-r from-destructive to-destructive/50",
    icon: "bg-destructive/10 text-destructive",
    tint: "from-white to-destructive/[0.06]",
    card: "metric-card-destructive",
  },
} as const;

export function MetricCard({
  label,
  value,
  suffix = "",
  icon: Icon,
  accent = "primary",
  href,
}: {
  label: string;
  value: number;
  /** Ej: "%" para métricas de porcentaje, sin cambiar el formato de miles del valor. */
  suffix?: string;
  icon: LucideIcon;
  accent?: "primary" | "success" | "warning" | "destructive";
  href?: string;
}) {
  const styles = ACCENT_STYLES[accent];

  const content = (
    <>
      <span className={cn("absolute inset-x-0 top-0 h-1.5", styles.bar)} />
      <div className="flex items-center justify-between">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg transition-transform duration-300",
            href && "group-hover:scale-110",
            styles.icon
          )}
        >
          <Icon className="h-4 w-4" strokeWidth={2.25} />
        </div>
        {href && (
          <ChevronRight className="h-4 w-4 text-muted-foreground/50 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
        )}
      </div>
      <p className="mt-3 font-display text-3xl font-extrabold tracking-tight text-foreground">
        {value.toLocaleString("es-CO")}
        {suffix}
      </p>
      <p className="mt-0.5 text-sm font-medium text-foreground/60">{label}</p>
    </>
  );

  const sharedClassName = cn("metric-card bg-gradient-to-br p-4", styles.tint, styles.card, href && "is-clickable");

  if (href) {
    return (
      <Link
        href={href}
        className={cn(sharedClassName, "group block outline-none focus-visible:ring-3 focus-visible:ring-ring/50")}
      >
        {content}
      </Link>
    );
  }

  return <div className={sharedClassName}>{content}</div>;
}
