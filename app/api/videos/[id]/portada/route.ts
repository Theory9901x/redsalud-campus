import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { leerPortada, rutaPortada } from "@/lib/videoteca/almacen";
import { veVideosSiau } from "@/lib/videoteca/acceso";

/** Portada (miniatura) de un video de la Videoteca. Pide sesión; la de un video de SIAU, ser de SIAU. La de un video público la ve cualquiera. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await auth();
  const { id } = await params;
  const v = await prisma.videoCapacitacion.findUnique({ where: { id }, select: { portada: true, publico: true, publicado: true, soloSiau: true } });
  if (!(v?.publico && v.publicado)) {
    if (!sesion?.user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    if ((!v || v.soloSiau) && !(await veVideosSiau(sesion.user))) return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }
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
