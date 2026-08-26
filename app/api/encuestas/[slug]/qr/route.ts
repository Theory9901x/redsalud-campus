import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { requireTutorOrAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * QR del enlace público de una encuesta, generado bajo demanda.
 *
 * No se genera al pintar el listado: con veinte encuestas serían veinte
 * imágenes de 300×300 embebidas en el HTML que casi nadie va a mirar.
 *
 * Pide sesión de tutor o administrador aunque el enlace resultante sea
 * público: quien difunde una encuesta es quien la gestiona, y así el
 * endpoint no sirve para enumerar los enlaces de la plataforma.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  try {
    await requireTutorOrAdmin();
  } catch {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const encuesta = await prisma.survey.findUnique({ where: { slug }, select: { id: true } });
  if (!encuesta) return NextResponse.json({ error: "Encuesta no encontrada." }, { status: 404 });

  const qr = await QRCode.toDataURL(`${APP_URL}/e/${slug}`, { width: 320, margin: 1 });
  return NextResponse.json({ qr }, { headers: { "Cache-Control": "private, max-age=3600" } });
}
