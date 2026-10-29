import { Document, Page, View, Text, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { SesionReunion } from "@/lib/reuniones";

const C = { navy: "#143B55", blue: "#007DAD", green: "#209B76", ink: "#173346", muted: "#536E7D", line: "#DCE6EC", pale: "#F2F7FA" };
const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 10, color: C.ink, paddingTop: 114, paddingHorizontal: 34, paddingBottom: 45 },
  header: { position: "absolute", top: 24, left: 34, right: 34, borderBottomWidth: 2, borderBottomColor: C.blue, paddingBottom: 10 },
  row: { flexDirection: "row" },
  title: { fontFamily: "Helvetica-Bold", fontSize: 20, color: C.navy },
  section: { marginBottom: 16 },
  sectionTitle: { fontFamily: "Helvetica-Bold", fontSize: 12, color: C.navy, marginBottom: 7 },
  text: { lineHeight: 1.5, fontSize: 10 },
  muted: { fontSize: 9, color: C.muted, lineHeight: 1.4 },
  footer: { position: "absolute", bottom: 18, left: 34, right: 34, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 6, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: C.muted },
});
const date = (d: Date | null) => d ? new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: "America/Bogota" }).format(d) : "Sin fecha registrada";
const datetime = (d: Date | null) => d ? new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short", timeZone: "America/Bogota" }).format(d) : "Sin registro";
const hour = (d: Date) => new Intl.DateTimeFormat("es-CO", { timeStyle: "short", timeZone: "America/Bogota" }).format(d);

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={s.section}><Text minPresenceAhead={35} style={s.sectionTitle}>{title}</Text>{children}</View>;
}
function Paragraph({ value }: { value: string | null }) {
  return <Text style={value ? s.text : s.muted}>{value || "Sin información registrada."}</Text>;
}

export async function renderDocumentoActa({ d, codigo, logo, institucion, generadoPor }: { d: SesionReunion; codigo: string; logo: string | null; institucion: string; generadoPor: string }) {
  const j = d.jornada;
  const generatedAt = new Date();
  const modalidad = j ? { VIRTUAL: "Virtual", PRESENCIAL: "Presencial", MIXTA: "Mixta" }[j.modality] : "Sin modalidad registrada";
  const participantes = j ? { INTERNAL: "Internos", EXTERNAL: "Externos", BOTH: "Internos y externos" }[j.audience] : "Sin definición registrada";
  const estado = d.estado === "CLOSED" ? "Sesión cerrada" : "Borrador · sesión abierta";
  const header = <View fixed style={s.header}>
    <View style={[s.row, { alignItems: "center", gap: 10 }]}>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de react-pdf */}
      {logo && <Image src={logo} style={{ width: 38, height: 38, objectFit: "contain" }} />}
      <View style={{ flex: 1 }}><Text style={{ fontSize: 10, color: C.blue, fontFamily: "Helvetica-Bold" }}>{institucion}</Text><Text style={s.title}>Acta de reunión</Text></View>
      <View style={{ alignItems: "flex-end" }}><Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10 }}>{codigo}</Text><Text style={[s.muted, { marginTop: 5 }]}>{estado}</Text></View>
    </View>
    <Text style={[s.muted, { marginTop: 6 }]}>Generada: {datetime(generatedAt)} · Contenido registrado en el campus</Text>
  </View>;
  const footer = <View fixed style={s.footer}><Text style={{ flex: 1, paddingRight: 12 }}>{codigo} · Descargada por {generadoPor}</Text><Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} /></View>;
  const datos = [
    ["Reunión", d.reunion.titulo], ["Sesión", d.titulo], ["Fecha", date(j?.startsAt ?? null)],
    ["Horario programado", j ? `${hour(j.startsAt)}${j.endsAt ? ` – ${hour(j.endsAt)}` : ""}` : "Sin horario registrado"],
    ["Modalidad", modalidad], ["Lugar / sala", j?.location || (j?.modality === "VIRTUAL" ? "Sala virtual" : "Sin lugar registrado")],
    ["Responsable", d.responsable || "Sin responsable registrado"], ["Participantes", participantes],
    ["Dirigida a / zonas", d.dirigidoA || "Sin información registrada"],
    ...(d.cerradaEl ? [["Cierre registrado", datetime(d.cerradaEl)]] : []),
  ];
  const widths = ["4%", "25%", "22%", "17%", "17%", "8%", "7%"];
  return renderToBuffer(<Document title={`Acta ${codigo} · ${d.reunion.titulo}`} author={institucion}>
    <Page size="A4" style={s.page}>{header}
      <Section title="01 · Datos de la reunión">
        <View style={{ borderWidth: 1, borderColor: C.line }}>{datos.map(([label, value], i) => <View key={label} wrap={false} style={[s.row, { backgroundColor: i % 2 ? C.pale : "white", borderBottomWidth: 1, borderBottomColor: C.line, padding: 7 }]}><Text style={{ width: "32%", fontFamily: "Helvetica-Bold", fontSize: 9 }}>{label}</Text><Text style={{ width: "68%", fontSize: 9, lineHeight: 1.4 }}>{value}</Text></View>)}</View>
      </Section>
      <Section title="02 · Objetivo"><Paragraph value={d.objetivo} /></Section>
      <Section title="03 · Orden del día">{d.reunion.ordenDelDia.length ? d.reunion.ordenDelDia.map((item, i) => <Text key={i} style={[s.text, { marginBottom: 4 }]}>{i + 1}. {item.replace(/^\d+[.)]\s*/, "")}</Text>) : <Paragraph value={null} />}</Section>
      <Section title="04 · Desarrollo de la sesión"><Paragraph value={d.desarrollo} /></Section>
      <Section title="05 · Compromisos y acuerdos">{d.compromisos.length ? d.compromisos.map((item, i) => <View key={i} style={[s.row, { borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 7 }]}><Text style={{ width: 24, color: C.blue }}>{i + 1}.</Text><Text style={[s.text, { flex: 1 }]}>{item}</Text></View>) : <Paragraph value={null} />}</Section>
      <Section title="06 · Documentos y evidencias">{d.documentos.length ? d.documentos.map((doc, i) => <View key={doc.id} style={{ marginBottom: 7 }}><Text style={s.text}>{i + 1}. {doc.fileName}</Text><Text style={s.muted}>{doc.description || "Sin descripción registrada"} · Cargado: {datetime(doc.createdAt)} · Por: {doc.uploader.fullName}</Text></View>) : <Paragraph value={null} />}</Section>
      <Section title="07 · Resumen de asistencia">
        <Text style={s.text}>Personas con ingreso real a la sala: {d.asistentes.length}. Permanencia promedio: {d.resumen.permanenciaPromedio} minutos. Tiempo total registrado: {d.resumen.minutosTotales.toFixed(1)} minutos.</Text>
        <Text style={[s.muted, { marginTop: 5 }]}>El anexo de asistencia contiene una fila por persona. El registro de invitación por sí solo no acredita presencia. Los tiempos corresponden a las conexiones registradas por la plataforma.</Text>
      </Section>
      <Section title="08 · Revisión y firmas">
        <Text style={s.muted}>Este archivo reúne la información guardada de la sesión. Los espacios de firma se diligencian durante la revisión del acta. El acta firmada se carga y consulta como documento de la sesión.</Text>
        <View wrap={false} style={[s.row, { gap: 30, marginTop: 40 }]}>{[["Responsable de la reunión", d.responsable || "Nombre y cargo"], ["Quien elabora / revisa el acta", "Nombre y cargo"]].map(([label, value]) => <View key={label} style={{ flex: 1, borderTopWidth: 1, borderTopColor: C.ink, paddingTop: 6 }}><Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9 }}>{label}</Text><Text style={[s.muted, { marginTop: 4 }]}>{value}</Text><Text style={s.muted}>Firma</Text></View>)}</View>
      </Section>{footer}
    </Page>
    <Page size="A4" orientation="landscape" style={[s.page, { paddingTop: 176 }]}>{header}
      <View fixed style={{ position: "absolute", top: 112, left: 34, right: 34 }}><Text style={s.sectionTitle}>Anexo 1 · Asistencia de la sesión</Text><Text style={s.muted}>{d.titulo} · {d.asistentes.length} personas con ingreso registrado</Text></View>
      <View fixed style={{ position: "absolute", top: 149, left: 34, right: 34, flexDirection: "row", backgroundColor: C.navy, paddingVertical: 8 }}>{["#", "Nombre completo", "Cargo", "Ingreso", "Salida / estado", "Minutos", "Ingresos"].map((label, i) => <Text key={label} style={{ width: widths[i], color: "white", fontFamily: "Helvetica-Bold", fontSize: 8, paddingHorizontal: 4 }}>{label}</Text>)}</View>
      {d.asistentes.map((a, i) => <View key={a.clave} wrap={false} style={[s.row, { borderBottomWidth: 1, borderBottomColor: C.line, backgroundColor: i % 2 ? C.pale : "white", paddingVertical: 8 }]}>{[String(i + 1), a.nombre, a.cargo, datetime(a.registradoEl), a.salidaEl ? datetime(a.salidaEl) : a.estado, a.minutos.toFixed(1), String(a.conexiones)].map((value, k) => <Text key={k} style={{ width: widths[k], fontSize: 8.5, paddingHorizontal: 4, lineHeight: 1.4 }}>{value}</Text>)}</View>)}
      {!d.asistentes.length && <Text style={s.text}>No hay ingresos registrados a la sala.</Text>}{footer}
    </Page>
  </Document>);
}
