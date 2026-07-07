import { Skeleton } from "@/components/ui/skeleton";
import { CourseGridSkeleton } from "@/components/cursos/course-grid-skeleton";

export default function TutorCursosLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <CourseGridSkeleton count={3} />
    </div>
  );
}
