import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shell reutilizable para las secciones de contenido del detalle de curso:
 * franja de acento + ícono con color propio por sección (identidad) +
 * título display, para que dejen de verse como rectángulos idénticos.
 */
export function CourseDetailCard({
  icon: Icon,
  iconClassName,
  title,
  action,
  children,
  className,
}: {
  icon: LucideIcon;
  iconClassName: string;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("surface surface-accent-top p-6", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", iconClassName)}>
            <Icon className="h-[18px] w-[18px]" />
          </span>
          <h2 className="font-display text-lg font-extrabold text-foreground">{title}</h2>
        </div>
        {action}
      </div>
      <div className="pt-4">{children}</div>
    </div>
  );
}
