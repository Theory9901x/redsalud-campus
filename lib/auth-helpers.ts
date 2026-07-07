import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("No autorizado: se requiere rol ADMIN.");
  }
  return session;
}

export async function requireTutorOrAdmin() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "TUTOR")) {
    throw new Error("No autorizado: se requiere rol TUTOR o ADMIN.");
  }
  return session;
}

/** Verifica que el usuario sea ADMIN, o TUTOR dueño del curso. Lanza si no cumple. */
export async function requireCourseAccess(courseId: string) {
  const session = await requireTutorOrAdmin();
  if (session.user.role === "ADMIN") return session;

  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { tutorId: true } });
  if (!course || course.tutorId !== session.user.id) {
    throw new Error("No autorizado: no eres el tutor de este curso.");
  }
  return session;
}
