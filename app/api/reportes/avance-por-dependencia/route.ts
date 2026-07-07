import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { status: { not: "CANCELLED" } },
    select: {
      status: true,
      progressPercentage: true,
      user: { select: { id: true, department: true } },
    },
  });

  type DeptStats = {
    students: Set<string>;
    total: number;
    completed: number;
    active: number;
    failed: number;
    progressSum: number;
  };

  const byDept = new Map<string, DeptStats>();
  for (const e of enrollments) {
    const dept = e.user.department?.trim() || "Sin dependencia";
    const stats = byDept.get(dept) ?? { students: new Set(), total: 0, completed: 0, active: 0, failed: 0, progressSum: 0 };
    stats.students.add(e.user.id);
    stats.total += 1;
    stats.progressSum += e.progressPercentage;
    if (e.status === "COMPLETED") stats.completed += 1;
    else if (e.status === "ACTIVE") stats.active += 1;
    else if (e.status === "FAILED") stats.failed += 1;
    byDept.set(dept, stats);
  }

  const rows = [...byDept.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([dept, stats]) => [
      dept,
      stats.students.size,
      stats.total,
      stats.completed,
      stats.active,
      stats.failed,
      stats.total > 0 ? Math.round(stats.progressSum / stats.total) : 0,
    ]);

  const csv = toCsv(
    ["Dependencia", "Estudiantes", "Inscripciones", "Completadas", "En progreso", "Reprobadas", "Avance promedio %"],
    rows
  );

  return csvResponse("avance-por-dependencia.csv", csv);
}
