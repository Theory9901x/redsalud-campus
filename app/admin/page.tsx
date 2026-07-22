import Link from "next/link";
import { GraduationCap, UserCog, BookOpen, Award, BadgeCheck, Percent, TrendingUp, Activity } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { MetricCard } from "@/components/admin/metric-card";
import { AdminPageHeader } from "@/components/admin/page-header";
import { StaggerGrid } from "@/components/brand/stagger-grid";
import { EmptyState } from "@/components/brand/empty-state";

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  const units: [number, string][] = [
    [60, "segundo"],
    [60, "minuto"],
    [24, "hora"],
    [30, "día"],
    [12, "mes"],
    [Number.MAX_SAFE_INTEGER, "año"],
  ];
  let value = seconds;
  for (const [limit, label] of units) {
    if (value < limit) {
      const rounded = Math.max(1, Math.floor(value));
      return `hace ${rounded} ${label}${rounded === 1 ? "" : "s"}`;
    }
    value = Math.floor(value / limit);
  }
  return "";
}

export default async function AdminDashboardPage() {
  const [
    totalStudents,
    totalTutors,
    totalCourses,
    totalCertificates,
    certifiedStudents,
    avgScoreAgg,
    topCoursesRaw,
    recentEnrollments,
    recentCertificates,
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
    prisma.enrollment.findMany({
      orderBy: { enrolledAt: "desc" },
      take: 6,
      include: { user: { select: { fullName: true } }, course: { select: { title: true } } },
    }),
    prisma.certificate.findMany({
      orderBy: { issuedAt: "desc" },
      take: 6,
      include: { user: { select: { fullName: true } }, course: { select: { title: true } } },
    }),
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

  const activity = [
    ...recentEnrollments.map((e) => ({
      date: e.enrolledAt,
      text: `${e.user.fullName} se inscribió en ${e.course.title}`,
    })),
    ...recentCertificates.map((c) => ({
      date: c.issuedAt,
      text: `${c.user.fullName} obtuvo un certificado en ${c.course.title}`,
    })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 8);

  const avgScore = avgScoreAgg._avg.finalScore ? Math.round(avgScoreAgg._avg.finalScore) : 0;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Dashboard"
        description="Resumen general del campus virtual de Red Salud Casanare E.S.E."
      />

      <StaggerGrid className="grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Estudiantes" value={totalStudents} icon={GraduationCap} accent="primary" />
        <MetricCard label="Tutores" value={totalTutors} icon={UserCog} accent="success" />
        <MetricCard label="Cursos" value={totalCourses} icon={BookOpen} accent="warning" />
        <MetricCard label="Certificados emitidos" value={totalCertificates} icon={Award} accent="destructive" />
        <MetricCard label="Estudiantes certificados" value={certifiedStudents} icon={BadgeCheck} accent="primary" />
        <MetricCard label="Promedio de aprobación %" value={avgScore} icon={Percent} accent="success" />
      </StaggerGrid>

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
            <Activity className="h-4 w-4 text-primary" />
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">Actividad reciente</h2>
          </div>
          {activity.length === 0 ? (
            <EmptyState icon={Activity} title="Sin actividad todavía" description="Las inscripciones y certificados recientes aparecerán aquí." />
          ) : (
            <ul className="space-y-3">
              {activity.map((item, index) => (
                <li key={index} className="flex items-start justify-between gap-3 border-b border-border pb-2 text-sm last:border-b-0 last:pb-0">
                  <span className="text-foreground">{item.text}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(item.date)}</span>
                </li>
              ))}
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
