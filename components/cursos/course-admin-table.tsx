import Link from "next/link";
import Image from "next/image";
import { CalendarRange, BookOpen, Pencil, ExternalLink } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DeleteEntityButton } from "@/components/admin/delete-entity-button";
import { deleteCourseAction } from "@/app/admin/cursos/actions";
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
  /** Actividades del plan que usan este curso: si hay alguna, es contenido del PIC. */
  trainingActivities?: { plan: { title: string } }[];
};

export function CourseAdminTable({
  courses,
  basePath,
  /** Solo el admin puede eliminar cursos; el tutor gestiona los suyos sin borrarlos. */
  puedeEliminar = false,
}: {
  courses: CourseAdminListItem[];
  basePath: string;
  puedeEliminar?: boolean;
}) {
  if (courses.length === 0) {
    return (
      <EmptyState icon={BookOpen} title="No hay cursos todavía" description="Crea el primero para empezar a construir el catálogo." />
    );
  }

  return (
    <div className="surface-glass overflow-hidden">
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
                  <span className="min-w-0">
                    <span className="block font-medium text-foreground">{course.title}</span>
                    {/* Contenido del PIC: se gestiona desde el plan (ciclo
                        presaber/postsaber), no como curso de catálogo. */}
                    {course.trainingActivities && course.trainingActivities.length > 0 && (
                      <span className="mt-0.5 inline-flex items-center gap-1 rounded-md border border-warning/40 bg-warning/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning-foreground">
                        <CalendarRange className="h-3 w-3 shrink-0" aria-hidden="true" />
                        Plan de capacitaciones
                      </span>
                    )}
                  </span>
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
                  {puedeEliminar && (
                    <DeleteEntityButton
                      action={deleteCourseAction.bind(null, course.id)}
                      nombre={course.title}
                      descripcion={
                        course._count.enrollments > 0
                          ? `Se elimina el curso con su contenido, sus evaluaciones y las ${course._count.enrollments} inscripciones con su avance. No se puede deshacer. Si solo quieres sacarlo del catálogo, usa "Archivar".`
                          : 'Se elimina el curso con todo su contenido y evaluaciones. No se puede deshacer. Si solo quieres sacarlo del catálogo, usa "Archivar".'
                      }
                    />
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
