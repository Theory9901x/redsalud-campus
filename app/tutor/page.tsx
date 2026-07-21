import Link from "next/link";
import { BookOpen, CalendarRange, Plus, Users } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Dashboard del tutor (6.1: estructura y accesos; los KPIs con datos reales,
 * gráfica y actividad llegan en la sub-fase 6.2).
 */
export default async function TutorDashboardPage() {
  const session = await auth();
  const tutorId = session!.user.id;

  const [courseCount, enrolledCount] = await Promise.all([
    prisma.course.count({ where: { tutorId } }),
    prisma.enrollment.count({ where: { course: { tutorId }, status: { not: "CANCELLED" } } }),
  ]);

  const firstName = session!.user.name?.split(" ")[0] ?? "Tutor";

  const quickActions = [
    { href: "/tutor/cursos/nuevo", label: "Nuevo curso", icon: Plus },
    { href: "/tutor/cursos", label: "Mis cursos", icon: BookOpen },
    { href: "/tutor/inscritos", label: "Inscritos", icon: Users },
    { href: "/tutor/planes-capacitacion", label: "Planes de capacitación", icon: CalendarRange },
  ];

  return (
    <div className="space-y-6">
      {/* Hero compacto del espacio de trabajo: acento verde del rol. */}
      <section className="noise-overlay relative isolate overflow-hidden rounded-3xl bg-navy px-6 py-8 text-white sm:px-8">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 10% -20%, color-mix(in oklch, var(--success) 30%, transparent), transparent 55%), radial-gradient(circle at 100% 120%, color-mix(in oklch, var(--primary) 20%, transparent), transparent 50%)",
          }}
        />
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-success/25 blur-[90px]" />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-success backdrop-blur">
            Espacio de trabajo · Tutor
          </span>
          <h1 className="mt-3 font-display text-2xl font-extrabold text-balance sm:text-3xl">
            Hola, {firstName}.
          </h1>
          <p className="mt-2 max-w-lg text-sm text-white/70">
            Gestiona tus cursos, el avance de tus inscritos y tus planes de capacitación desde aquí.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="chip-glass">
              <BookOpen className="h-3.5 w-3.5 text-success" />
              {courseCount} {courseCount === 1 ? "curso" : "cursos"}
            </span>
            <span className="chip-glass">
              <Users className="h-3.5 w-3.5 text-success" />
              {enrolledCount} {enrolledCount === 1 ? "inscrito" : "inscritos"}
            </span>
          </div>
        </div>
      </section>

      {/* Accesos rápidos en botonera clay. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {quickActions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="surface-clay flex flex-col items-center gap-2.5 px-4 py-5 text-center text-sm font-semibold text-foreground transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-success"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/12 text-success">
              <action.icon className="h-5 w-5" />
            </span>
            {action.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
