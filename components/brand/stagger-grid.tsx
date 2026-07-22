import { Children, isValidElement } from "react";
import { cn } from "@/lib/utils";

/** Igual que StaggerSections pero para una grilla. También sin JavaScript. */
export function StaggerGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("stagger-in grid", className)}>
      {Children.map(children, (child, index) =>
        isValidElement(child) ? (
          <div className="view-fade-in" style={{ "--i": index } as React.CSSProperties}>
            {child}
          </div>
        ) : (
          child
        )
      )}
    </div>
  );
}
