import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center",
        className
      )}
    >
      <div
        className="flex h-14 w-14 items-center justify-center rounded-2xl text-primary shadow-inner"
        style={{ background: "linear-gradient(135deg in oklch, color-mix(in oklch, var(--primary) 16%, transparent), color-mix(in oklch, var(--success) 12%, transparent))" }}
      >
        <Icon className="h-7 w-7" strokeWidth={1.75} />
      </div>
      <h3 className="font-display text-base font-bold text-foreground">{title}</h3>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
