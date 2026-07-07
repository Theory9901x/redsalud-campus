import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { privateMediaDiskPath } from "@/lib/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const certificate = await prisma.certificate.findUnique({ where: { id } });
  if (!certificate) {
    return NextResponse.json({ error: "Certificado no encontrado." }, { status: 404 });
  }

  const isOwner = certificate.userId === session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
    const buffer = await readFile(privateMediaDiskPath("certificates", `${certificate.id}.pdf`));
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="certificado-${certificate.certificateCode}.pdf"`,
        "Cache-Control": "private, max-age=0, no-cache",
      },
    });
  } catch {
    return NextResponse.json({ error: "El archivo del certificado no está disponible en disco." }, { status: 404 });
  }
}
