import { StaggerGrid } from "@/components/brand/stagger-grid";
import { cn } from "@/lib/utils";

export function CourseGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <StaggerGrid className={cn("grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4", className)}>
      {children}
    </StaggerGrid>
  );
}
