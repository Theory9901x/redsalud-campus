import { prisma } from "@/lib/prisma";

/**
 * TODO USUARIO TIENE EL CURSO DE INDUCCIÓN Y REINDUCCIÓN.
 *
 * Es la formación que todo el personal debe cursar, así que no depende de que
 * la persona lo busque y se inscriba: se le asigna solo. Se llama al crear la
 * cuenta (registro y panel de usuarios) y, como red de seguridad para las
 * cuentas que nacen por carga masiva o scripts, en cada inicio de sesión.
 *
 * Idempotente: quien ya lo tiene -en curso, terminado o cancelado por un
 * administrador- queda como está. Solo aplica a estudiantes y a los cursos de
 * inducción publicados que correspondan a su tipo de personal.
 */
export async function asegurarInduccion(userId: string): Promise<number> {
  const usuario = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, personnelType: true } });
  if (!usuario || usuario.role !== "STUDENT") return 0;
  const cursos = await prisma.course.findMany({
    where: {
      courseType: "INDUCCION",
      status: "PUBLISHED",
      esContenedorCapacitacion: false,
      targetAudience: { in: [usuario.personnelType, "AMBOS"] },
      enrollments: { none: { userId } },
    },
    select: { id: true },
  });
  if (cursos.length === 0) return 0;
  const { count } = await prisma.enrollment.createMany({
    data: cursos.map((c) => ({ userId, courseId: c.id, status: "ACTIVE" as const })),
    skipDuplicates: true,
  });
  return count;
}
