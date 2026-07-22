import { Download } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ENROLLMENT_STATUS_LABELS } from "@/components/cursos/labels";
import { CERTIFICATE_STATUS_LABELS } from "@/components/certificados/labels";
import { StaggerSections } from "@/components/brand/stagger-sections";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AutoFilterSelect } from "@/components/admin/auto-search-input";

const PREVIEW_LIMIT = 15;

/** Fila del agregado por dependencia (ver la consulta SQL de abajo). */
type DeptRow = {
  dept: string;
  total: number;
  students: number;
  completed: number;
  active: number;
  failed: number;
  progressSum: number;
};

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{
    curso?: string;
    quizCurso?: string;
    certDesde?: string;
    certHasta?: string;
    certEstado?: string;
  }>;
}) {
  const { curso, quizCurso, certDesde, certHasta, certEstado } = await searchParams;

  const courses = await prisma.course.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true } });

  const [enrollments, deptEnrollments, attempts, certificates] = await Promise.all([
    prisma.enrollment.findMany({
      where: curso ? { courseId: curso } : {},
      orderBy: [{ course: { title: "asc" } }, { user: { fullName: "asc" } }],
      include: { user: { select: { fullName: true, department: true } }, course: { select: { title: true } } },
      take: PREVIEW_LIMIT,
    }),
    // Agregado por dependencia en SQL. Antes se traía TODA la tabla de
    // inscripciones a memoria para agrupar en JS, algo que crece sin techo
    // con la plataforma. Va en $queryRaw porque groupBy de Prisma no puede
    // agrupar por un campo del modelo relacionado (User.department).
    prisma.$queryRaw<DeptRow[]>`
      SELECT
        COALESCE(NULLIF(TRIM(u."department"), ''), 'Sin dependencia') AS dept,
        COUNT(*)::int AS total,
        COUNT(DISTINCT e."userId")::int AS students,
        COUNT(*) FILTER (WHERE e."status" = 'COMPLETED')::int AS completed,
        COUNT(*) FILTER (WHERE e."status" = 'ACTIVE')::int AS active,
        COUNT(*) FILTER (WHERE e."status" = 'FAILED')::int AS failed,
        COALESCE(SUM(e."progressPercentage"), 0)::int AS "progressSum"
      FROM "Enrollment" e
      JOIN "User" u ON u."id" = e."userId"
      WHERE e."status" <> 'CANCELLED'
      GROUP BY dept
      ORDER BY dept
    `,
    prisma.quizAttempt.findMany({
      where: { finishedAt: { not: null }, ...(quizCurso ? { quiz: { courseId: quizCurso } } : {}) },
      orderBy: { finishedAt: "desc" },
      include: { user: { select: { fullName: true } }, quiz: { select: { title: true, passingScore: true, course: { select: { title: true } } } } },
      take: PREVIEW_LIMIT,
    }),
    prisma.certificate.findMany({
      where: {
        ...(certEstado ? { status: certEstado as "VALID" | "REVOKED" } : {}),
        ...(certDesde || certHasta
          ? {
              issuedAt: {
                ...(certDesde ? { gte: new Date(`${certDesde}T00:00:00`) } : {}),
                ...(certHasta ? { lte: new Date(`${certHasta}T23:59:59`) } : {}),
              },
            }
          : {}),
      },
      orderBy: { issuedAt: "desc" },
      include: { user: { select: { fullName: true, department: true } }, course: { select: { title: true } } },
      take: PREVIEW_LIMIT,
    }),
  ]);

  // El agregado ya viene resuelto por SQL; aquí solo se adapta a la forma
  // [nombre, stats] que consume la tabla.
  const deptRows: [string, Omit<DeptRow, "dept">][] = deptEnrollments.map((row) => [
    row.dept,
    {
      total: row.total,
      students: row.students,
      completed: row.completed,
      active: row.active,
      failed: row.failed,
      progressSum: row.progressSum,
    },
  ]);

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Reportes"
        description={`Vista previa de los primeros ${PREVIEW_LIMIT} registros. Exporta cada reporte a CSV para verlo completo.`}
      />

      <StaggerSections className="space-y-8">
      {/* Estudiantes por curso */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-foreground">Estudiantes por curso</h2>
          <div className="flex flex-wrap items-end gap-2">
            {/* Filtro automático: aplica al elegir, sin botón. */}
            <AutoFilterSelect
              paramName="curso"
              label=""
              allLabel="Todos los cursos"
              options={courses.map((c) => ({ value: c.id, label: c.title }))}
            />
            <a
              href={`/api/reportes/estudiantes-por-curso${curso ? `?curso=${curso}` : ""}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <Download className="h-4 w-4" />
              Exportar CSV
            </a>
          </div>
        </div>
        <div className="surface-glass overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Curso</TableHead>
                <TableHead>Estudiante</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-center">Avance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enrollments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Sin datos.
                  </TableCell>
                </TableRow>
              )}
              {enrollments.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-muted-foreground">{e.course.title}</TableCell>
                  <TableCell className="font-medium text-foreground">{e.user.fullName}</TableCell>
                  <TableCell className="text-muted-foreground">{e.user.department ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{ENROLLMENT_STATUS_LABELS[e.status]}</TableCell>
                  <TableCell className="text-center text-muted-foreground">{e.progressPercentage}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Avance por dependencia */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-foreground">Avance por dependencia</h2>
          <a
            href="/api/reportes/avance-por-dependencia"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </a>
        </div>
        <div className="surface-glass overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dependencia</TableHead>
                <TableHead className="text-center">Estudiantes</TableHead>
                <TableHead className="text-center">Completadas</TableHead>
                <TableHead className="text-center">En progreso</TableHead>
                <TableHead className="text-center">Reprobadas</TableHead>
                <TableHead className="text-center">Avance promedio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deptRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Sin datos.
                  </TableCell>
                </TableRow>
              )}
              {deptRows.map(([dept, stats]) => (
                <TableRow key={dept}>
                  <TableCell className="font-medium text-foreground">{dept}</TableCell>
                  <TableCell className="text-center text-muted-foreground">{stats.students}</TableCell>
                  <TableCell className="text-center text-muted-foreground">{stats.completed}</TableCell>
                  <TableCell className="text-center text-muted-foreground">{stats.active}</TableCell>
                  <TableCell className="text-center text-muted-foreground">{stats.failed}</TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    {stats.total > 0 ? Math.round(stats.progressSum / stats.total) : 0}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Resultados de cuestionarios */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-foreground">Resultados de cuestionarios</h2>
          <div className="flex flex-wrap items-end gap-2">
            <AutoFilterSelect
              paramName="quizCurso"
              label=""
              allLabel="Todos los cursos"
              options={courses.map((c) => ({ value: c.id, label: c.title }))}
            />
            <a
              href={`/api/reportes/resultados-cuestionarios${quizCurso ? `?curso=${quizCurso}` : ""}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <Download className="h-4 w-4" />
              Exportar CSV
            </a>
          </div>
        </div>
        <div className="surface-glass overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cuestionario</TableHead>
                <TableHead>Estudiante</TableHead>
                <TableHead className="text-center">Intento</TableHead>
                <TableHead className="text-center">Puntaje</TableHead>
                <TableHead>Resultado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attempts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Sin datos.
                  </TableCell>
                </TableRow>
              )}
              {attempts.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="text-muted-foreground">
                    {a.quiz.course.title} · {a.quiz.title}
                  </TableCell>
                  <TableCell className="font-medium text-foreground">{a.user.fullName}</TableCell>
                  <TableCell className="text-center text-muted-foreground">{a.attemptNumber}</TableCell>
                  <TableCell className="text-center text-muted-foreground">{a.score ?? "—"}%</TableCell>
                  <TableCell className={a.passed ? "text-success" : "text-destructive"}>
                    {a.passed ? "Aprobado" : "Reprobado"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Certificados */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-foreground">Certificados emitidos/anulados</h2>
          <div className="flex flex-wrap items-end gap-2">
            <form method="get" className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Desde</label>
                <input
                  type="date"
                  name="certDesde"
                  defaultValue={certDesde ?? ""}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Hasta</label>
                <input
                  type="date"
                  name="certHasta"
                  defaultValue={certHasta ?? ""}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <select
                name="certEstado"
                defaultValue={certEstado ?? ""}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Todos los estados</option>
                {Object.entries(CERTIFICATE_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <Button type="submit" variant="secondary" size="sm">
                Filtrar
              </Button>
            </form>
            <a
              href={`/api/reportes/certificados?${new URLSearchParams({
                ...(certDesde ? { desde: certDesde } : {}),
                ...(certHasta ? { hasta: certHasta } : {}),
                ...(certEstado ? { estado: certEstado } : {}),
              }).toString()}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <Download className="h-4 w-4" />
              Exportar CSV
            </a>
          </div>
        </div>
        <div className="surface-glass overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Estudiante</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead>Emitido</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {certificates.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Sin datos.
                  </TableCell>
                </TableRow>
              )}
              {certificates.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs text-foreground">{c.certificateCode}</TableCell>
                  <TableCell className="font-medium text-foreground">{c.user.fullName}</TableCell>
                  <TableCell className="text-muted-foreground">{c.course.title}</TableCell>
                  <TableCell className="text-muted-foreground">{c.issuedAt.toLocaleDateString("es-CO")}</TableCell>
                  <TableCell className={c.status === "VALID" ? "text-success" : "text-destructive"}>
                    {CERTIFICATE_STATUS_LABELS[c.status]}
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
