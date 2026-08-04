import { NextResponse } from "next/server";
import { requireTrainingActivityAccess } from "@/lib/auth-helpers";
import { saveTrainingActivityDocument } from "@/lib/storage";

/**
 * Recibe la GRABACIÓN de la jornada y la guarda como documento de la
 * capacitación, junto a las demás evidencias (mismo almacenamiento privado y
 * misma lista de Documentos de la ficha). Solo quien puede gestionar la
 * actividad -admin o tutor del área- puede subirla.
 */
export async function POST(request: Request, { params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = await params;

  let userId: string;
  try {
    const { session } = await requireTrainingActivityAccess(activityId);
    userId = session.user.id;
  } catch {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Sin archivo." }, { status: 400 });
  }
  if (!file.type.startsWith("video/")) {
    return NextResponse.json({ error: "Solo se aceptan grabaciones de video." }, { status: 415 });
  }
  // Techo defensivo: 1 h a ~1 Mbps son ~500 MB; 1.5 GB cubre jornadas largas
  // sin dejar la puerta abierta a archivos arbitrariamente grandes.
  if (file.size > 1.5 * 1024 * 1024 * 1024) {
    return NextResponse.json({ error: "La grabación supera el tamaño máximo (1.5 GB)." }, { status: 413 });
  }

  await saveTrainingActivityDocument(file, activityId, userId);
  return NextResponse.json({ ok: true });
}
