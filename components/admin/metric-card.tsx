import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  icon: Icon,
  accent = "primary",
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  accent?: "primary" | "success" | "warning" | "destructive";
}) {
  return (
    <div className="surface surface-hover relative overflow-hidden p-6">
      <span
        className={cn(
          "absolute inset-x-0 top-0 h-1",
          accent === "primary" && "bg-primary",
          accent === "success" && "bg-success",
          accent === "warning" && "bg-warning",
          accent === "destructive" && "bg-destructive"
        )}
      />
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground/70">{label}</p>
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl",
            accent === "primary" && "bg-primary/10 text-primary",
            accent === "success" && "bg-success/10 text-success",
            accent === "warning" && "bg-warning/15 text-warning-foreground",
            accent === "destructive" && "bg-destructive/10 text-destructive"
          )}
        >
          <Icon className="h-5 w-5" strokeWidth={2.25} />
        </div>
      </div>
      <p className="mt-4 font-display text-5xl font-extrabold tracking-tight text-foreground">
        {value.toLocaleString("es-CO")}
      </p>
    </div>
  );
}
