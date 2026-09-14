import { NextResponse } from "next/server";
import { requireTutorOrAdmin } from "@/lib/auth-helpers";
import { generarFormatoDocx } from "@/lib/encuestas/formato-docx";

/** Descarga del formato oficial de la encuesta en Word (.docx), generado en servidor. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    await requireTutorOrAdmin();
  } catch {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }
  const resultado = await generarFormatoDocx(slug);
  if (!resultado) return NextResponse.json({ error: "Encuesta no encontrada." }, { status: 404 });
  return new NextResponse(new Uint8Array(resultado.buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${resultado.nombre}"`,
      "Cache-Control": "no-store",
    },
  });
}
