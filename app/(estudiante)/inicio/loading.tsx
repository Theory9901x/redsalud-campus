import { Skeleton } from "@/components/ui/skeleton";
import { CourseGridSkeleton } from "@/components/cursos/course-grid-skeleton";

export default function InicioLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-10 px-4 py-8 sm:px-6">
      <Skeleton className="h-32 w-full rounded-2xl" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="surface space-y-4 p-6">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-10 rounded-xl" />
            </div>
            <Skeleton className="h-10 w-16" />
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <CourseGridSkeleton count={3} />
      </div>

      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <CourseGridSkeleton count={3} />
      </div>
    </main>
  );
}
