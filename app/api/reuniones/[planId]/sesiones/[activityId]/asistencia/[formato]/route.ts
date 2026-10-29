import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getSesionReunion } from "@/lib/reuniones";
import { renderAsistenciaReunionPdf } from "@/lib/reunion-asistencia-pdf";

const fecha = (d: Date | null) => d ? new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "medium", timeZone: "America/Bogota" }).format(d) : "";
export async function GET(_req: Request, { params }: { params: Promise<{ planId: string; activityId: string; formato: string }> }) {
  const { planId, activityId, formato } = await params;
  if (!["excel", "pdf"].includes(formato)) return NextResponse.json({ error: "Formato no disponible." }, { status: 404 });
  let d;
  try { d = await getSesionReunion(planId, activityId); } catch { return NextResponse.json({ error: "No autorizado." }, { status: 403 }); }
  if (!d) return NextResponse.json({ error: "Reunión no encontrada." }, { status: 404 });
  const filename = `Asistencia-${d.titulo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 65)}`;
  if (formato === "pdf") return new NextResponse(new Uint8Array(await renderAsistenciaReunionPdf(d)), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}.pdf"`, "Cache-Control": "no-store" } });
  const wb = new ExcelJS.Workbook(); wb.creator = "RedSalud Casanare E.S.E.";
  const asistencia = wb.addWorksheet("Asistencia", { views: [{ state: "frozen", ySplit: 1 }] });
  asistencia.addTable({ name: "AsistenciaReunion", ref: "A1", headerRow: true, style: { theme: "TableStyleMedium2", showRowStripes: true }, columns: ["Nro", "Nombre completo", "Cargo", "Ingreso", "Salida", "Minutos", "Ingresos", "Tipo", "Estado"].map(name => ({ name, filterButton: true })), rows: d.asistentes.map((a, i) => [i + 1, a.nombre, a.cargo, fecha(a.registradoEl), a.salidaEl ? fecha(a.salidaEl) : "", a.minutos, a.conexiones, a.tipo === "cuenta" ? "Con cuenta" : "Invitado", a.estado]) });
  asistencia.columns.forEach((c, i) => { c.width = [8, 38, 38, 25, 25, 12, 12, 16, 24][i]; });
  const informe = wb.addWorksheet("Informe"); informe.columns = [{ width: 26 }, { width: 100 }];
  informe.addRows([["Entidad", "Red Salud Casanare E.S.E."], ["Reunión", d.reunion.titulo], ["Sesión", d.titulo], ["Estado", d.estado], ["Responsable", d.responsable ?? ""], ["Programada", fecha(d.jornada?.startsAt ?? null)], ["Generado", fecha(new Date())], ["Asistentes en sala", d.asistentes.length], ["Minutos registrados", d.resumen.minutosTotales], ["Objetivo", d.objetivo ?? ""], ["Orden del día", d.reunion.ordenDelDia.join("\n")], ["Desarrollo", d.desarrollo], ["Compromisos", d.compromisos.join("\n")]]);
  informe.eachRow(r => { r.getCell(1).font = { bold: true }; r.getCell(2).alignment = { wrapText: true, vertical: "top" }; });
  const tramos = wb.addWorksheet("Conexiones", { views: [{ state: "frozen", ySplit: 1 }] });
  tramos.addTable({ name: "ConexionesReunion", ref: "A1", headerRow: true, style: { theme: "TableStyleMedium2", showRowStripes: true }, columns: ["Nombre", "Cargo", "Evento", "Desde", "Hasta", "Segundos"].map(name => ({ name, filterButton: true })), rows: d.tramos.map(t => [t.user?.fullName ?? t.externalParticipant?.fullName ?? t.displayName, t.user?.position ?? t.externalParticipant?.company ?? "Sin cargo registrado", t.event, fecha(t.joinedAt), fecha(t.leftAt), t.durationSeconds]) });
  tramos.columns.forEach((c, i) => { c.width = [38, 38, 18, 25, 25, 12][i]; });
  return new NextResponse(new Uint8Array(await wb.xlsx.writeBuffer()), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${filename}.xlsx"`, "Cache-Control": "no-store" } });
}
