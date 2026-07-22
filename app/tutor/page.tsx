import Link from "next/link";
import {
  Activity as ActivityIcon,
  AlertTriangle,
  Award,
  BookOpen,
  CalendarRange,
  CheckCircle2,
  FileWarning,
  Percent,
  Plus,
  UserPlus,
  Users,
} from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/brand/empty-state";
import { ChartPanel } from "@/components/dashboard/chart-panel";
import type { ChartPoint } from "@/components/dashboard/trend-chart";
import {
  ActivityTimeline,
  AttentionList,
  DashboardHero,
  DashboardPanel,
  DashboardShell,
  KpiCard,
  QuickAction,
} from "@/components/dashboard/dashboard-kit";

const DAY_MS = 24 * 60 * 60 * 1000;

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** Dashboard del tutor (6.2): todo con datos reales de sus cursos. */
export default async function TutorDashboardPage() {
  const session = await auth();
  const tutorId = session!.user.id;
  const now = new Date();
  const start90 = new Date(now.getTime() - 89 * DAY_MS);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const staleCutoff = new Date(now.getTime() - 7 * DAY_MS);

  const [
    publishedCount,
    draftCount,
    enrolledCount,
    completedCount,
    certificatesThisMonth,
    recentEnrollments,
    recentCompletions,
    recentCertificates,
    coursesForAttention,
    stalledEnrollments,
  ] = await Promise.all([
    prisma.course.count({ where: { tutorId, status: "PUBLISHED" } }),
    prisma.course.count({ where: { tutorId, status: "DRAFT" } }),
    prisma.enrollment.count({ where: { course: { tutorId }, status: { not: "CANCELLED" } } }),
    prisma.enrollment.count({ where: { course: { tutorId }, status: "COMPLETED" } }),
    prisma.certificate.count({ where: { course: { tutorId }, issuedAt: { gte: monthStart } } }),
    prisma.enrollment.findMany({
      where: { course: { tutorId }, enrolledAt: { gte: start90 } },
      select: { enrolledAt: true, user: { select: { fullName: true } }, course: { select: { title: true } } },
      orderBy: { enrolledAt: "desc" },
    }),
    prisma.enrollment.findMany({
      where: { course: { tutorId }, completedAt: { gte: start90, not: null } },
      select: { completedAt: true, user: { select: { fullName: true } }, course: { select: { title: true } } },
      orderBy: { completedAt: "desc" },
    }),
    prisma.certificate.findMany({
      where: { course: { tutorId }, issuedAt: { gte: start90 } },
      select: { issuedAt: true, user: { select: { fullName: true } }, course: { select: { title: true } } },
      orderBy: { issuedAt: "desc" },
      take: 6,
    }),
    prisma.course.findMany({
      where: { tutorId },
      select: {
        id: true,
        title: true,
        status: true,
        modules: { select: { _count: { select: { lessons: true } } } },
      },
    }),
    prisma.enrollment.findMany({
      where: {
        course: { tutorId },
        status: "ACTIVE",
        progressPercentage: 0,
        enrolledAt: { lte: staleCutoff },
      },
      select: { courseId: true, course: { select: { title: true } } },
    }),
  ]);

  const completionRate = enrolledCount > 0 ? Math.round((completedCount / enrolledCount) * 100) : 0;

  // Serie diaria completa de 90 días (incluye días en cero) para la gráfica.
  const byDay = new Map<string, { inscripciones: number; finalizaciones: number }>();
  for (let i = 0; i < 90; i++) {
    byDay.set(isoDay(new Date(start90.getTime() + i * DAY_MS)), { inscripciones: 0, finalizaciones: 0 });
  }
  for (const e of recentEnrollments) {
    const key = isoDay(e.enrolledAt);
    const bucket = byDay.get(key);
    if (bucket) bucket.inscripciones++;
  }
  for (const e of recentCompletions) {
    const key = isoDay(e.completedAt!);
    const bucket = byDay.get(key);
    if (bucket) bucket.finalizaciones++;
  }
  const chartPoints: ChartPoint[] = [...byDay.entries()].map(([date, v]) => ({ date, ...v }));

  // Cursos con atención requerida: sin lecciones, o con inscritos estancados.
  const stalledByCourse = new Map<string, { title: string; count: number }>();
  for (const s of stalledEnrollments) {
    const entry = stalledByCourse.get(s.courseId) ?? { title: s.course.title, count: 0 };
    entry.count++;
    stalledByCourse.set(s.courseId, entry);
  }
  const attention: { courseId: string; title: string; problem: string; cta: string; href: string }[] = [];
  for (const c of coursesForAttention) {
    const lessonCount = c.modules.reduce((sum, m) => sum + m._count.lessons, 0);
    if (lessonCount === 0) {
      attention.push({
        courseId: c.id,
        title: c.title,
        problem: c.modules.length === 0 ? "Sin módulos ni lecciones" : "Módulos sin lecciones",
        cta: "Completar contenido",
        href: `/tutor/cursos/${c.id}`,
      });
    }
  }
  for (const [courseId, s] of stalledByCourse) {
    attention.push({
      courseId,
      title: s.title,
      problem: `${s.count} ${s.count === 1 ? "inscrito estancado" : "inscritos estancados"} (0% hace más de 7 días)`,
      cta: "Ver inscritos",
      href: "/tutor/inscritos",
    });
  }

  // Actividad reciente: inscripciones + finalizaciones + certificados, mezclados por fecha.
  const activity = [
    ...recentEnrollments.slice(0, 6).map((e) => ({
      at: e.enrolledAt,
      icon: UserPlus,
      tone: "text-primary bg-primary/10",
      text: `${e.user.fullName} se inscribió en ${e.course.title}`,
    })),
    ...recentCompletions.slice(0, 6).map((e) => ({
      at: e.completedAt!,
      icon: CheckCircle2,
      tone: "text-success bg-success/10",
      text: `${e.user.fullName} completó ${e.course.title}`,
    })),
    ...recentCertificates.map((c) => ({
      at: c.issuedAt,
      icon: Award,
      tone: "text-warning-foreground bg-warning/15",
      text: `${c.user.fullName} obtuvo certificado de ${c.course.title}`,
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 8);

  const firstName = session!.user.name?.split(" ")[0] ?? "Tutor";

  const kpis: { label: string; value: string | number; icon: typeof BookOpen; href?: string }[] = [
    { label: "Cursos activos", value: publishedCount, icon: BookOpen, href: "/tutor/cursos" },
    { label: "Borradores", value: draftCount, icon: FileWarning, href: "/tutor/cursos" },
    { label: "Inscritos", value: enrolledCount, icon: Users, href: "/tutor/inscritos" },
    { label: "Finalización", value: `${completionRate}%`, icon: Percent },
    { label: "Certificados este mes", value: certificatesThisMonth, icon: Award, href: "/tutor/certificados" },
  ];

  const quickActions = [
    { href: "/tutor/cursos/nuevo", label: "Nuevo curso", icon: Plus },
    { href: "/tutor/cursos", label: "Mis cursos", icon: BookOpen },
    { href: "/tutor/inscritos", label: "Inscritos", icon: Users },
    { href: "/tutor/planes-capacitacion", label: "Planes", icon: CalendarRange },
  ];

  return (
    <DashboardShell role="tutor">
      <DashboardHero
        eyebrow="Espacio de trabajo · Tutor"
        title={`Hola, ${firstName}.`}
        subtitle="Así va la formación de tus cursos hoy."
        actions={quickActions.map((a) => (
          <QuickAction key={a.href} href={a.href} label={a.label} icon={a.icon} />
        ))}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} icon={kpi.icon} href={kpi.href} />
        ))}
      </div>

      {/* items-start: cada panel toma su altura natural en vez de estirarse
          al alto del vecino más largo. */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        <DashboardPanel
          title="Avance de formación"
          description="Inscripciones y finalizaciones en tus cursos."
          className="xl:col-span-2"
        >
          <ChartPanel points={chartPoints} seriesLabels={["Inscripciones", "Finalizaciones"]} />
        </DashboardPanel>

        <DashboardPanel title="Actividad reciente">
          {activity.length === 0 ? (
            <EmptyState
              icon={ActivityIcon}
              title="Sin actividad todavía"
              description="Cuando haya inscripciones o avances en tus cursos, aparecerán aquí."
              className="py-10"
            />
          ) : (
            <ActivityTimeline items={activity} />
          )}
        </DashboardPanel>
      </div>

      <DashboardPanel
        title="Atención requerida"
        description="Cursos sin contenido o con inscritos estancados."
      >
        <AttentionList
          items={attention}
          allClearText="Todo en orden: tus cursos tienen contenido y tus inscritos avanzan."
        />
      </DashboardPanel>
    </DashboardShell>
  );
}
