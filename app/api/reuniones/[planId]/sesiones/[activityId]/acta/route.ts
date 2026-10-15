import { NextResponse } from "next/server";
import { requireTutorOrAdmin } from "@/lib/auth-helpers";
import { getSesionReunion } from "@/lib/reuniones";
import { renderActaReunionPdf } from "@/lib/acta-reunion-pdf";
import { registrarAuditoria } from "@/lib/audit";

/** Acta en PDF de una sesión de reunión abierta (se puede generar en cualquier momento; dice si está abierta o cerrada). */
export async function GET(_req: Request, { params }: { params: Promise<{ planId: string; activityId: string }> }) {
  let sesion;
  try {
    sesion = await requireTutorOrAdmin();
  } catch {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }
  const { planId, activityId } = await params;
  const d = await getSesionReunion(planId, activityId);
  if (!d) return NextResponse.json({ error: "La sesión no existe." }, { status: 404 });
  const { buffer, codigo } = await renderActaReunionPdf(d, sesion.user.name ?? "—");
  await registrarAuditoria({ userId: sesion.user.id, action: "EXPORT", entity: "TrainingActivity", entityId: activityId, description: `Acta ${codigo} generada` }).catch(() => {});
  const nombre = d.titulo.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Acta-${codigo}-${nombre}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
