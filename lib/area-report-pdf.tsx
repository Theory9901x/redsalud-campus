import { Document, Page, View, Text, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

/**
 * Informe PDF de UN ÁREA del plan de capacitaciones: sus capacitaciones, la
 * cobertura de contenido, el ciclo presaber/postsaber donde exista y la
 * asistencia nominal registrada.
 *
 * Misma paleta y anatomía que el informe del plan (training-plan-report-pdf):
 * los dos se archivan juntos como evidencias del PIC y deben leerse como
 * documentos de la misma familia, no como dos sistemas.
 */
const COLORS = {
  ink: "#0F2438",
  muted: "#5B7184",
  border: "#E2E8F0",
  primary: "#2BA6DE",
  success: "#3BB54A",
  warning: "#C88A00",
  destructive: "#C4232A",
  track: "#EEF2F6",
};

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, color: COLORS.ink, fontFamily: "Helvetica" },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 10, color: COLORS.muted, marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: 700, marginTop: 18, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingBottom: 4 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginBottom: 6 },
  metaItem: { fontSize: 9.5, color: COLORS.muted },
  metaValue: { color: COLORS.ink, fontWeight: 700 },
  table: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 4 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: COLORS.border },
  trLast: { flexDirection: "row" },
  th: { flex: 1, padding: 6, fontSize: 9, fontWeight: 700, backgroundColor: COLORS.track },
  td: { flex: 1, padding: 6, fontSize: 9 },
  emptyText: { fontSize: 9.5, color: COLORS.muted, fontStyle: "italic" },
  cicloBox: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 4, padding: 10, marginBottom: 8 },
  cicloTitle: { fontSize: 10, fontWeight: 700, marginBottom: 4 },
  cicloComparison: { fontSize: 14, fontWeight: 700, marginTop: 4 },
});

export type AreaReportInput = {
  areaName: string;
  tutorName: string | null;
  planTitle: string;
  generatedBy: string;
  cobertura: { total: number; conContenido: number };
  capacitaciones: {
    title: string;
    programa: string | null;
    programacion: string;
    status: string;
    course: string | null;
    adherencia: number | null;
  }[];
  /** Solo capacitaciones donde el ciclo tiene al menos un momento con datos. */
  ciclos: {
    activityTitle: string;
    presaberPromedio: number | null;
    presaberCantidad: number;
    postsaberPromedio: number | null;
    postsaberCantidad: number;
    diferencia: number | null;
    variacion: number | null;
  }[];
  asistencia: {
    activityTitle: string;
    fullName: string;
    documentNumber: string;
    dateLabel: string;
    source: string;
  }[];
};

function Resumen({ input }: { input: AreaReportInput }) {
  const pct = input.cobertura.total > 0 ? Math.round((input.cobertura.conContenido / input.cobertura.total) * 100) : null;
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaItem}>
        Plan: <Text style={styles.metaValue}>{input.planTitle}</Text>
      </Text>
      <Text style={styles.metaItem}>
        Responsable: <Text style={styles.metaValue}>{input.tutorName ?? "Sin asignar"}</Text>
      </Text>
      <Text style={styles.metaItem}>
        Capacitaciones: <Text style={styles.metaValue}>{input.cobertura.total}</Text>
      </Text>
      <Text style={styles.metaItem}>
        Con contenido montado:{" "}
        <Text style={styles.metaValue}>
          {input.cobertura.conContenido}
          {pct !== null ? ` (${pct}%)` : ""}
        </Text>
      </Text>
    </View>
  );
}

function Capacitaciones({ rows }: { rows: AreaReportInput["capacitaciones"] }) {
  return (
    <View>
      <Text style={styles.sectionTitle}>Capacitaciones del área</Text>
      {rows.length === 0 ? (
        <Text style={styles.emptyText}>Sin capacitaciones registradas.</Text>
      ) : (
        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={[styles.th, { flex: 2.4 }]}>Capacitación</Text>
            <Text style={styles.th}>Programa</Text>
            <Text style={styles.th}>Programación</Text>
            <Text style={styles.th}>Estado</Text>
            <Text style={[styles.th, { flex: 1.4 }]}>Curso</Text>
            <Text style={[styles.th, { flex: 0.8 }]}>Adherencia</Text>
          </View>
          {rows.map((row, i) => (
            <View key={i} style={i === rows.length - 1 ? styles.trLast : styles.tr}>
              <Text style={[styles.td, { flex: 2.4 }]}>{row.title}</Text>
              <Text style={styles.td}>{row.programa ?? "—"}</Text>
              <Text style={styles.td}>{row.programacion}</Text>
              <Text style={styles.td}>{row.status}</Text>
              <Text style={row.course ? [styles.td, { flex: 1.4 }] : [styles.td, { flex: 1.4 }, { color: COLORS.warning }]}>
                {row.course ?? "Sin contenido todavía"}
              </Text>
              <Text style={[styles.td, { flex: 0.8 }]}>{row.adherencia !== null ? `${row.adherencia}%` : "—"}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function Ciclos({ rows }: { rows: AreaReportInput["ciclos"] }) {
  if (rows.length === 0) return null;
  return (
    <View>
      <Text style={styles.sectionTitle}>Ciclo presaber / postsaber</Text>
      {rows.map((c, i) => (
        <View key={i} style={styles.cicloBox} wrap={false}>
          <Text style={styles.cicloTitle}>{c.activityTitle}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaItem}>
              Presaber:{" "}
              <Text style={styles.metaValue}>
                {c.presaberPromedio !== null ? `${c.presaberPromedio}% (${c.presaberCantidad} personas)` : "Sin presentar"}
              </Text>
            </Text>
            <Text style={styles.metaItem}>
              Postsaber:{" "}
              <Text style={styles.metaValue}>
                {c.postsaberPromedio !== null ? `${c.postsaberPromedio}% (${c.postsaberCantidad} personas)` : "Sin presentar"}
              </Text>
            </Text>
          </View>
          {c.diferencia !== null && (
            <Text
              style={[
                styles.cicloComparison,
                { color: c.diferencia > 0 ? COLORS.success : c.diferencia < 0 ? COLORS.destructive : COLORS.muted },
              ]}
            >
              {c.presaberPromedio}% → {c.postsaberPromedio}% · {c.diferencia > 0 ? "+" : ""}
              {c.diferencia} puntos porcentuales
              {c.variacion !== null ? ` (${c.variacion > 0 ? "+" : ""}${c.variacion}%)` : ""}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

function Asistencia({ rows }: { rows: AreaReportInput["asistencia"] }) {
  return (
    <View>
      <Text style={styles.sectionTitle}>Registro de asistencia</Text>
      {rows.length === 0 ? (
        <Text style={styles.emptyText}>Sin asistencias registradas todavía.</Text>
      ) : (
        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={[styles.th, { flex: 1.8 }]}>Capacitación</Text>
            <Text style={[styles.th, { flex: 1.4 }]}>Nombre</Text>
            <Text style={styles.th}>Documento</Text>
            <Text style={styles.th}>Fecha</Text>
            <Text style={[styles.th, { flex: 0.8 }]}>Origen</Text>
          </View>
          {rows.map((row, i) => (
            <View key={i} style={i === rows.length - 1 ? styles.trLast : styles.tr}>
              <Text style={[styles.td, { flex: 1.8 }]}>{row.activityTitle}</Text>
              <Text style={[styles.td, { flex: 1.4 }]}>{row.fullName}</Text>
              <Text style={styles.td}>{row.documentNumber}</Text>
              <Text style={styles.td}>{row.dateLabel}</Text>
              <Text style={[styles.td, { flex: 0.8 }]}>{row.source}</Text>
            </View>
          ))}
        </View>
      )}
      <Text style={{ fontSize: 8, color: COLORS.muted, marginTop: 6 }}>
        Registro electrónico generado por autenticación institucional en la plataforma RedSalud Te Forma.
      </Text>
    </View>
  );
}

function AreaReportDocument({ input }: { input: AreaReportInput }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{input.areaName}</Text>
        <Text style={styles.subtitle}>
          Informe de área · Plan de capacitaciones · generado el {new Date().toLocaleDateString("es-CO")} por{" "}
          {input.generatedBy}
        </Text>

        <Resumen input={input} />
        <Capacitaciones rows={input.capacitaciones} />
        <Ciclos rows={input.ciclos} />
        <Asistencia rows={input.asistencia} />
      </Page>
    </Document>
  );
}

export async function renderAreaReportPdf(input: AreaReportInput): Promise<Buffer> {
  return renderToBuffer(<AreaReportDocument input={input} />);
}
