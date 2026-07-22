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
import { AdminPageHeader } from "@/components/admin/page-header";
import { TablePagination } from "@/components/admin/table-pagination";
import { AutoSearchInput, AutoFilterSelect } from "@/components/admin/auto-search-input";
import { parsePageSize } from "@/lib/pagination";
import { ENROLLMENT_STATUS_LABELS, ENROLLMENT_STATUS_CLASSES } from "@/components/cursos/labels";
import type { EnrollmentStatus, Prisma } from "@prisma/client";

export default async function InscripcionesPage({
  searchParams,
}: {
  searchParams: Promise<{ curso?: string; estado?: string; q?: string; page?: string; pageSize?: string }>;
}) {
  const { curso, estado, q, page: pageParam, pageSize: pageSizeParam } = await searchParams;
  const pageSize = parsePageSize(pageSizeParam);
  const page = Math.max(1, Number(pageParam) || 1);

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

  const [courses, students, enrollments, totalEnrollments] = await Promise.all([
    prisma.course.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true } }),
    prisma.user.findMany({
      where: { role: "STUDENT", status: "ACTIVE" },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, documentNumber: true, email: true },
    }),
    prisma.enrollment.findMany({
      where,
      orderBy: { enrolledAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: { select: { fullName: true, documentNumber: true } }, course: { select: { title: true } } },
    }),
    prisma.enrollment.count({ where }),
  ]);

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Inscripciones" description="Asigna estudiantes a los cursos y controla su acceso." />

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
          {totalEnrollments} {totalEnrollments === 1 ? "inscripción" : "inscripciones"}
        </h2>

        {/* Filtros que se aplican solos al escribir o elegir: sin botón. */}
        <div className="surface-panel flex flex-wrap items-end gap-3 p-4">
          <AutoSearchInput label="Buscar estudiante" placeholder="Nombre, cédula o correo..." />
          <AutoFilterSelect
            paramName="curso"
            label="Curso"
            options={courses.map((c) => ({ value: c.id, label: c.title }))}
          />
          <AutoFilterSelect
            paramName="estado"
            label="Estado"
            options={Object.entries(ENROLLMENT_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
          />
        </div>

        <div className="surface-glass overflow-hidden">
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
          <TablePagination total={totalEnrollments} page={page} pageSize={pageSize} />
        </div>
      </section>
      </StaggerSections>
    </div>
  );
}
