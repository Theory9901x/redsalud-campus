import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  GraduationCap,
  PlayCircle,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { StaggerSections } from "@/components/brand/stagger-sections";
import { AvatarProgressRing } from "@/components/student/avatar-progress-ring";
import { EcgPulse } from "@/components/brand/ecg-pulse";
import { getUserAvatarUrl } from "@/lib/avatar";
import { cn } from "@/lib/utils";

/**
 * Dashboard del estudiante: intro + recuento de datos de TODA su gestión. No
 * lleva listas de cursos ni catálogo —eso vive en Mi aula y en el Catálogo,
 * cada uno en su módulo—; aquí solo el panorama en números.
 */
export default async function InicioPage() {
  const session = await auth();
  const userId = session!.user.id;
  const personnelType = session!.user.personnelType;
  const firstName = session!.user.name?.split(" ")[0];

  const [enrollments, certificateCount, obligatoriosDisponibles, avatarUrl] = await Promise.all([
    prisma.enrollment.findMany({
      where: { userId, status: { not: "CANCELLED" } },
      orderBy: { enrolledAt: "desc" },
      include: { course: { select: { title: true, courseType: true, durationHours: true } } },
    }),
    prisma.certificate.count({ where: { userId, status: "VALID" } }),
    // Obligatorios publicados que le tocan y en los que aún no está inscrito.
    prisma.course.count({
      where: {
        status: "PUBLISHED",
        courseType: "OBLIGATORIO",
        targetAudience: { in: [personnelType, "AMBOS"] },
        enrollments: { none: { userId, status: { not: "CANCELLED" } } },
      },
    }),
    getUserAvatarUrl(userId),
  ]);

  const activos = enrollments.filter((e) => e.status !== "COMPLETED").length;
  const completados = enrollments.filter((e) => e.status === "COMPLETED").length;
  const enCurso = enrollments.filter(
    (e) => e.status !== "COMPLETED" && e.progressPercentage > 0 && e.progressPercentage < 100
  ).length;
  const sinIniciar = enrollments.filter((e) => e.status !== "COMPLETED" && e.progressPercentage === 0).length;
  const obligatoriosPendientes =
    enrollments.filter((e) => e.course.courseType === "OBLIGATORIO" && e.status !== "COMPLETED").length +
    obligatoriosDisponibles;

  const horasInscritas = enrollments.reduce((s, e) => s + e.course.durationHours, 0);
  const avanceGlobal =
    enrollments.length > 0
      ? Math.round(enrollments.reduce((s, e) => s + e.progressPercentage, 0) / enrollments.length)
      : 0;

  const proximoObligatorio = enrollments
    .filter((e) => e.course.courseType === "OBLIGATORIO" && e.status !== "COMPLETED")
    .at(-1)?.course.title;

  const KPIS = [
    { icon: BookOpen, value: activos, label: "Cursos activos", box: "bg-primary/15 text-primary" },
    { icon: CheckCircle2, value: completados, label: "Completados", box: "bg-success/15 text-success" },
    { icon: Award, value: certificateCount, label: "Certificados", box: "bg-warning/15 text-warning-foreground" },
    {
      icon: ShieldAlert,
      value: obligatoriosPendientes,
      label: "Obligatorios pendientes",
      box: "bg-destructive/15 text-destructive",
    },
  ];

  const DESGLOSE = [
    { label: "En curso", value: enCurso, icon: PlayCircle },
    { label: "Sin iniciar", value: sinIniciar, icon: Clock },
    { label: "Completados", value: completados, icon: CheckCircle2 },
    { label: "Horas de formación", value: `${horasInscritas} h`, icon: TrendingUp },
  ];

  return (
    <main className="accent-student mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <StaggerSections className="space-y-6">
        {/* Intro (la que antes vivía en el catálogo). */}
        <section className="hud-hero hud-grid noise-overlay relative overflow-hidden px-6 py-10 sm:px-10 sm:py-12">
          <div className="pointer-events-none absolute -left-16 top-1/4 h-64 w-64 rounded-full bg-[var(--accent)]/25 blur-[90px]" />
          <EcgPulse className="absolute inset-x-0 bottom-3 h-10 w-full text-[var(--accent)]/25" />
          <div className="relative grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-8">
              <span className="chip-glass">
                <Activity className="h-3.5 w-3.5 text-[var(--accent)]" />
                Plataforma oficial · Red Salud Casanare E.S.E.
              </span>
              <h1 className="mt-4 max-w-2xl font-display text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">
                Hola, {firstName}. Todo tu proceso de{" "}
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: "linear-gradient(90deg, var(--accent), var(--success))" }}
                >
                  formación institucional
                </span>{" "}
                en un solo lugar.
              </h1>
              <p className="mt-3 max-w-lg text-sm text-white/70">
                Inducción, reinducción y capacitación del talento humano de Red Salud Casanare E.S.E.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/mi-aula" className="btn-hud">
                  Ir a mi aula <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/cursos" className="btn-hud-ghost">
                  Explorar catálogo <Sparkles className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Anillo de avance global. */}
            <div className="flex items-center gap-5 lg:col-span-4 lg:justify-end">
              <AvatarProgressRing name={session!.user.name ?? ""} avatarUrl={avatarUrl} progress={avanceGlobal} size={84} />
              <div className="border-l border-white/15 pl-5">
                <p className="font-display text-3xl font-extrabold leading-none text-white">{avanceGlobal}%</p>
                <p className="mt-1 text-xs text-white/60">Avance global</p>
                <p className="mt-3 font-display text-lg font-bold leading-none text-white">{enrollments.length}</p>
                <p className="mt-1 text-xs text-white/60">Cursos en total</p>
              </div>
            </div>
          </div>
        </section>

        {/* Recuento: cuatro indicadores principales. */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {KPIS.map((k) => (
            <div key={k.label} className="surface flex items-center gap-3 p-4">
              <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", k.box)}>
                <k.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 leading-tight">
                <p className="font-display text-2xl font-extrabold text-foreground">{k.value}</p>
                <p className="truncate text-[12px] text-muted-foreground">{k.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Recuento: panel de resumen con el desglose y el avance. */}
        <section className="surface-panel p-6 sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[var(--accent)]/[0.08] blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent)]">
                <TrendingUp className="h-[18px] w-[18px]" />
              </span>
              <div>
                <h2 className="font-display text-lg font-extrabold text-foreground">Resumen de tu formación</h2>
                <p className="text-sm text-muted-foreground">Todo tu avance, en números.</p>
              </div>
            </div>

            {/* Barra de avance global. */}
            <div className="mt-6">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">Avance global</span>
                <span className="text-muted-foreground">{avanceGlobal}%</span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-foreground/10">
                <div className="progress-fill-animated h-full rounded-full" style={{ width: `${avanceGlobal}%` }} />
              </div>
            </div>

            {/* Desglose. */}
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {DESGLOSE.map((d) => (
                <div key={d.label} className="surface-clay p-4">
                  <d.icon className="h-4 w-4 text-[var(--accent)]" />
                  <p className="mt-2 font-display text-xl font-extrabold text-foreground">{d.value}</p>
                  <p className="text-[12px] text-muted-foreground">{d.label}</p>
                </div>
              ))}
            </div>

            {proximoObligatorio && (
              <Link
                href="/mi-aula?tab=obligatorios"
                className="mt-6 flex items-center gap-3 rounded-xl border border-destructive/25 bg-destructive/5 p-4 transition-colors hover:bg-destructive/10"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
                  <ShieldAlert className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-destructive">Obligatorio pendiente</p>
                  <p className="truncate text-sm font-medium text-foreground">{proximoObligatorio}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            )}
          </div>
        </section>
      </StaggerSections>
    </main>
  );
}
