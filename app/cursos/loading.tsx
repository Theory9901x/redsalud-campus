import { Skeleton } from "@/components/ui/skeleton";
import { CourseGridSkeleton } from "@/components/cursos/course-grid-skeleton";

export default function CatalogoLoading() {
  return (
    <div className="space-y-10">
      <section className="space-y-4 text-center">
        <Skeleton className="mx-auto h-6 w-64 rounded-full" />
        <Skeleton className="mx-auto h-10 w-full max-w-2xl" />
        <Skeleton className="mx-auto h-4 w-full max-w-xl" />
      </section>
      <Skeleton className="h-12 w-full rounded-xl" />
      <CourseGridSkeleton count={6} />
    </div>
  );
}
