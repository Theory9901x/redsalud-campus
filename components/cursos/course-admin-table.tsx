import Link from "next/link";
import Image from "next/image";
import { BookOpen, Pencil, ExternalLink } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/brand/empty-state";
import { COURSE_TYPE_LABELS, COURSE_STATUS_LABELS, COURSE_STATUS_CLASSES } from "@/components/cursos/labels";
import type { CourseStatus, CourseType } from "@prisma/client";

export type CourseAdminListItem = {
  id: string;
  title: string;
  slug: string;
  courseType: CourseType;
  status: CourseStatus;
  durationHours: number;
  imageUrl: string | null;
  category: { name: string } | null;
  tutor: { fullName: string };
  _count: { modules: number; enrollments: number };
};

export function CourseAdminTable({
  courses,
  basePath,
}: {
  courses: CourseAdminListItem[];
  basePath: string;
}) {
  if (courses.length === 0) {
    return (
      <EmptyState icon={BookOpen} title="No hay cursos todavía" description="Crea el primero para empezar a construir el catálogo." />
    );
  }

  return (
    <div className="surface-panel overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Curso</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Tutor</TableHead>
            <TableHead className="text-center">Duración</TableHead>
            <TableHead className="text-center">Módulos</TableHead>
            <TableHead className="text-center">Inscritos</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {courses.map((course) => (
            <TableRow key={course.id}>
              <TableCell>
                <Link href={`${basePath}/${course.id}`} className="flex items-center gap-3 hover:underline">
                  <span className="relative flex h-9 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                    {course.imageUrl ? (
                      <Image src={course.imageUrl} alt="" fill sizes="56px" className="object-cover" />
                    ) : (
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                    )}
                  </span>
                  <span className="font-medium text-foreground">{course.title}</span>
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">{course.category?.name ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">{COURSE_TYPE_LABELS[course.courseType]}</TableCell>
              <TableCell className="text-muted-foreground">{course.tutor.fullName}</TableCell>
              <TableCell className="text-center text-muted-foreground">{course.durationHours}h</TableCell>
              <TableCell className="text-center text-muted-foreground">{course._count.modules}</TableCell>
              <TableCell className="text-center text-muted-foreground">{course._count.enrollments}</TableCell>
              <TableCell>
                <Badge className={COURSE_STATUS_CLASSES[course.status]}>{COURSE_STATUS_LABELS[course.status]}</Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  {course.status === "PUBLISHED" && (
                    <Link
                      href={`/cursos/${course.slug}`}
                      target="_blank"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Ver en el catálogo"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  )}
                  <Link
                    href={`${basePath}/${course.id}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-primary hover:bg-primary/10"
                    title="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </Link>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
