import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { privateMediaDiskPath } from "@/lib/storage";
import { veComoAdmin } from "@/lib/roles";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const certificate = await prisma.certificate.findUnique({ where: { id } });
  if (!certificate) {
    return NextResponse.json({ error: "Constancia no encontrada." }, { status: 404 });
  }

  const isOwner = certificate.userId === session.user.id;
  const isAdmin = veComoAdmin(session.user.role);
  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
    const buffer = await readFile(privateMediaDiskPath("certificates", `${certificate.id}.pdf`));
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="constancia-${certificate.certificateCode}.pdf"`,
        "Cache-Control": "private, max-age=0, no-cache",
      },
    });
  } catch {
    return NextResponse.json({ error: "El archivo de la constancia no está disponible en disco." }, { status: 404 });
  }
}
