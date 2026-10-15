import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildTrainingScheduleTemplate } from "@/lib/training-plan-import";
import { veComoAdmin } from "@/lib/roles";

export async function GET() {
  const session = await auth();
  if (!session?.user || (!veComoAdmin(session.user.role) && session.user.role !== "TUTOR")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const buffer = await buildTrainingScheduleTemplate();

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="plantilla-cronograma.xlsx"`,
    },
  });
}
