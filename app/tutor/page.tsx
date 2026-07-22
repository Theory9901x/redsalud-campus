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
import { StaggerSections } from "@/components/brand/stagger-sections";
import { EmptyState } from "@/components/brand/empty-state";
import { EnrollmentChart, type ChartPoint } from "@/components/tutor/enrollment-chart";

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
      color: "text-primary bg-primary/10",
      text: `${e.user.fullName} se inscribió en ${e.course.title}`,
    })),
    ...recentCompletions.slice(0, 6).map((e) => ({
      at: e.completedAt!,
      icon: CheckCircle2,
      color: "text-success bg-success/10",
      text: `${e.user.fullName} completó ${e.course.title}`,
    })),
    ...recentCertificates.map((c) => ({
      at: c.issuedAt,
      icon: Award,
      color: "text-warning-foreground bg-warning/15",
      text: `${c.user.fullName} obtuvo certificado de ${c.course.title}`,
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 8);

  const firstName = session!.user.name?.split(" ")[0] ?? "Tutor";

  const kpis = [
    { label: "Cursos activos", value: publishedCount, icon: BookOpen, color: "bg-success/12 text-success" },
    { label: "Borradores", value: draftCount, icon: FileWarning, color: "bg-warning/15 text-warning-foreground" },
    { label: "Inscritos", value: enrolledCount, icon: Users, color: "bg-primary/10 text-primary" },
    { label: "Finalización", value: `${completionRate}%`, icon: Percent, color: "bg-success/12 text-success" },
    { label: "Certificados este mes", value: certificatesThisMonth, icon: Award, color: "bg-primary/10 text-primary" },
  ];

  const quickActions = [
    { href: "/tutor/cursos/nuevo", label: "Nuevo curso", icon: Plus },
    { href: "/tutor/cursos", label: "Mis cursos", icon: BookOpen },
    { href: "/tutor/inscritos", label: "Inscritos", icon: Users },
    { href: "/tutor/planes-capacitacion", label: "Planes", icon: CalendarRange },
  ];

  return (
    <StaggerSections className="space-y-6">
      {/* Hero compacto del espacio de trabajo. */}
      <section className="noise-overlay relative isolate overflow-hidden rounded-3xl bg-navy px-6 py-7 text-white sm:px-8">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 10% -20%, color-mix(in oklch, var(--success) 30%, transparent), transparent 55%), radial-gradient(circle at 100% 120%, color-mix(in oklch, var(--primary) 20%, transparent), transparent 50%)",
          }}
        />
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-success/25 blur-[90px]" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-success backdrop-blur">
              Espacio de trabajo · Tutor
            </span>
            <h1 className="mt-3 font-display text-2xl font-extrabold text-balance sm:text-3xl">Hola, {firstName}.</h1>
            <p className="mt-1.5 max-w-lg text-sm text-white/70">
              Así va la formación de tus cursos hoy.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="chip-glass px-3 py-2 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-success"
              >
                <action.icon className="h-3.5 w-3.5 text-success" />
                {action.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* KPIs en tarjetas clay con ícono en contenedor de color. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="surface-clay flex items-center gap-3 px-4 py-4">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${kpi.color}`}>
              <kpi.icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="font-display text-xl font-extrabold leading-none text-foreground">{kpi.value}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* items-start: cada panel toma su altura natural; si no, el de la
          gráfica se estira al alto de la actividad y queda medio vacío. */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        {/* Gráfica de avance en panel glass. */}
        <section className="surface-glass p-5 xl:col-span-2">
          <h2 className="font-display text-base font-extrabold text-foreground">Avance de formación</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Inscripciones y finalizaciones en tus cursos.</p>
          <div className="mt-4">
            <EnrollmentChart points={chartPoints} />
          </div>
        </section>

        {/* Actividad reciente: timeline vertical con línea de acento. */}
        <section className="surface-glass p-5">
          <h2 className="font-display text-base font-extrabold text-foreground">Actividad reciente</h2>
          {activity.length === 0 ? (
            <EmptyState
              icon={ActivityIcon}
              title="Sin actividad todavía"
              description="Cuando haya inscripciones o avances en tus cursos, aparecerán aquí."
              className="mt-4 py-10"
            />
          ) : (
            <div className="relative mt-4 max-h-[420px] overflow-y-auto pr-1">
              <span aria-hidden="true" className="absolute bottom-2 left-[15px] top-2 w-[2.5px] rounded-full bg-success/25" />
              <ul className="space-y-4">
                {activity.map((item, index) => (
                  <li key={index} className="relative flex items-start gap-3">
                    <span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${item.color}`}>
                      <item.icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 pt-1">
                      <p className="text-sm leading-snug text-foreground/85">{item.text}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {item.at.toLocaleDateString("es-CO", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      {/* Cursos con atención requerida. */}
      <section className="surface-glass p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warning/15 text-warning-foreground">
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-display text-base font-extrabold text-foreground">Atención requerida</h2>
            <p className="text-xs text-muted-foreground">Cursos sin contenido o con inscritos estancados.</p>
          </div>
        </div>
        {attention.length === 0 ? (
          <p className="mt-4 flex items-center gap-2 rounded-xl bg-success/10 px-4 py-3 text-sm text-success">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Todo en orden: tus cursos tienen contenido y tus inscritos avanzan.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {attention.map((item, index) => (
              <li key={`${item.courseId}-${index}`} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.problem}</p>
                </div>
                <Link
                  href={item.href}
                  className="surface-clay shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold text-success transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-success"
                >
                  {item.cta}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </StaggerSections>
  );
}
