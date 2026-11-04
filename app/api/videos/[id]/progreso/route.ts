import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Avance de una persona en un video: hasta dónde llegó y dónde va. Lo manda
 * el reproductor cada pocos segundos; con eso se retoma donde quedó y Talento
 * Humano ve quién lo vio completo. También vale para perfiles de solo
 * lectura (el proxy lo deja pasar): ver un video no cambia nada del campus.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await auth();
  // Sin sesión (video público) no hay a quién registrarle el avance.
  if (!sesion?.user) return NextResponse.json({ ok: true, anonimo: true });
  const { id } = await params;
  const b = (await request.json().catch(() => ({}))) as { posicion?: number; duracion?: number };
  const posicion = Math.max(0, Math.floor(Number(b.posicion) || 0));

  const video = await prisma.videoCapacitacion.findUnique({ where: { id }, select: { publicado: true, duracionSeg: true } });
  if (!video) return NextResponse.json({ error: "No existe." }, { status: 404 });

  const duracion = video.duracionSeg ?? Math.floor(Number(b.duracion) || 0);
  const tope = duracion > 0 ? Math.min(posicion, duracion) : posicion;
  const completo = duracion > 0 && tope >= duracion * 0.9;

  const previa = await prisma.videoVista.findUnique({ where: { videoId_userId: { videoId: id, userId: sesion.user.id } }, select: { segundos: true, completado: true } });
  await prisma.videoVista.upsert({
    where: { videoId_userId: { videoId: id, userId: sesion.user.id } },
    create: { videoId: id, userId: sesion.user.id, segundos: tope, posicion: tope, completado: completo },
    update: {
      segundos: Math.max(previa?.segundos ?? 0, tope),
      posicion: tope,
      completado: (previa?.completado ?? false) || completo,
      ultimaVez: new Date(),
    },
  });
  return NextResponse.json({ ok: true });
}
