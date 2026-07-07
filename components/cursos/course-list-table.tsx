import { Layers, Clock, User, BookOpen } from "lucide-react";
import { EmptyState } from "@/components/brand/empty-state";
import { CourseGrid } from "@/components/cursos/course-grid";
import { CoursePosterCard } from "@/components/cursos/course-poster-card";
import { COURSE_STATUS_LABELS, COURSE_STATUS_DOT } from "@/components/cursos/labels";
import type { CourseStatus, CourseType } from "@prisma/client";

export type CourseListItem = {
  id: string;
  title: string;
  courseType: CourseType;
  status: CourseStatus;
  durationHours: number;
  imageUrl: string | null;
  category: { name: string } | null;
  tutor: { fullName: string };
  _count: { modules: number; enrollments: number };
};

export function CourseListTable({
  courses,
  basePath,
  showTutorColumn,
}: {
  courses: CourseListItem[];
  basePath: string;
  showTutorColumn: boolean;
}) {
  if (courses.length === 0) {
    return (
      <EmptyState icon={BookOpen} title="No hay cursos todavía" description="Crea el primero para empezar a construir el catálogo." />
    );
  }

  return (
    <CourseGrid>
      {courses.map((course) => (
        <CoursePosterCard
          key={course.id}
          href={`${basePath}/${course.id}`}
          imageUrl={course.imageUrl}
          title={course.title}
          courseType={course.courseType}
          eyebrow={course.category?.name}
          statusBadge={{ label: COURSE_STATUS_LABELS[course.status], dotClassName: COURSE_STATUS_DOT[course.status] }}
          meta={[
            { icon: Layers, label: `${course._count.modules} ${course._count.modules === 1 ? "módulo" : "módulos"}` },
            { icon: Clock, label: `${course.durationHours}h` },
            ...(showTutorColumn ? [{ icon: User, label: course.tutor.fullName }] : []),
          ]}
        />
      ))}
    </CourseGrid>
  );
}
