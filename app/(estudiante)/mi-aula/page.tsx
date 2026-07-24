import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  Download,
  GraduationCap,
  Layers,
  PlayCircle,
  QrCode,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CourseStateCard, type CursoTarjeta, type EstadoTarjeta } from "@/components/cursos/course-state-card";
import { OrdenSelect } from "@/components/cursos/orden-select";
import { EmptyState } from "@/components/brand/empty-state";
import { StaggerSections } from "@/components/brand/stagger-sections";
import { EcgPulse } from "@/components/brand/ecg-pulse";
import { cn } from "@/lib/utils";

type Tab = "en-curso" | "obligatorios" | "completados" | "todos";
const TABS: { id: Tab; label: string }[] = [
  { id: "en-curso", label: "En curso" },
  { id: "obligatorios", label: "Obligatorios" },
  { id: "completados", label: "Completados" },
  { id: "todos", label: "Todos" },
];

const ORDEN = [
  { valor: "reciente", etiqueta: "Actividad reciente" },
  { valor: "nombre", etiqueta: "Nombre A-Z" },
  { valor: "avance", etiqueta: "Mayor avance" },
];

export default async function MiAulaPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; orden?: string }>;
}) {
  const session = await auth();
  const userId = session!.user.id;
  const sp = await searchParams;

  const [enrollments, certificates, settings] = await Promise.all([
    prisma.enrollment.findMany({
      where: { userId, status: { not: "CANCELLED" } },
      orderBy: { enrolledAt: "desc" },
      include: { course: { include: { tutor: { select: { fullName: true } } } } },
    }),
    prisma.certificate.findMany({
      where: { userId, status: "VALID" },
      orderBy: { issuedAt: "desc" },
      include: { course: { select: { title: true } } },
    }),
    prisma.institutionSettings.findUnique({
      where: { id: "singleton" },
      select: { institutionName: true },
    }),
  ]);

  const institucion = settings?.institutionName ?? "Red Salud Casanare E.S.E.";

  const esEnCurso = (e: (typeof enrollments)[number]) =>
    e.status !== "COMPLETED" && e.progressPercentage > 0 && e.progressPercentage < 100;

  const estadoDe = (e: (typeof enrollments)[number]): EstadoTarjeta => {
    if (e.status === "COMPLETED") return "completado";
    if (esEnCurso(e)) return "en-curso";
    return e.course.courseType === "OBLIGATORIO" ? "obligatorio" : "disponible";
  };

  // Contadores sobre las inscripciones de ESTA persona (un puñado): contarlos
  // en memoria no es el camino lento que se reportó —ese era el listado global
  // de inscripciones del admin—, así que no hace falta agregación en SQL aquí.
  const conteos = {
    "en-curso": enrollments.filter(esEnCurso).length,
    obligatorios: enrollments.filter((e) => e.course.courseType === "OBLIGATORIO" && e.status !== "COMPLETED").length,
    completados: enrollments.filter((e) => e.status === "COMPLETED").length,
    todos: enrollments.length,
  };
  const stats = {
    activos: enrollments.filter((e) => e.status !== "COMPLETED").length,
    completados: conteos.completados,
    certificados: certificates.length,
    obligatorios: conteos.obligatorios,
  };

  // Pestaña activa: la pedida, o "En curso" si hay algo a medias, si no "Todos"
  // (para no aterrizar en una pestaña vacía).
  const tab: Tab =
    (TABS.find((t) => t.id === sp.tab)?.id as Tab | undefined) ?? (conteos["en-curso"] > 0 ? "en-curso" : "todos");

  const filtro: Record<Tab, (e: (typeof enrollments)[number]) => boolean> = {
    "en-curso": esEnCurso,
    obligatorios: (e) => e.course.courseType === "OBLIGATORIO" && e.status !== "COMPLETED",
    completados: (e) => e.status === "COMPLETED",
    todos: () => true,
  };

  const visibles = enrollments.filter(filtro[tab]);
  if (sp.orden === "nombre") visibles.sort((a, b) => a.course.title.localeCompare(b.course.title, "es"));
  else if (sp.orden === "avance") visibles.sort((a, b) => b.progressPercentage - a.progressPercentage);
  // "reciente": ya viene por enrolledAt desc de la consulta.

  const CTA: Record<EstadoTarjeta, string> = {
    obligatorio: "Ver curso",
    "en-curso": "Continuar",
    completado: "Ver de nuevo",
    disponible: "Ver curso",
  };

  const aTarjeta = (e: (typeof enrollments)[number]): CursoTarjeta => {
    const estado = estadoDe(e);
    return {
      id: e.id,
      href: `/aula/${e.courseId}`,
      imageUrl: e.course.imageUrl,
      titulo: e.course.title,
      descripcion: e.course.shortDescription,
      horas: e.course.durationHours,
      institucion,
      estado,
      progreso: estado === "en-curso" ? e.progressPercentage : undefined,
      completadoEl: e.completedAt?.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" }),
      cta: CTA[estado],
    };
  };

  // Curso del banner: el que está a medias con la inscripción más reciente.
  const continuar = enrollments.find(esEnCurso);

  const hrefTab = (id: Tab) => {
    const params = new URLSearchParams();
    if (id !== "en-curso") params.set("tab", id);
    if (sp.orden) params.set("orden", sp.orden);
    const q = params.toString();
    return q ? `?${q}` : "?";
  };

  const STATS = [
    { icon: BookOpen, value: stats.activos, label: "Cursos activos", box: "bg-primary/15 text-primary" },
    { icon: CheckCircle2, value: stats.completados, label: "Completados", box: "bg-success/15 text-success" },
    { icon: Award, value: stats.certificados, label: "Certificados", box: "bg-warning/15 text-warning-foreground" },
    { icon: ShieldAlert, value: stats.obligatorios, label: "Obligatorios pendientes", box: "bg-destructive/15 text-destructive" },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <StaggerSections className="space-y-6">
        {/* 1. Encabezado */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent)]">
              <GraduationCap className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-tight text-foreground">
                Mi aula
              </h1>
              <p className="text-[13px] text-muted-foreground">
                El panorama completo de tu formación: cursos, avance y certificados.
              </p>
            </div>
          </div>
          <Link
            href="/cursos"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-[13px] text-foreground transition-colors hover:border-[var(--accent)]/40"
          >
            Explorar catálogo <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* 2. Banner "Continuar donde quedaste" */}
        {continuar ? (
          <section className="hud-hero noise-overlay accent-student relative overflow-hidden p-6 sm:p-8">
            <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[var(--accent)]/25 blur-[90px]" />
            {continuar.course.imageUrl && (
              <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[38%] [mask-image:linear-gradient(to_left,black_25%,transparent)] sm:block">
                <Image src={continuar.course.imageUrl} alt="" fill sizes="40vw" className="object-cover opacity-45" />
              </div>
            )}
            <EcgPulse className="absolute inset-x-0 bottom-3 h-8 w-full text-[var(--accent)]/25" />
            <div className="relative">
              <span className="chip-glass">
                <PlayCircle className="h-3.5 w-3.5 text-[var(--accent)]" />
                Continuar donde quedaste
              </span>
              <h2 className="mt-4 max-w-[560px] font-display text-2xl font-extrabold leading-tight tracking-tight text-white">
                {continuar.course.title}
              </h2>
              <div className="mt-5 max-w-[440px]">
                <div className="flex items-center justify-between text-[12px] text-white/80">
                  <span>{continuar.progressPercentage}% completado</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15">
                  <div
                    className="progress-fill-animated h-full rounded-full"
                    style={{ width: `${continuar.progressPercentage}%` }}
                  />
                </div>
              </div>
              <Link
                href={`/aula/${continuar.courseId}`}
                className="btn-hud mt-6 !px-5 !py-3 !text-sm"
              >
                Continuar aprendiendo <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>
        ) : (
          <section className="hud-hero accent-student relative overflow-hidden p-8 text-center">
            <div className="relative mx-auto max-w-md">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-[var(--accent)]">
                <BookOpen className="h-7 w-7" />
              </span>
              <h2 className="mt-4 font-display text-xl font-extrabold text-white">Aún no has iniciado ningún curso</h2>
              <p className="mt-1.5 text-sm text-white/70">Inscríbete desde el catálogo y empieza a formarte.</p>
              <Link href="/cursos" className="btn-hud mt-5">
                Explorar catálogo <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>
        )}

        {/* 3. Estadísticas */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="surface flex items-center gap-3 p-4">
              <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", s.box)}>
                <s.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 leading-tight">
                <p className="font-display text-xl font-extrabold text-foreground">{s.value}</p>
                <p className="truncate text-[12px] text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* 4. Pestañas + orden */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex flex-wrap items-center gap-1.5 rounded-2xl border border-border bg-card p-1.5">
            {TABS.map((t) => (
              <Link
                key={t.id}
                href={hrefTab(t.id)}
                scroll={false}
                className={cn(
                  "rounded-xl px-4 py-2 text-[13px] transition-colors",
                  tab === t.id
                    ? "border border-[var(--accent)]/40 bg-[var(--accent)]/15 font-semibold text-[var(--accent)]"
                    : "border border-transparent text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                )}
              >
                {t.label} <span className="opacity-70">({conteos[t.id]})</span>
              </Link>
            ))}
          </div>
          {visibles.length > 0 && <OrdenSelect opciones={ORDEN} />}
        </div>

        {/* 5. Grilla de cursos */}
        {visibles.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No tienes cursos en esta categoría"
            description="Explora el catálogo para inscribirte en nuevos cursos."
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {visibles.map((e) => (
              <CourseStateCard key={e.id} curso={aTarjeta(e)} />
            ))}
          </div>
        )}

        {/* 6. Certificados */}
        <section id="mis-certificados" className="scroll-mt-20 space-y-4">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warning/15 text-warning-foreground">
              <Award className="h-[18px] w-[18px]" />
            </span>
            <h2 className="font-display text-xl font-extrabold text-foreground">Mis certificados</h2>
            <span className="h-4 w-px bg-border" />
            <span className="text-[13px] text-muted-foreground">
              {certificates.length} {certificates.length === 1 ? "emitido" : "emitidos"}
            </span>
          </div>

          {certificates.length === 0 ? (
            <EmptyState
              icon={Award}
              title="Aún no tienes certificados"
              description="Completa un curso para obtener tu primer certificado verificable con código QR."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {certificates.map((c) => (
                <article
                  key={c.id}
                  style={{
                    backgroundImage:
                      "linear-gradient(150deg, color-mix(in oklch, var(--warning) 20%, var(--card)) 0%, color-mix(in oklch, var(--warning) 7%, var(--card)) 60%, var(--card) 100%)",
                    borderColor: "color-mix(in oklch, var(--warning) 30%, transparent)",
                  }}
                  className="surface-hover relative overflow-hidden rounded-2xl border p-5 shadow-[var(--shadow-1)]"
                >
                  <Award
                    className="pointer-events-none absolute -right-3 top-1/2 h-24 w-24 -translate-y-1/2 text-warning/[0.10]"
                    strokeWidth={1.5}
                  />
                  <div className="relative flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-warning/20 text-warning-foreground">
                      <Award className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate font-display text-[15px] font-bold leading-snug text-foreground">
                        {c.course.title}
                      </h3>
                      <p className="mt-1 font-mono text-[11.5px] text-muted-foreground">{c.certificateCode}</p>
                      <p className="text-[11.5px] text-muted-foreground">
                        Emitido el {c.issuedAt.toLocaleDateString("es-CO")}
                      </p>
                    </div>
                  </div>
                  <div className="relative mt-4 flex items-center gap-2">
                    <Link
                      href={`/mi-aula/certificados/${c.id}`}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-[12.5px] font-semibold text-foreground transition-colors hover:border-[var(--accent)]/40"
                    >
                      <Download className="h-3.5 w-3.5" /> Descargar
                    </Link>
                    <Link
                      href={`/validar/${c.certificateCode}`}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <QrCode className="h-3.5 w-3.5" /> Validar
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* 7. Pie */}
        <div className="flex items-center justify-center gap-2 pt-2 text-[12.5px] text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-[var(--accent)]/70" />
          Tu formación es nuestro compromiso con la calidad y la seguridad en salud.
        </div>
      </StaggerSections>
    </main>
  );
}
