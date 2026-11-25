import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { plantillaEvaluacionExcel } from "@/lib/evaluacion-excel";

/** Plantilla de Excel para armar la evaluación presaber / postsaber de una capacitación. */
export async function GET() {
  const sesion = await auth();
  if (!sesion?.user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const archivo = await plantillaEvaluacionExcel();
  return new NextResponse(new Uint8Array(archivo), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla-evaluacion-presaber-postsaber.xlsx"',
      "Cache-Control": "private, no-store",
    },
  });
}
