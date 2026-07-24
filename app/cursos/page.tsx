import { BookOpen, Layers, ShieldCheck, Clock3 } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CatalogoResultados } from "@/components/cursos/catalogo-resultados";
import { FiltrosCatalogo } from "@/components/cursos/filtros-catalogo";
import { COURSE_TYPE_LABELS, COURSE_AUDIENCE_LABELS } from "@/components/cursos/labels";
import { StaggerSections } from "@/components/brand/stagger-sections";
import { EcgPulse } from "@/components/brand/ecg-pulse";
import { StudentShell } from "@/components/student/student-shell";
import { AdminShell } from "@/components/admin/admin-shell";
import { TutorShell, TutorContextBanner } from "@/components/tutor/tutor-shell";
import { PublicCoursesShell } from "@/components/cursos/public-courses-shell";
import { getUserAvatarUrl } from "@/lib/avatar";
import { getNotificationsForUser } from "@/lib/notifications";
import type { Prisma } from "@prisma/client";

export default async function CatalogoCursosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoria?: string; tipo?: string; estado?: string; orden?: string }>;
}) {
  const session = await auth();
  const sp = await searchParams;
  const lista = (v?: string) => (v ?? "").split(",").filter(Boolean);

  // Visitante anónimo: ve todo el catálogo público. Usuario con sesión: solo
  // los cursos de su tipo de personal (o "Ambos"), igual que en su dashboard.
  const where: Prisma.CourseWhereInput = { status: "PUBLISHED" };
  if (session?.user) {
    where.targetAudience = { in: [session.user.personnelType, "AMBOS"] };
  }

  // Se traen los cursos que le corresponden al usuario y los contadores de
  // cada faceta se calculan sobre ese conjunto, en el servidor: así el número
  // que ve junto a cada opción es real, no una estimación del cliente.
  const [todos, categories, misInscripciones] = await Promise.all([
    prisma.course.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      include: { category: { select: { id: true, name: true } }, tutor: { select: { fullName: true } } },
    }),
    prisma.courseCategory.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    session?.user
      ? prisma.enrollment.findMany({
          where: { userId: session.user.id },
          select: { courseId: true, status: true, progressPercentage: true, completedAt: true },
        })
      : Promise.resolve([]),
  ]);

  const institucion =
    (await prisma.institutionSettings.findUnique({ where: { id: "singleton" }, select: { institutionName: true } }))
      ?.institutionName ?? "Red Salud Casanare E.S.E.";

  const estadoPorCurso = new Map(misInscripciones.map((e) => [e.courseId, e]));
  const estadoDe = (id: string) => {
    const e = estadoPorCurso.get(id);
    if (!e) return "pendiente";
    if (e.status === "COMPLETED") return "completado";
    return e.progressPercentage > 0 ? "en-curso" : "pendiente";
  };

  const filtrosCategoria = lista(sp.categoria);
  const filtrosTipo = lista(sp.tipo);
  const filtrosEstado = lista(sp.estado);
  const busqueda = (sp.q ?? "").trim().toLowerCase();

  const coincide = (c: (typeof todos)[number]) =>
    (busqueda === "" || c.title.toLowerCase().includes(busqueda)) &&
    (filtrosCategoria.length === 0 || (c.category && filtrosCategoria.includes(c.category.id))) &&
    (filtrosTipo.length === 0 || filtrosTipo.includes(c.courseType)) &&
    (filtrosEstado.length === 0 || filtrosEstado.includes(estadoDe(c.id)));

  const filtrados = todos.filter(coincide);
  const courses =
    sp.orden === "nombre"
      ? [...filtrados].sort((a, b) => a.title.localeCompare(b.title, "es"))
      : sp.orden === "duracion"
        ? [...filtrados].sort((a, b) => b.durationHours - a.durationHours)
        : filtrados; // "reciente": ya viene ordenado por publishedAt desc

  const facetas = [
    {
      paramName: "categoria",
      titulo: "Categoría",
      opciones: categories.map((cat) => ({
        valor: cat.id,
        etiqueta: cat.name,
        conteo: todos.filter((c) => c.category?.id === cat.id).length,
      })),
    },
    {
      paramName: "tipo",
      titulo: "Tipo de curso",
      opciones: [...new Set(todos.map((c) => c.courseType))].map((tipo) => ({
        valor: tipo,
        etiqueta: COURSE_TYPE_LABELS[tipo],
        conteo: todos.filter((c) => c.courseType === tipo).length,
      })),
    },
    {
      paramName: "estado",
      titulo: "Mi avance",
      opciones: [
        { valor: "pendiente", etiqueta: "Sin iniciar", conteo: todos.filter((c) => estadoDe(c.id) === "pendiente").length },
        { valor: "en-curso", etiqueta: "En curso", conteo: todos.filter((c) => estadoDe(c.id) === "en-curso").length },
        { valor: "completado", etiqueta: "Completado", conteo: todos.filter((c) => estadoDe(c.id) === "completado").length },
      ],
    },
  ]
    .map((f) => ({
      ...f,
      opciones: [...f.opciones].sort((a, b) => b.conteo - a.conteo || a.etiqueta.localeCompare(b.etiqueta)),
    }))
    .filter((f) => f.opciones.length > 0);

  const totalHours = courses.reduce((sum, c) => sum + c.durationHours, 0);
  const obligatoriosCount = courses.filter((c) => c.courseType === "OBLIGATORIO").length;
  const firstName = session?.user.name?.split(" ")[0];

  const content = (
    <StaggerSections className="space-y-10">
      {/* Mismo tratamiento "signature" que el hero del dashboard de estudiante:
          banda navy con pulso ECG atravesando de fondo, no un bloque de texto
          centrado y plano sobre blanco. */}
      <section className="noise-overlay relative isolate overflow-hidden rounded-3xl bg-navy px-6 py-12 text-white sm:px-10 sm:py-16">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 8% -15%, color-mix(in oklch, var(--primary) 35%, transparent), transparent 55%), radial-gradient(circle at 100% 115%, color-mix(in oklch, var(--success) 22%, transparent), transparent 55%)",
          }}
        />
        {/* Orbes de luz difuminados detrás del contenido, parientes del login/aula. */}
        <div className="pointer-events-none absolute -left-20 top-1/3 h-64 w-64 rounded-full bg-primary/30 blur-[90px]" />
        <div className="pointer-events-none absolute -top-24 right-[20%] h-56 w-56 rounded-full bg-success/20 blur-[100px]" />
        <EcgPulse className="absolute inset-x-0 bottom-3 h-10 w-full text-primary/30 sm:bottom-4 sm:h-12" />

        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Plataforma oficial · RedSalud Casanare E.S.E.
          </span>
          <h1 className="mt-4 max-w-2xl font-display text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
            {firstName ? `Hola, ${firstName}. ` : ""}Todo tu proceso de{" "}
            <span className="bg-gradient-to-r from-primary to-success bg-clip-text text-transparent">
              formación institucional
            </span>{" "}
            en un solo lugar.
          </h1>
          <p className="mt-4 max-w-lg text-sm text-white/70">
            Inducción, reinducción y capacitación del talento humano de Red Salud Casanare E.S.E.
          </p>

          {/* Estadísticas en mini-tarjetas glass con ícono en contenedor de
              color propio: con peso visual, no números flotando sueltos. */}
          <div className="mt-8 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
            <div className="surface-glass-dark flex items-center gap-3 rounded-2xl px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/25 text-primary">
                <BookOpen className="h-4 w-4" />
              </span>
              <div>
                <p className="font-display text-xl font-extrabold leading-none">{courses.length}</p>
                <p className="mt-1 text-xs text-white/60">Cursos disponibles</p>
              </div>
            </div>
            <div className="surface-glass-dark flex items-center gap-3 rounded-2xl px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-success/25 text-success">
                <Layers className="h-4 w-4" />
              </span>
              <div>
                <p className="font-display text-xl font-extrabold leading-none">{categories.length}</p>
                <p className="mt-1 text-xs text-white/60">Categorías</p>
              </div>
            </div>
            <div className="surface-glass-dark flex items-center gap-3 rounded-2xl px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warning/25 text-warning">
                <Clock3 className="h-4 w-4" />
              </span>
              <div>
                <p className="font-display text-xl font-extrabold leading-none">{totalHours}h</p>
                <p className="mt-1 text-xs text-white/60">De contenido</p>
              </div>
            </div>
            {obligatoriosCount > 0 && (
              <div className="surface-glass-dark glow-danger flex items-center gap-3 rounded-2xl px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-destructive/25 text-red-300">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-display text-xl font-extrabold leading-none">{obligatoriosCount}</p>
                  <p className="mt-1 text-xs text-white/60">Obligatorios</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <FiltrosCatalogo facetas={facetas} total={courses.length} />

      <CatalogoResultados
        courses={courses.map((course) => ({
          id: course.id,
          href: `/cursos/${course.slug}`,
          imageUrl: course.imageUrl,
          title: course.title,
          courseType: course.courseType,
          categoryName: course.category?.name ?? null,
          audienceLabel:
            course.targetAudience === "AMBOS" ? null : COURSE_AUDIENCE_LABELS[course.targetAudience],
          durationHours: course.durationHours,
          tutorName: course.tutor.fullName,
          descripcion: course.shortDescription,
          institucion,
          estado: session?.user ? estadoDe(course.id) : undefined,
          progreso: estadoPorCurso.get(course.id)?.progressPercentage,
          completadoEl: estadoPorCurso.get(course.id)?.completedAt?.toLocaleDateString("es-CO", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }),
        }))}
      />
    </StaggerSections>
  );

  // El catálogo (a diferencia del detalle de un curso) preserva el dashboard
  // de quien ya tiene sesión, para no darle la sensación de haber salido de
  // la plataforma solo por mirar la lista de cursos.
  if (session?.user.role === "STUDENT") {
    const [avatarUrl, settings, { notifications, unreadCount }, user] = await Promise.all([
      getUserAvatarUrl(session.user.id),
      prisma.institutionSettings.findUnique({ where: { id: "singleton" } }),
      getNotificationsForUser(session.user.id, session.user.role),
      prisma.user.findUnique({ where: { id: session.user.id }, select: { position: true } }),
    ]);

    return (
      <StudentShell
        userName={session.user.name ?? ""}
        avatarUrl={avatarUrl}
        logoUrl={settings?.logoUrl ?? null}
        notifications={notifications}
        unreadCount={unreadCount}
        position={user?.position ?? null}
        personnelType={session.user.personnelType}
      >
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{content}</main>
      </StudentShell>
    );
  }

  if (session?.user.role === "ADMIN") {
    return (
      <AdminShell userName={session.user.name ?? "Administrador"} restrictedAdminSections={session.user.restrictedAdminSections}>
        <div className="mx-auto w-full max-w-6xl">{content}</div>
      </AdminShell>
    );
  }

  // Tutor: conserva su chrome de trabajo con un banner de contexto discreto.
  if (session?.user.role === "TUTOR") {
    return (
      <TutorShell userName={session.user.name ?? "Tutor"} banner={<TutorContextBanner />}>
        <div className="mx-auto w-full max-w-6xl">{content}</div>
      </TutorShell>
    );
  }

  // Visitante anónimo: header público flotante.
  return <PublicCoursesShell maxWidth="max-w-5xl">{content}</PublicCoursesShell>;
}
