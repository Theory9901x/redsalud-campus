import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("curso") || undefined;

  const attempts = await prisma.quizAttempt.findMany({
    where: {
      finishedAt: { not: null },
      ...(courseId ? { quiz: { courseId } } : {}),
    },
    orderBy: [{ finishedAt: "desc" }],
    include: {
      user: true,
      quiz: { select: { title: true, passingScore: true, course: { select: { title: true } } } },
    },
  });

  const csv = toCsv(
    ["Curso", "Cuestionario", "Estudiante", "Documento", "Intento", "Puntaje %", "Mínimo requerido %", "Resultado", "Fecha"],
    attempts.map((a) => [
      a.quiz.course.title,
      a.quiz.title,
      a.user.fullName,
      `${a.user.documentType} ${a.user.documentNumber}`,
      a.attemptNumber,
      a.score ?? "",
      a.quiz.passingScore,
      a.passed ? "Aprobado" : "Reprobado",
      a.finishedAt ? a.finishedAt.toLocaleDateString("es-CO") : "",
    ])
  );

  return csvResponse("resultados-cuestionarios.csv", csv);
}
