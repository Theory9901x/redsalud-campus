import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { leerPortada, rutaPortada } from "@/lib/videoteca/almacen";

/** Portada (miniatura) de un video de la Videoteca. Solo con sesión. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await auth();
  if (!sesion?.user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const { id } = await params;
  const v = await prisma.videoCapacitacion.findUnique({ where: { id }, select: { portada: true } });
  if (!v?.portada) return NextResponse.json({ error: "Sin portada." }, { status: 404 });
  try {
    const { size } = await stat(rutaPortada(v.portada));
    return new NextResponse(Readable.toWeb(leerPortada(v.portada)) as ReadableStream, {
      headers: { "Content-Type": "image/jpeg", "Content-Length": String(size), "Cache-Control": "private, max-age=86400" },
    });
  } catch {
    return NextResponse.json({ error: "Sin portada." }, { status: 404 });
  }
}
