import Link from "next/link";
import { ComitesEnPanel } from "@/components/comites/comites-en-panel";
import {
  Activity,
  ArrowRight,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { requireSession } from "@/lib/auth-helpers";
import { getAgendaEstudiante } from "@/lib/agenda-estudiante";
import { FilaDeAgenda, SeccionAgenda } from "@/components/agenda/fila-agenda";
import { prisma } from "@/lib/prisma";
import { StaggerSections } from "@/components/brand/stagger-sections";
import { AvatarProgressRing } from "@/components/student/avatar-progress-ring";
import { EcgPulse } from "@/components/brand/ecg-pulse";
import { getUserAvatarUrl } from "@/lib/avatar";

/**
 * Dashboard del estudiante: intro + recuento de datos de TODA su gestión. No
 * lleva listas de cursos ni catálogo —eso vive en Mi aula y en el Catálogo,
 * cada uno en su módulo—; aquí solo el panorama en números.
 */
export default async function InicioPage() {
  const session = await requireSession("/inicio");
  const userId = session.user.id;
  const personnelType = session.user.personnelType;
  const firstName = session.user.name?.split(" ")[0];

  const [enrollments, certificateCount, obligatoriosDisponibles, avatarUrl, agenda] = await Promise.all([
    prisma.enrollment.findMany({
      // Contenido del PLAN de capacitaciones: su seguimiento vive en
      // "Mis capacitaciones", no aquí. Sin esto el estudiante veía el mismo
      // curso en dos lugares y con dos avances distintos.
      where: { userId, status: { not: "CANCELLED" }, course: { trainingActivities: { none: {} } } },
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
        // Los contenidos del plan de capacitaciones no cuentan aquí: su
        // seguimiento vive en "Mis capacitaciones", no en el catálogo.
        trainingActivities: { none: {} },
      },
    }),
    getUserAvatarUrl(userId),
    getAgendaEstudiante(userId),
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

  const RESUMEN = [
    { valor: activos, etiqueta: "Cursos activos", detalle: `${enCurso} en curso · ${sinIniciar} sin iniciar`, href: "/mi-aula", alerta: false },
    { valor: completados, etiqueta: "Cursos completados", detalle: `${horasInscritas} h de formación inscritas`, href: "/mi-aula", alerta: false },
    { valor: certificateCount, etiqueta: "Constancias", detalle: "Descárgalas cuando quieras", href: "/mis-certificados", alerta: false },
    {
      valor: obligatoriosPendientes,
      etiqueta: "Obligatorios pendientes",
      detalle: obligatoriosPendientes > 0 ? "Requieren tu atención" : "Estás al día",
      href: "/mi-aula?tab=obligatorios",
      alerta: obligatoriosPendientes > 0,
    },
  ];

  // Lo inmediato de la agenda: en vivo, últimas 24 h y las tres más próximas.
  const inmediatas = [
    ...agenda.filter((f) => f.momento === "EN_VIVO" || f.momento === "FINALIZADA"),
    ...agenda.filter((f) => f.momento === "PROXIMA").slice(0, 3),
  ];
  const pendientes = agenda.reduce((t, f) => t + f.pendientes, 0);

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
              <AvatarProgressRing name={session.user.name ?? ""} avatarUrl={avatarUrl} progress={avanceGlobal} size={84} />
              <div className="border-l border-white/15 pl-5">
                <p className="font-display text-3xl font-extrabold leading-none text-white">{avanceGlobal}%</p>
                <p className="mt-1 text-xs text-white/75">Avance global</p>
                <p className="mt-3 font-display text-lg font-bold leading-none text-white">{enrollments.length}</p>
                <p className="mt-1 text-xs text-white/75">Cursos en total</p>
              </div>
            </div>
          </div>
        </section>

        {/* Lo primero: qué tiene que hacer hoy. La misma agenda de «Mis
            capacitaciones», recortada a lo inmediato. */}
        <SeccionAgenda
          titulo="Tu agenda"
          conteo={inmediatas.length}
          tono={inmediatas.some((f) => f.momento === "EN_VIVO") ? "vivo" : undefined}
          ayuda={pendientes > 0 ? `Tienes ${pendientes} ${pendientes === 1 ? "evaluación" : "evaluaciones"} por presentar.` : "En vivo, últimas 24 horas y lo más próximo."}
        >
          {inmediatas.length === 0 ? (
            <p className="agenda-vacio">
              <b>Nada en agenda por ahora</b>
              Cuando un área programe una capacitación para ti, aparecerá aquí con su fecha.
            </p>
          ) : (
            <ul>
              {inmediatas.map((f) => (
                <FilaDeAgenda key={f.id} fila={f} />
              ))}
            </ul>
          )}
          <Link
            href="/mis-capacitaciones"
            className="flex items-center justify-center gap-1.5 border-t border-border px-5 py-3 text-sm font-semibold text-primary transition-colors hover:bg-muted"
          >
            Ver toda mi agenda de capacitaciones
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </SeccionAgenda>

        {proximoObligatorio && (
          <Link
            href="/mi-aula?tab=obligatorios"
            className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 transition-colors hover:bg-destructive/10"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
              <ShieldAlert className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-destructive">Curso obligatorio pendiente</p>
              <p className="truncate text-[15px] font-semibold text-foreground">{proximoObligatorio}</p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </Link>
        )}

        {/* Cursos en números: una sola banda, sin repetir cifras en dos sitios. */}
        <section aria-label="Tus cursos en números">
          <div className="agenda-resumen" data-columnas="4">
            {RESUMEN.map((r) => (
              <Link key={r.etiqueta} href={r.href} data-alerta={r.alerta} className="transition-colors hover:bg-muted">
                <b>{r.valor}</b>
                <span>{r.etiqueta}</span>
                <span className="!mt-0.5 !text-[12px]">{r.detalle}</span>
              </Link>
            ))}
          </div>
        </section>

        <ComitesEnPanel userId={session.user.id} />
      </StaggerSections>
    </main>
  );
}
