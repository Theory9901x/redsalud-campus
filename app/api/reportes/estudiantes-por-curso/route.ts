import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toCsv, csvResponse } from "@/lib/csv";
import { ENROLLMENT_STATUS_LABELS } from "@/components/cursos/labels";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("curso") || undefined;

  const enrollments = await prisma.enrollment.findMany({
    where: { status: { not: "CANCELLED" }, ...(courseId ? { courseId } : {}) },
    orderBy: [{ course: { title: "asc" } }, { user: { fullName: "asc" } }],
    include: { user: true, course: { select: { title: true } } },
  });

  const csv = toCsv(
    [
      "Curso",
      "Estudiante",
      "Documento",
      "Correo",
      "Departamento",
      "Estado",
      "Avance %",
      "Puntaje final",
      "Fecha inscripción",
      "Fecha completado",
    ],
    enrollments.map((e) => [
      e.course.title,
      e.user.fullName,
      `${e.user.documentType} ${e.user.documentNumber}`,
      e.user.email,
      e.user.department ?? "",
      ENROLLMENT_STATUS_LABELS[e.status],
      e.progressPercentage,
      e.finalScore ?? "",
      e.enrolledAt.toLocaleDateString("es-CO"),
      e.completedAt ? e.completedAt.toLocaleDateString("es-CO") : "",
    ])
  );

  return csvResponse("estudiantes-por-curso.csv", csv);
}
