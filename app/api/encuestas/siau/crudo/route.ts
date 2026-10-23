import { NextResponse } from "next/server";
import { requireTutorOrAdmin } from "@/lib/auth-helpers";
import { puedeGestionarSiau } from "@/lib/encuestas/acceso-siau";
import { generarDatosCrudos } from "@/lib/encuestas/exportar-crudo";
import { leerPeriodo } from "@/lib/encuestas/periodo-url";
import { registrarExportacionSiau } from "@/lib/encuestas/registro-exportacion";

/** Datos crudos SIAU (.xlsx) para un periodo y filtros. */
export async function GET(request: Request) {
  let sesion;
  try {
    sesion = await requireTutorOrAdmin();
  } catch {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }
  // La encuesta SIAU es del área de Atención al Usuario: solo el administrador
  // y la cuenta de esa área, nunca el tutor de otra área del plan.
  if (!(await puedeGestionarSiau(sesion))) return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  const url = new URL(request.url);
  const periodo = leerPeriodo(url.searchParams);
  if (!periodo) return NextResponse.json({ error: "Periodo inválido." }, { status: 400 });
  const filtros = { sede: url.searchParams.get("sede") ?? undefined, servicio: url.searchParams.get("servicio") ?? undefined, sexo: url.searchParams.get("sexo") ?? undefined, eps: url.searchParams.get("eps") ?? undefined };
  const r = await generarDatosCrudos(periodo, filtros);
  if (!r) return NextResponse.json({ error: "No existe la encuesta SIAU." }, { status: 404 });
  await registrarExportacionSiau(sesion.user.id, "datos-xlsx", periodo, filtros);
  return new NextResponse(new Uint8Array(r.buffer), {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${r.nombre}"`, "Cache-Control": "no-store" },
  });
}
