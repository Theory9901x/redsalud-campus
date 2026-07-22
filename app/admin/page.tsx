import Link from "next/link";
import { GraduationCap, UserCog, BookOpen, Award, BadgeCheck, Percent, TrendingUp, MapPin } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { KpiCard } from "@/components/dashboard/dashboard-kit";
import { AdminPageHeader } from "@/components/admin/page-header";
import { StaggerGrid } from "@/components/brand/stagger-grid";
import { EmptyState } from "@/components/brand/empty-state";

/** Fila del ranking de cobertura por municipio. */
type CoberturaMunicipio = { municipio: string; personas: number; completaron: number };

export default async function AdminDashboardPage() {
  const [
    totalStudents,
    totalTutors,
    totalCourses,
    totalCertificates,
    certifiedStudents,
    avgScoreAgg,
    topCoursesRaw,
    coberturaMunicipios,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.user.count({ where: { role: "TUTOR" } }),
    prisma.course.count(),
    prisma.certificate.count({ where: { status: "VALID" } }),
    // Contar en SQL: antes traía una fila por estudiante certificado solo
    // para medir la longitud del array en JS.
    prisma.user.count({ where: { certificates: { some: { status: "VALID" } } } }),
    prisma.enrollment.aggregate({ _avg: { finalScore: true }, where: { finalScore: { not: null } } }),
    prisma.enrollment.groupBy({
      by: ["courseId"],
      _count: { _all: true },
      orderBy: { _count: { courseId: "desc" } },
      take: 5,
    }),
    // Cobertura de obligatorios por municipio: dice DÓNDE hay que intervenir,
    // que es lo que Talento Humano necesita del panel. Un GROUP BY, no un
    // listado de eventos sueltos.
    prisma.$queryRaw<CoberturaMunicipio[]>`
      SELECT
        COALESCE(m."nombre", 'Sin municipio') AS municipio,
        COUNT(DISTINCT u."id")::int AS personas,
        COUNT(DISTINCT e."userId") FILTER (WHERE e."status" = 'COMPLETED')::int AS completaron
      FROM "User" u
      LEFT JOIN "Municipio" m ON m."id" = u."municipioId"
      LEFT JOIN "Enrollment" e ON e."userId" = u."id"
        AND e."courseId" IN (SELECT "id" FROM "Course" WHERE "courseType" = 'OBLIGATORIO')
      WHERE u."role" = 'STUDENT' AND u."status" = 'ACTIVE'
      GROUP BY municipio
      HAVING COUNT(DISTINCT u."id") > 0
      ORDER BY (COUNT(DISTINCT e."userId") FILTER (WHERE e."status" = 'COMPLETED')::float / NULLIF(COUNT(DISTINCT u."id"),0)) ASC
      LIMIT 8
    `,
  ]);

  const topCourseIds = topCoursesRaw.map((c) => c.courseId);
  const topCourseDetails = await prisma.course.findMany({
    where: { id: { in: topCourseIds } },
    select: { id: true, title: true },
  });
  const topCourses = topCoursesRaw.map((c) => ({
    title: topCourseDetails.find((d) => d.id === c.courseId)?.title ?? "Curso eliminado",
    count: c._count._all,
  }));

  const avgScore = avgScoreAgg._avg.finalScore ? Math.round(avgScoreAgg._avg.finalScore) : 0;

  return (
    <div className="accent-admin space-y-6">
      <AdminPageHeader
        title="Dashboard"
        description="Resumen general del campus virtual de Red Salud Casanare E.S.E."
      />

      {/* Mismos KpiCard que estudiante y tutor; cambia el acento del rol. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6 2xl:grid-cols-6">
        <KpiCard label="Estudiantes" value={totalStudents} icon={GraduationCap} href="/admin/usuarios" />
        <KpiCard label="Tutores" value={totalTutors} icon={UserCog} href="/admin/usuarios" />
        <KpiCard label="Cursos" value={totalCourses} icon={BookOpen} href="/admin/cursos" />
        <KpiCard label="Certificados emitidos" value={totalCertificates} icon={Award} href="/admin/certificados" />
        <KpiCard label="Estudiantes certificados" value={certifiedStudents} icon={BadgeCheck} />
        <KpiCard label="Promedio de aprobación" value={`${avgScore}%`} icon={Percent} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="surface space-y-4 p-6">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">Cursos con más inscritos</h2>
          </div>
          {topCourses.length === 0 ? (
            <EmptyState icon={BookOpen} title="Sin inscripciones todavía" description="Aparecerán aquí cuando haya estudiantes inscritos." />
          ) : (
            <ol className="space-y-2">
              {topCourses.map((course, index) => (
                <li key={course.title} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <span className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {index + 1}
                    </span>
                    <span className="text-foreground">{course.title}</span>
                  </span>
                  <span className="text-muted-foreground">
                    {course.count} {course.count === 1 ? "inscrito" : "inscritos"}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="surface space-y-4 p-6">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
              Cobertura de obligatorios por municipio
            </h2>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            Ordenado de menor a mayor cumplimiento: dónde hace falta intervenir.
          </p>
          {coberturaMunicipios.length === 0 ? (
            <EmptyState
              icon={MapPin}
              title="Sin datos de cobertura"
              description="Aparecerá cuando haya personal con municipio y cursos obligatorios asignados."
            />
          ) : (
            <ul className="space-y-3">
              {coberturaMunicipios.map((fila) => {
                const pct = fila.personas > 0 ? Math.round((fila.completaron / fila.personas) * 100) : 0;
                return (
                  <li key={fila.municipio} className="space-y-1">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate text-foreground">{fila.municipio}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {fila.completaron}/{fila.personas} · {pct}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          pct >= 80 ? "bg-success" : pct >= 40 ? "bg-warning" : "bg-destructive"
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <Link href="/admin/reportes" className="inline-flex text-sm font-medium text-primary hover:underline">
        Ver reportes completos →
      </Link>
    </div>
  );
}
