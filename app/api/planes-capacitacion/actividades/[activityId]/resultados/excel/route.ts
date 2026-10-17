import { NextResponse } from "next/server";
import { requireTrainingActivityAccess } from "@/lib/auth-helpers";
import { generarExcelResultadosCiclo } from "@/lib/resultados-ciclo-excel";

/**
 * Excel de los resultados presaber / postsaber de una capacitación (por
 * persona, por pregunta y por jornada). Mismo permiso adscrito que la
 * pantalla: el admin, o quien gestiona la capacitación. ?t= acota a un
 * trimestre. El CSV viejo (../resultados) sigue respondiendo, sin enlace.
 */
export async function GET(request: Request, { params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = await params;
  try {
    await requireTrainingActivityAccess(activityId);
  } catch {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const archivo = await generarExcelResultadosCiclo(activityId, new URL(request.url).searchParams.get("t"));
  if (!archivo) return NextResponse.json({ error: "Capacitación no encontrada." }, { status: 404 });

  return new NextResponse(new Uint8Array(archivo.buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${archivo.nombre}"`,
      "Cache-Control": "no-store",
    },
  });
}
