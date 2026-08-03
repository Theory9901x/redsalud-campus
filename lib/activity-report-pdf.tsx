import { Document, Page, View, Text, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { ActivityReportData } from "@/lib/training-plans";

/**
 * INFORME DE LA JORNADA: el documento con las métricas completas de
 * adherencia que se habilita cuando la capacitación se cierra.
 *
 * La adherencia se lee sobre el total de encuestados: promedio presaber,
 * promedio postsaber, diferencia entre ambos, y cuántos alcanzaron el mínimo
 * en cada momento. Misma paleta y anatomía que los informes de plan y de
 * área: los tres se archivan juntos como evidencias del PIC.
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
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  kpiBox: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 4, padding: 8, width: "23.5%" },
  kpiLabel: { fontSize: 8, color: COLORS.muted, marginBottom: 3 },
  kpiValue: { fontSize: 16, fontWeight: 700 },
  kpiDetail: { fontSize: 8, color: COLORS.muted, marginTop: 2 },
  comparison: { fontSize: 15, fontWeight: 700, marginTop: 10 },
  table: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 4 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: COLORS.border },
  trLast: { flexDirection: "row" },
  th: { flex: 1, padding: 6, fontSize: 9, fontWeight: 700, backgroundColor: COLORS.track },
  td: { flex: 1, padding: 6, fontSize: 9 },
  emptyText: { fontSize: 9.5, color: COLORS.muted, fontStyle: "italic" },
});

function pct(valor: number, sobre: number) {
  return sobre > 0 ? `${Math.round((valor / sobre) * 100)}%` : "—";
}

function Encabezado({ data, generatedBy }: { data: ActivityReportData; generatedBy: string }) {
  return (
    <View>
      <Text style={styles.title}>{data.titulo}</Text>
      <Text style={styles.subtitle}>
        Informe de la jornada · {data.plan} · generado el {new Date().toLocaleDateString("es-CO")} por {generatedBy}
      </Text>
      <View style={styles.metaRow}>
        <Text style={styles.metaItem}>
          Área: <Text style={styles.metaValue}>{data.area ?? "—"}</Text>
        </Text>
        <Text style={styles.metaItem}>
          Responsable: <Text style={styles.metaValue}>{data.responsable ?? "—"}</Text>
        </Text>
        {data.programa && (
          <Text style={styles.metaItem}>
            Programa: <Text style={styles.metaValue}>{data.programa}</Text>
          </Text>
        )}
        {data.dirigidoA && (
          <Text style={styles.metaItem}>
            Dirigido a: <Text style={styles.metaValue}>{data.dirigidoA}</Text>
          </Text>
        )}
        <Text style={styles.metaItem}>
          Jornada cerrada el:{" "}
          <Text style={styles.metaValue}>
            {data.cerradaEl ? data.cerradaEl.toLocaleDateString("es-CO") : "—"}
          </Text>
        </Text>
      </View>
    </View>
  );
}

function Indicadores({ data }: { data: ActivityReportData }) {
  const ind = data.indicadores;
  return (
    <View>
      <Text style={styles.sectionTitle}>Indicadores de adherencia</Text>
      <View style={styles.kpiGrid}>
        <View style={styles.kpiBox}>
          <Text style={styles.kpiLabel}>Asistentes</Text>
          <Text style={styles.kpiValue}>{ind.asistentes}</Text>
          <Text style={styles.kpiDetail}>ingresaron a la jornada</Text>
        </View>
        <View style={styles.kpiBox}>
          <Text style={styles.kpiLabel}>Presaber</Text>
          <Text style={styles.kpiValue}>{ind.promedioPre !== null ? `${ind.promedioPre}%` : "—"}</Text>
          <Text style={styles.kpiDetail}>{ind.evaluadosPre} encuestados</Text>
        </View>
        <View style={styles.kpiBox}>
          <Text style={styles.kpiLabel}>Postsaber</Text>
          <Text style={styles.kpiValue}>{ind.promedioPost !== null ? `${ind.promedioPost}%` : "—"}</Text>
          <Text style={styles.kpiDetail}>{ind.evaluadosPost} encuestados</Text>
        </View>
        <View style={styles.kpiBox}>
          <Text style={styles.kpiLabel}>Completaron el ciclo</Text>
          <Text style={styles.kpiValue}>{ind.completaronCiclo}</Text>
          <Text style={styles.kpiDetail}>presentaron pre y post</Text>
        </View>
        <View style={styles.kpiBox}>
          <Text style={styles.kpiLabel}>Adherentes al llegar</Text>
          <Text style={styles.kpiValue}>{pct(ind.adherentesPre, ind.evaluadosPre)}</Text>
          <Text style={styles.kpiDetail}>
            {ind.adherentesPre} de {ind.evaluadosPre} con mínimo {data.passingScore}% en presaber
          </Text>
        </View>
        <View style={styles.kpiBox}>
          <Text style={styles.kpiLabel}>Adherentes al salir</Text>
          <Text style={styles.kpiValue}>{pct(ind.adherentesPost, ind.evaluadosPost)}</Text>
          <Text style={styles.kpiDetail}>
            {ind.adherentesPost} de {ind.evaluadosPost} con mínimo {data.passingScore}% en postsaber
          </Text>
        </View>
        <View style={styles.kpiBox}>
          <Text style={styles.kpiLabel}>Mejoraron</Text>
          <Text style={styles.kpiValue}>{pct(ind.mejoraron, ind.completaronCiclo)}</Text>
          <Text style={styles.kpiDetail}>
            {ind.mejoraron} de {ind.completaronCiclo} subieron su nota
          </Text>
        </View>
        <View style={styles.kpiBox}>
          <Text style={styles.kpiLabel}>Variación pre-post</Text>
          <Text
            style={[
              styles.kpiValue,
              {
                color:
                  ind.diferencia === null ? COLORS.muted : ind.diferencia > 0 ? COLORS.success : ind.diferencia < 0 ? COLORS.destructive : COLORS.muted,
              },
            ]}
          >
            {ind.diferencia !== null ? `${ind.diferencia > 0 ? "+" : ""}${ind.diferencia} pp` : "—"}
          </Text>
          <Text style={styles.kpiDetail}>
            {ind.variacion !== null ? `${ind.variacion > 0 ? "+" : ""}${ind.variacion}% relativo` : "sin ambos momentos"}
          </Text>
        </View>
      </View>
      {ind.promedioPre !== null && ind.promedioPost !== null && (
        <Text
          style={[
            styles.comparison,
            { color: ind.diferencia! > 0 ? COLORS.success : ind.diferencia! < 0 ? COLORS.destructive : COLORS.muted },
          ]}
        >
          Adherencia: {ind.promedioPre}% a {ind.promedioPost}%
        </Text>
      )}
    </View>
  );
}

function Personas({ data }: { data: ActivityReportData }) {
  return (
    <View>
      <Text style={styles.sectionTitle}>Resultados por persona (mejor intento de cada momento)</Text>
      {data.personas.length === 0 ? (
        <Text style={styles.emptyText}>Nadie presentó la evaluación.</Text>
      ) : (
        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={[styles.th, { flex: 2 }]}>Nombre</Text>
            <Text style={styles.th}>Documento</Text>
            <Text style={[styles.th, { flex: 0.8 }]}>Presaber</Text>
            <Text style={[styles.th, { flex: 0.8 }]}>Postsaber</Text>
            <Text style={[styles.th, { flex: 0.8 }]}>Diferencia</Text>
          </View>
          {data.personas.map((p, i) => (
            <View key={i} style={i === data.personas.length - 1 ? styles.trLast : styles.tr}>
              <Text style={[styles.td, { flex: 2 }]}>{p.fullName}</Text>
              <Text style={styles.td}>{p.documentNumber}</Text>
              <Text style={[styles.td, { flex: 0.8 }]}>{p.presaber !== null ? `${p.presaber}%` : "—"}</Text>
              <Text style={[styles.td, { flex: 0.8 }]}>{p.postsaber !== null ? `${p.postsaber}%` : "—"}</Text>
              <Text
                style={[
                  styles.td,
                  { flex: 0.8 },
                  p.diferencia !== null
                    ? { color: p.diferencia > 0 ? COLORS.success : p.diferencia < 0 ? COLORS.destructive : COLORS.muted }
                    : {},
                ]}
              >
                {p.diferencia !== null ? `${p.diferencia > 0 ? "+" : ""}${p.diferencia} pp` : "—"}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function PorPregunta({ data }: { data: ActivityReportData }) {
  if (data.porPregunta.length === 0) return null;
  return (
    <View>
      <Text style={styles.sectionTitle}>Acierto por pregunta</Text>
      <View style={styles.table}>
        <View style={styles.tr}>
          <Text style={[styles.th, { flex: 3 }]}>Pregunta</Text>
          <Text style={[styles.th, { flex: 0.8 }]}>Presaber</Text>
          <Text style={[styles.th, { flex: 0.8 }]}>Postsaber</Text>
        </View>
        {data.porPregunta.map((q, i) => (
          <View key={i} style={i === data.porPregunta.length - 1 ? styles.trLast : styles.tr}>
            <Text style={[styles.td, { flex: 3 }]}>{q.statement}</Text>
            <Text style={[styles.td, { flex: 0.8 }]}>{q.presaber !== null ? `${q.presaber}%` : "—"}</Text>
            <Text style={[styles.td, { flex: 0.8 }]}>{q.postsaber !== null ? `${q.postsaber}%` : "—"}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Asistencia({ data }: { data: ActivityReportData }) {
  return (
    <View>
      <Text style={styles.sectionTitle}>Lista de asistencia</Text>
      {data.asistencia.length === 0 ? (
        <Text style={styles.emptyText}>Sin asistencias registradas.</Text>
      ) : (
        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={[styles.th, { flex: 2 }]}>Nombre</Text>
            <Text style={styles.th}>Documento</Text>
            <Text style={styles.th}>Fecha</Text>
            <Text style={[styles.th, { flex: 0.8 }]}>Origen</Text>
          </View>
          {data.asistencia.map((a, i) => (
            <View key={i} style={i === data.asistencia.length - 1 ? styles.trLast : styles.tr}>
              <Text style={[styles.td, { flex: 2 }]}>{a.fullName}</Text>
              <Text style={styles.td}>{a.documentNumber}</Text>
              <Text style={styles.td}>{a.fecha.toLocaleDateString("es-CO")}</Text>
              <Text style={[styles.td, { flex: 0.8 }]}>{a.source === "AUTOMATIC" ? "Automático" : "Manual"}</Text>
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

function Encuestas({ data }: { data: ActivityReportData }) {
  if (data.encuestas.length === 0) return null;
  return (
    <View>
      <Text style={styles.sectionTitle}>Encuestas de la jornada</Text>
      <View style={styles.metaRow}>
        {data.encuestas.map((e, i) => (
          <Text key={i} style={styles.metaItem}>
            {e.titulo}: <Text style={styles.metaValue}>{e.respuestas} respuestas</Text>
          </Text>
        ))}
      </View>
    </View>
  );
}

function ActivityReportDocument({ data, generatedBy }: { data: ActivityReportData; generatedBy: string }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Encabezado data={data} generatedBy={generatedBy} />
        <Indicadores data={data} />
        <Personas data={data} />
        <PorPregunta data={data} />
        <Asistencia data={data} />
        <Encuestas data={data} />
      </Page>
    </Document>
  );
}

export async function renderActivityReportPdf(data: ActivityReportData, generatedBy: string): Promise<Buffer> {
  return renderToBuffer(<ActivityReportDocument data={data} generatedBy={generatedBy} />);
}
