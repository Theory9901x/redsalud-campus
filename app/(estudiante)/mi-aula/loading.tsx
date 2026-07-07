import { Skeleton } from "@/components/ui/skeleton";
import { CourseGridSkeleton } from "@/components/cursos/course-grid-skeleton";

export default function MiAulaLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-10 px-4 py-8 sm:px-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>

      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <CourseGridSkeleton count={3} />
      </div>

      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    </main>
  );
}
