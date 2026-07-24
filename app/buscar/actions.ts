"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type ResultadoBusqueda = {
  id: string;
  titulo: string;
  detalle: string;
  href: string;
  grupo: "Cursos" | "Personas" | "Secciones";
};

const LIMITE_POR_GRUPO = 6;

/**
 * Secciones navegables por rol.
 *
 * Vive en el servidor junto al resto de la búsqueda a propósito: si la lista
 * estuviera en el cliente, cualquiera podría leer los enlaces del panel
 * administrativo desde el navegador de un estudiante. No daría acceso —las
 * rutas están protegidas igual— pero sí revelaría el mapa del sistema.
 */
const SECCIONES: Record<string, { titulo: string; detalle: string; href: string }[]> = {
  ADMIN: [
    { titulo: "Dashboard", detalle: "Resumen general", href: "/admin" },
    { titulo: "Usuarios", detalle: "Personas de la plataforma", href: "/admin/usuarios" },
    { titulo: "Cursos", detalle: "Catálogo institucional", href: "/admin/cursos" },
    { titulo: "Planes de capacitación", detalle: "Programación anual", href: "/admin/planes-capacitacion" },
    { titulo: "Inscripciones", detalle: "Quién está en qué curso", href: "/admin/inscripciones" },
    { titulo: "Certificados", detalle: "Emitidos y revocados", href: "/admin/certificados" },
    { titulo: "Notificaciones", detalle: "Avisos a la comunidad", href: "/admin/notificaciones" },
    { titulo: "Centro de datos", detalle: "Gráficas de cumplimiento", href: "/admin/reportes/centro" },
    { titulo: "Reportes", detalle: "Descargas y detalle", href: "/admin/reportes" },
    { titulo: "Bitácora", detalle: "Trazabilidad de cambios", href: "/admin/bitacora" },
    { titulo: "Configuración", detalle: "Datos de la institución", href: "/admin/configuracion" },
  ],
  TUTOR: [
    { titulo: "Panel", detalle: "Resumen de tus cursos", href: "/tutor" },
    { titulo: "Mis cursos", detalle: "Contenido que dictas", href: "/tutor/cursos" },
    { titulo: "Planes de capacitación", detalle: "Programación", href: "/tutor/planes-capacitacion" },
    { titulo: "Inscritos y progreso", detalle: "Quién avanza y quién no", href: "/tutor/inscritos" },
    { titulo: "Certificados", detalle: "Emitidos en tus cursos", href: "/tutor/certificados" },
    { titulo: "Catálogo institucional", detalle: "Todos los cursos", href: "/cursos" },
  ],
  STUDENT: [
    { titulo: "Dashboard", detalle: "Tu resumen", href: "/inicio" },
    { titulo: "Mis cursos", detalle: "En los que estás inscrito", href: "/mi-aula" },
    { titulo: "Catálogo", detalle: "Cursos disponibles", href: "/cursos" },
    { titulo: "Mis certificados", detalle: "Los que ya obtuviste", href: "/mi-aula#mis-certificados" },
    { titulo: "Mis capacitaciones", detalle: "Sesiones programadas", href: "/mis-capacitaciones" },
    { titulo: "Mis encuestas", detalle: "Pendientes de responder", href: "/mis-encuestas" },
    { titulo: "Perfil", detalle: "Tus datos y contraseña", href: "/perfil" },
  ],
};

/**
 * Búsqueda global de la paleta (⌘K).
 *
 * Qué puede encontrar cada quien lo decide el SERVIDOR a partir de la sesión,
 * no un parámetro que mande el cliente: buscar personas es una capacidad de
 * gestión, y un estudiante que escriba un apellido no debe recibir el listado
 * del personal con sus cédulas y correos.
 *
 * Los cursos también se filtran: quien no gestiona solo ve los publicados.
 */
export async function buscarGlobal(consulta: string): Promise<ResultadoBusqueda[]> {
  const session = await auth();
  if (!session?.user) return [];

  const q = consulta.trim();
  const rol = session.user.role;
  const esAdmin = rol === "ADMIN";
  const esTutor = rol === "TUTOR";

  const secciones = (SECCIONES[rol] ?? SECCIONES.STUDENT)
    .filter((s) => !q || s.titulo.toLowerCase().includes(q.toLowerCase()))
    .slice(0, LIMITE_POR_GRUPO)
    .map((s) => ({ id: `sec-${s.href}`, ...s, grupo: "Secciones" as const }));

  // Sin texto, la paleta abre mostrando a dónde se puede ir. Es más útil que
  // una lista vacía y le enseña al usuario qué hay sin tener que adivinar.
  if (q.length < 2) return secciones;

  const cursos = await prisma.course.findMany({
    where: {
      title: { contains: q, mode: "insensitive" },
      // Un admin ve todo; un tutor, además de lo publicado, sus propios
      // borradores —no los de otros—; un estudiante, solo lo publicado.
      ...(esAdmin
        ? {}
        : esTutor
          ? { OR: [{ status: "PUBLISHED" }, { tutorId: session.user.id }] }
          : { status: "PUBLISHED" }),
    },
    select: { id: true, title: true, slug: true, courseType: true, status: true },
    take: LIMITE_POR_GRUPO,
    orderBy: { title: "asc" },
  });

  // Solo el administrador busca personas: es quien tiene la pantalla donde
  // aterrizar (/admin/usuarios/[id]). Mandar a un tutor allí sería llevarlo a
  // una puerta cerrada, y devolverle cédulas y correos del personal sin tener
  // dónde usarlos es filtrar datos sin motivo.
  const personas = esAdmin
    ? await prisma.user.findMany({
        where: {
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { documentNumber: { contains: q } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true, fullName: true, email: true, documentNumber: true, position: true },
        take: LIMITE_POR_GRUPO,
        orderBy: { fullName: "asc" },
      })
    : [];

  return [
    ...cursos.map((c) => ({
      id: `curso-${c.id}`,
      titulo: c.title,
      detalle: c.status === "PUBLISHED" ? "Curso publicado" : "Curso en borrador",
      // Un gestor va a editarlo; un estudiante, a verlo.
      href: esAdmin ? `/admin/cursos/${c.id}` : esTutor ? `/tutor/cursos/${c.id}` : `/cursos/${c.slug}`,
      grupo: "Cursos" as const,
    })),
    ...personas.map((p) => ({
      id: `persona-${p.id}`,
      titulo: p.fullName,
      detalle: [p.documentNumber, p.position || p.email].filter(Boolean).join(" · "),
      href: `/admin/usuarios/${p.id}`,
      grupo: "Personas" as const,
    })),
    ...secciones,
  ];
}
