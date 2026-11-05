import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { veComoAdmin } from "@/lib/roles";
import { registrarAuditoria } from "@/lib/audit";
import { generarExcelUsuarios } from "@/lib/usuarios-excel";
import { respuestaExcel } from "@/lib/excel-tabla";

/**
 * Descarga el directorio completo de usuarios (sin administradores) en Excel.
 * Bajo /admin/usuarios para que el proxy aplique la restricción de sección
 * USUARIOS; aquí se vuelve a comprobar por si se llama directo.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user || !veComoAdmin(session.user.role) || (session.user.restrictedAdminSections ?? []).includes("USUARIOS")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }
  const { wb, nombre } = await generarExcelUsuarios(session.user.name ?? session.user.email ?? "—");
  await registrarAuditoria({
    userId: session.user.id,
    action: "EXPORT",
    entity: "User",
    entityId: null,
    description: "Exportó el directorio de usuarios a Excel",
  });
  return respuestaExcel(wb, nombre);
}
