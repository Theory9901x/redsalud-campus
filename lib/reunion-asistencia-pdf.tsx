import { Document, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { SesionReunion } from "@/lib/reuniones";

const fecha = (d: Date | null) => d ? new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "medium", timeZone: "America/Bogota" }).format(d) : "Sin cierre registrado";
const navy = "#123A56";
export async function renderAsistenciaReunionPdf(d: SesionReunion) {
  const columns = ["#", "Nombre completo", "Cargo", "Ingreso", "Salida", "Minutos", "Ingresos"];
  const widths = ["4%", "25%", "22%", "18%", "18%", "7%", "6%"];
  const head = <View fixed style={{ position: "absolute", top: 24, left: 30, right: 30 }}><Text style={{ fontSize: 10, color: "#0079AD", marginBottom: 6 }}>RED SALUD CASANARE E.S.E.</Text><Text style={{ fontSize: 19, color: navy, fontFamily: "Helvetica-Bold" }}>Informe de reunión y asistencia</Text><Text style={{ marginTop: 6, fontSize: 11 }}>{d.reunion.titulo}</Text><Text style={{ marginTop: 5, fontSize: 9, color: "#536C7C" }}>{d.estado === "CLOSED" ? "Sesión cerrada" : "Informe provisional · sesión abierta"} · Generado: {fecha(new Date())}</Text></View>;
  const footer = <Text fixed style={{ position: "absolute", bottom: 18, left: 30, right: 30, fontSize: 8, color: "#536C7C" }} render={({ pageNumber, totalPages }) => `RedSalud · Registro automático de conexión a sala · Página ${pageNumber} de ${totalPages}`} />;
  const section = (title: string, text: string) => <View style={{ marginBottom: 16 }}><Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", color: navy, marginBottom: 6 }}>{title}</Text><Text style={{ fontSize: 10, lineHeight: 1.5 }}>{text || "Sin información registrada."}</Text></View>;
  return renderToBuffer(<Document>
    <Page size="A4" orientation="landscape" style={{ fontFamily: "Helvetica", paddingTop: 125, paddingHorizontal: 30, paddingBottom: 40 }}>{head}
      {section("Datos de la sesión", `${d.titulo}\nResponsable: ${d.responsable ?? "Sin responsable registrado"}\nFecha programada: ${fecha(d.jornada?.startsAt ?? null)}\nAsistentes conectados: ${d.asistentes.length} · Permanencia total: ${d.resumen.minutosTotales.toFixed(1)} minutos`)}
      {section("Objetivo", d.objetivo ?? "")}{section("Orden del día", d.reunion.ordenDelDia.join("\n"))}{section("Desarrollo de la reunión", d.desarrollo)}{section("Compromisos", d.compromisos.join("\n"))}{footer}
    </Page>
    <Page size="A4" orientation="landscape" style={{ fontFamily: "Helvetica", paddingTop: 145, paddingHorizontal: 30, paddingBottom: 40 }}>{head}
      <View fixed style={{ position: "absolute", top: 113, left: 30, right: 30, flexDirection: "row", backgroundColor: navy, color: "white", paddingVertical: 8 }}>{columns.map((c, i) => <Text key={c} style={{ width: widths[i], paddingHorizontal: 4, fontSize: 8, fontFamily: "Helvetica-Bold" }}>{c}</Text>)}</View>
      {d.asistentes.map((a, i) => <View key={a.clave} wrap={false} style={{ flexDirection: "row", paddingVertical: 8, borderBottom: "1 solid #DCE7ED", backgroundColor: i % 2 ? "#F3F7FA" : "white" }}>{[String(i + 1), a.nombre, a.cargo, fecha(a.registradoEl), a.salidaEl ? fecha(a.salidaEl) : a.estado, a.minutos.toFixed(1), String(a.conexiones)].map((v, col) => <Text key={col} style={{ width: widths[col], fontSize: 8.5, paddingHorizontal: 4, lineHeight: 1.4 }}>{v}</Text>)}</View>)}
      {!d.asistentes.length && <Text style={{ fontSize: 11 }}>No hay ingresos registrados a la sala. El registro de invitación por sí solo no acredita asistencia.</Text>}{footer}
    </Page>
  </Document>);
}
