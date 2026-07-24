import { BookOpen, Layers, ShieldCheck, Clock3 } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CatalogoResultados } from "@/components/cursos/catalogo-resultados";
import { FiltrosCatalogo } from "@/components/cursos/filtros-catalogo";
import { COURSE_TYPE_LABELS, COURSE_AUDIENCE_LABELS } from "@/components/cursos/labels";
import { StaggerSections } from "@/components/brand/stagger-sections";
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

  const content = (
    <StaggerSections className="space-y-6">
      {/* Header corto: solo identifica la vista. La intro grande (saludo +
          números) vive ahora en el dashboard, que es donde tiene sentido. */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent)]">
            <Layers className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground">Catálogo de cursos</h1>
            <p className="text-[13px] text-muted-foreground">
              Inducción, reinducción y capacitación del talento humano.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
          <span className="chip-glass !text-foreground [background-color:var(--glass-bg)]">
            <BookOpen className="h-3.5 w-3.5 text-[var(--accent)]" />
            {courses.length} cursos
          </span>
          <span className="chip-glass !text-foreground [background-color:var(--glass-bg)]">
            <Clock3 className="h-3.5 w-3.5 text-warning-foreground" />
            {totalHours}h
          </span>
          {obligatoriosCount > 0 && (
            <span className="chip-glass !text-foreground [background-color:var(--glass-bg)]">
              <ShieldCheck className="h-3.5 w-3.5 text-destructive" />
              {obligatoriosCount} obligatorios
            </span>
          )}
        </div>
      </div>

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
