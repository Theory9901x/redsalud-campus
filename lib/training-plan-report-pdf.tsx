import { Document, Page, View, Text, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

const COLORS = {
  ink: "#0F2438",
  muted: "#5B7184",
  border: "#E2E8F0",
  primary: "#2BA6DE",
  success: "#3BB54A",
  track: "#EEF2F6",
  navy: "#0F2438",
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
  barRow: { marginBottom: 8 },
  barLabel: { fontSize: 9.5, marginBottom: 3 },
  barTrack: { height: 10, backgroundColor: COLORS.track, borderRadius: 5, flexDirection: "row" },
  barFill: { height: 10, backgroundColor: COLORS.primary, borderRadius: 5 },
  statusBarTrack: { height: 14, backgroundColor: COLORS.track, borderRadius: 7, flexDirection: "row", overflow: "hidden" },
  statusLegend: { flexDirection: "row", gap: 16, marginTop: 8 },
  statusLegendItem: { flexDirection: "row", alignItems: "center", gap: 4, fontSize: 9 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  emptyText: { fontSize: 9.5, color: COLORS.muted, fontStyle: "italic" },
});

export type TrainingPlanReportSections = {
  cronograma?: {
    title: string;
    type: string;
    course: string | null;
    dateLabel: string;
    audience: string;
    percentage: number | null;
    status: string;
  }[];
  documentos?: { fileName: string; fileType: string; dateLabel: string; uploader: string }[];
  encuestas?: { title: string; scope: string; responded: number; target: number; rate: number }[];
  noAdherentes?: { activityTitle: string; fullName: string; documentNumber: string }[];
};

export type TrainingPlanReportInput = {
  plan: { title: string; year: number; targetDepartment: string | null; tutorName: string; status: string };
  overallPercentage: number | null;
  surveyResponseRate: number | null;
  statusCounts: { label: string; count: number; color: string }[];
  sections: TrainingPlanReportSections;
};

function ResumenSection({ input }: { input: TrainingPlanReportInput }) {
  const total = input.statusCounts.reduce((sum, s) => sum + s.count, 0);
  return (
    <View>
      <View style={styles.metaRow}>
        <Text style={styles.metaItem}>
          Año: <Text style={styles.metaValue}>{input.plan.year}</Text>
        </Text>
        <Text style={styles.metaItem}>
          Dependencia: <Text style={styles.metaValue}>{input.plan.targetDepartment ?? "Todo el personal"}</Text>
        </Text>
        <Text style={styles.metaItem}>
          Tutor: <Text style={styles.metaValue}>{input.plan.tutorName}</Text>
        </Text>
        <Text style={styles.metaItem}>
          Estado: <Text style={styles.metaValue}>{input.plan.status}</Text>
        </Text>
        <Text style={styles.metaItem}>
          Cumplimiento global: <Text style={styles.metaValue}>{input.overallPercentage !== null ? `${input.overallPercentage}%` : "Sin datos"}</Text>
        </Text>
        <Text style={styles.metaItem}>
          Tasa de respuesta a encuestas:{" "}
          <Text style={styles.metaValue}>{input.surveyResponseRate !== null ? `${input.surveyResponseRate}%` : "Sin datos"}</Text>
        </Text>
      </View>

      {total > 0 && (
        <View style={{ marginTop: 8 }}>
          <Text style={[styles.barLabel, { fontWeight: 700 }]}>Actividades por estado</Text>
          <View style={styles.statusBarTrack}>
            {input.statusCounts
              .filter((s) => s.count > 0)
              .map((s) => (
                <View key={s.label} style={{ width: `${(s.count / total) * 100}%`, backgroundColor: s.color }} />
              ))}
          </View>
          <View style={styles.statusLegend}>
            {input.statusCounts.map((s) => (
              <View key={s.label} style={styles.statusLegendItem}>
                <View style={[styles.statusDot, { backgroundColor: s.color }]} />
                <Text>
                  {s.label}: {s.count}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function CronogramaSection({ rows }: { rows: NonNullable<TrainingPlanReportSections["cronograma"]> }) {
  return (
    <View>
      <Text style={styles.sectionTitle}>Cronograma y adherencia por actividad</Text>
      {rows.length === 0 ? (
        <Text style={styles.emptyText}>Sin actividades todavía.</Text>
      ) : (
        <View>
          {rows.map((row, i) => (
            <View key={i} style={styles.barRow}>
              <Text style={styles.barLabel}>
                {row.title} · {row.dateLabel} · {row.audience} · {row.status}
                {row.course ? ` · Curso: ${row.course}` : ""}
              </Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${row.percentage ?? 0}%` }]} />
              </View>
              <Text style={{ fontSize: 8.5, color: COLORS.muted, marginTop: 2 }}>
                {row.percentage !== null ? `${row.percentage}% de adherencia` : "Sin audiencia objetivo"}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function DocumentosSection({ rows }: { rows: NonNullable<TrainingPlanReportSections["documentos"]> }) {
  return (
    <View>
      <Text style={styles.sectionTitle}>Documentos asociados</Text>
      {rows.length === 0 ? (
        <Text style={styles.emptyText}>Sin documentos todavía.</Text>
      ) : (
        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={styles.th}>Nombre</Text>
            <Text style={styles.th}>Tipo</Text>
            <Text style={styles.th}>Fecha</Text>
            <Text style={styles.th}>Subido por</Text>
          </View>
          {rows.map((row, i) => (
            <View key={i} style={i === rows.length - 1 ? styles.trLast : styles.tr}>
              <Text style={styles.td}>{row.fileName}</Text>
              <Text style={styles.td}>{row.fileType}</Text>
              <Text style={styles.td}>{row.dateLabel}</Text>
              <Text style={styles.td}>{row.uploader}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function EncuestasSection({ rows }: { rows: NonNullable<TrainingPlanReportSections["encuestas"]> }) {
  return (
    <View>
      <Text style={styles.sectionTitle}>Encuestas</Text>
      {rows.length === 0 ? (
        <Text style={styles.emptyText}>Sin encuestas todavía.</Text>
      ) : (
        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={styles.th}>Encuesta</Text>
            <Text style={styles.th}>Alcance</Text>
            <Text style={styles.th}>Respondieron</Text>
            <Text style={styles.th}>Tasa</Text>
          </View>
          {rows.map((row, i) => (
            <View key={i} style={i === rows.length - 1 ? styles.trLast : styles.tr}>
              <Text style={styles.td}>{row.title}</Text>
              <Text style={styles.td}>{row.scope}</Text>
              <Text style={styles.td}>
                {row.responded} de {row.target}
              </Text>
              <Text style={styles.td}>{row.rate}%</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function NoAdherentesSection({ rows }: { rows: NonNullable<TrainingPlanReportSections["noAdherentes"]> }) {
  return (
    <View>
      <Text style={styles.sectionTitle}>Personal no adherente (jornadas cerradas) · seguimiento de RRHH</Text>
      {rows.length === 0 ? (
        <Text style={styles.emptyText}>Sin no-adherentes registrados en jornadas cerradas.</Text>
      ) : (
        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={styles.th}>Actividad</Text>
            <Text style={styles.th}>Nombre</Text>
            <Text style={styles.th}>Documento</Text>
          </View>
          {rows.map((row, i) => (
            <View key={i} style={i === rows.length - 1 ? styles.trLast : styles.tr}>
              <Text style={styles.td}>{row.activityTitle}</Text>
              <Text style={styles.td}>{row.fullName}</Text>
              <Text style={styles.td}>{row.documentNumber}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function TrainingPlanReportDocument({ input }: { input: TrainingPlanReportInput }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{input.plan.title}</Text>
        <Text style={styles.subtitle}>Informe de plan de capacitación · generado el {new Date().toLocaleDateString("es-CO")}</Text>

        <ResumenSection input={input} />
        {input.sections.cronograma && <CronogramaSection rows={input.sections.cronograma} />}
        {input.sections.documentos && <DocumentosSection rows={input.sections.documentos} />}
        {input.sections.encuestas && <EncuestasSection rows={input.sections.encuestas} />}
        {input.sections.noAdherentes && <NoAdherentesSection rows={input.sections.noAdherentes} />}
      </Page>
    </Document>
  );
}

export async function renderTrainingPlanReportPdf(input: TrainingPlanReportInput): Promise<Buffer> {
  return renderToBuffer(<TrainingPlanReportDocument input={input} />);
}
