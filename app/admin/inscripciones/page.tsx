import { UserPlus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AssignEnrollmentForm } from "@/components/admin/assign-enrollment-form";
import { CancelEnrollmentButton } from "@/components/admin/cancel-enrollment-button";
import { StaggerSections } from "@/components/brand/stagger-sections";
import { ENROLLMENT_STATUS_LABELS, ENROLLMENT_STATUS_CLASSES } from "@/components/cursos/labels";
import type { EnrollmentStatus, Prisma } from "@prisma/client";

export default async function InscripcionesPage({
  searchParams,
}: {
  searchParams: Promise<{ curso?: string; estado?: string; q?: string }>;
}) {
  const { curso, estado, q } = await searchParams;

  const where: Prisma.EnrollmentWhereInput = {};
  if (curso) where.courseId = curso;
  if (estado) where.status = estado as EnrollmentStatus;
  if (q) {
    where.user = {
      OR: [
        { fullName: { contains: q, mode: "insensitive" } },
        { documentNumber: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    };
  }

  const [courses, students, enrollments] = await Promise.all([
    prisma.course.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true } }),
    prisma.user.findMany({
      where: { role: "STUDENT", status: "ACTIVE" },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, documentNumber: true, email: true },
    }),
    prisma.enrollment.findMany({
      where,
      orderBy: { enrolledAt: "desc" },
      include: { user: { select: { fullName: true, documentNumber: true } }, course: { select: { title: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-foreground">Inscripciones</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Asigna estudiantes a los cursos y controla su acceso.
        </p>
      </div>

      <StaggerSections className="space-y-6">
      <section className="surface-panel surface-accent-top space-y-4 p-6">
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
            Asignar estudiantes a un curso
          </h2>
        </div>
        <AssignEnrollmentForm courses={courses} students={students} />
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-lg font-bold text-foreground">
          {enrollments.length} {enrollments.length === 1 ? "inscripción" : "inscripciones"}
        </h2>

        <form method="get" className="surface-panel flex flex-wrap items-end gap-3 p-4">
          <div className="flex-1 min-w-[200px] space-y-1.5">
            <label htmlFor="q" className="text-xs font-medium text-muted-foreground">
              Buscar estudiante
            </label>
            <input
              id="q"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Nombre, cédula o correo..."
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="curso" className="text-xs font-medium text-muted-foreground">
              Curso
            </label>
            <select
              id="curso"
              name="curso"
              defaultValue={curso ?? ""}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Todos</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="estado" className="text-xs font-medium text-muted-foreground">
              Estado
            </label>
            <select
              id="estado"
              name="estado"
              defaultValue={estado ?? ""}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Todos</option>
              {Object.entries(ENROLLMENT_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" variant="secondary">
            Filtrar
          </Button>
        </form>

        <div className="surface-panel overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Estudiante</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Avance</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enrollments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    No hay inscripciones con esos filtros.
                  </TableCell>
                </TableRow>
              )}
              {enrollments.map((enrollment) => (
                <TableRow key={enrollment.id}>
                  <TableCell>
                    <p className="font-medium text-foreground">{enrollment.user.fullName}</p>
                    <p className="text-xs text-muted-foreground">{enrollment.user.documentNumber}</p>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{enrollment.course.title}</TableCell>
                  <TableCell>
                    <Badge className={ENROLLMENT_STATUS_CLASSES[enrollment.status]}>
                      {ENROLLMENT_STATUS_LABELS[enrollment.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{enrollment.progressPercentage}%</TableCell>
                  <TableCell className="text-right">
                    <CancelEnrollmentButton enrollmentId={enrollment.id} status={enrollment.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
      </StaggerSections>
    </div>
  );
}
