import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  Svg,
  Rect,
  Polyline,
  Circle,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { ResultadosEncuesta, ResultadoPregunta } from "@/lib/encuestas/consultas";
import { ETIQUETA_TIPO } from "@/lib/encuestas/tipos";
import type { SurveyQuestionType } from "@prisma/client";

/**
 * INFORME PDF DE UNA ENCUESTA: participación, cumplimiento, evolución
 * diaria y la tabulación completa pregunta por pregunta, con gráficas.
 *
 * Las gráficas se dibujan con las primitivas SVG de @react-pdf: nada de
 * capturar pantallas ni rasterizar; el documento pesa poco y se imprime
 * nítido. Misma paleta y anatomía que el informe de jornada: los dos se
 * archivan juntos como evidencias del PIC.
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

const AUDIENCIA: Record<string, string> = {
  INTERNO: "Personal interno",
  EXTERNO: "Público externo",
  MIXTA: "Interna y externa",
};

/**
 * Helvetica (WinAnsi) no tiene ✓ ni →: si llegan al PDF salen como
 * comilla o desaparecen. Se sustituyen por equivalentes imprimibles.
 */
function textoImprimible(t: string) {
  return t.replace(/→/g, "›").replace(/[✓✔]/g, "»");
}

const ESTADO: Record<string, string> = {
  DRAFT: "Borrador",
  PUBLISHED: "Publicada",
  CLOSED: "Cerrada",
  ARCHIVED: "Archivada",
};

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, color: COLORS.ink, fontFamily: "Helvetica" },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 10, color: COLORS.muted, marginBottom: 14 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    marginTop: 18,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 4,
  },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginBottom: 4 },
  metaItem: { fontSize: 9.5, color: COLORS.muted },
  metaValue: { color: COLORS.ink, fontWeight: 700 },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  kpiBox: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 4, padding: 8, width: "23.5%" },
  kpiLabel: { fontSize: 8, color: COLORS.muted, marginBottom: 3 },
  kpiValue: { fontSize: 16, fontWeight: 700 },
  kpiDetail: { fontSize: 8, color: COLORS.muted, marginTop: 2 },
  preguntaBox: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    padding: 10,
    marginBottom: 8,
  },
  preguntaTipo: { fontSize: 7.5, color: COLORS.muted, textTransform: "uppercase", marginBottom: 2 },
  preguntaTexto: { fontSize: 10.5, fontWeight: 700, marginBottom: 6 },
  barraFila: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 },
  barraEtiqueta: { width: 150, fontSize: 8.5 },
  barraConteo: { width: 64, fontSize: 8.5, color: COLORS.muted, textAlign: "right" },
  textoAbierto: { fontSize: 8.5, color: COLORS.muted, marginBottom: 2 },
  emptyText: { fontSize: 9.5, color: COLORS.muted, fontStyle: "italic" },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 36,
    right: 36,
    fontSize: 8,
    color: COLORS.muted,
    textAlign: "center",
  },
});

function colorSemaforo(porcentaje: number) {
  return porcentaje >= 85 ? COLORS.success : porcentaje >= 70 ? COLORS.warning : COLORS.destructive;
}

/** Barra horizontal proporcional, dibujada con un Svg de una fila. */
function Barra({ fraccion, color }: { fraccion: number; color: string }) {
  const ancho = 240;
  const alto = 9;
  const relleno = Math.max(0, Math.min(1, fraccion)) * ancho;
  return (
    <Svg width={ancho} height={alto}>
      <Rect x={0} y={0} width={ancho} height={alto} rx={2} fill={COLORS.track} />
      {relleno > 0 && <Rect x={0} y={0} width={relleno} height={alto} rx={2} fill={color} />}
    </Svg>
  );
}

/** Evolución diaria de respuestas: línea con puntos sobre columnas guía. */
function GraficaEvolucionPdf({ evolucion }: { evolucion: { fecha: string; conteo: number }[] }) {
  const ancho = 520;
  const alto = 110;
  const margen = { arriba: 8, abajo: 22, izq: 8, der: 8 };
  const puntos = evolucion.slice(-30); // últimas 30 fechas: en A4 más no se lee
  if (puntos.length === 0) return <Text style={styles.emptyText}>Sin respuestas registradas todavía.</Text>;

  const max = Math.max(...puntos.map((p) => p.conteo), 1);
  const anchoUtil = ancho - margen.izq - margen.der;
  const altoUtil = alto - margen.arriba - margen.abajo;
  const paso = puntos.length > 1 ? anchoUtil / (puntos.length - 1) : 0;

  const coords = puntos.map((p, i) => ({
    x: margen.izq + (puntos.length > 1 ? i * paso : anchoUtil / 2),
    y: margen.arriba + altoUtil - (p.conteo / max) * altoUtil,
    ...p,
  }));

  // Etiquetas de fecha: primera, última y algunas intermedias.
  const cadaCuantas = Math.max(1, Math.ceil(puntos.length / 6));

  return (
    <Svg width={ancho} height={alto}>
      <Rect x={margen.izq} y={margen.arriba + altoUtil} width={anchoUtil} height={0.7} fill={COLORS.border} />
      {coords.map((c, i) => (
        <Rect key={`g-${i}`} x={c.x - 0.35} y={margen.arriba} width={0.7} height={altoUtil} fill={COLORS.track} />
      ))}
      {coords.length > 1 && (
        <Polyline
          points={coords.map((c) => `${c.x},${c.y}`).join(" ")}
          fill="none"
          stroke={COLORS.primary}
          strokeWidth={1.6}
        />
      )}
      {coords.map((c, i) => (
        <Circle key={`p-${i}`} cx={c.x} cy={c.y} r={2.2} fill={COLORS.primary} />
      ))}
      {coords.map((c, i) =>
        i % cadaCuantas === 0 || i === coords.length - 1 ? (
          <Text
            key={`t-${i}`}
            x={c.x}
            y={alto - 10}
            style={{ fontSize: 6.5, fill: COLORS.muted, textAnchor: "middle" } as never}
          >
            {c.fecha.slice(5)}
          </Text>
        ) : null
      )}
      {coords.map((c, i) => (
        <Text
          key={`v-${i}`}
          x={c.x}
          y={c.y - 5}
          style={{ fontSize: 6.5, fill: COLORS.ink, textAnchor: "middle" } as never}
        >
          {String(c.conteo)}
        </Text>
      ))}
    </Svg>
  );
}

function BloquePregunta({ pregunta, totalRespuestas }: { pregunta: ResultadoPregunta; totalRespuestas: number }) {
  const etiquetaTipo = ETIQUETA_TIPO[pregunta.type as SurveyQuestionType] ?? pregunta.type;

  return (
    <View style={styles.preguntaBox} wrap={false}>
      <Text style={styles.preguntaTipo}>
        {etiquetaTipo} · {pregunta.respuestas} de {totalRespuestas} respondieron
        {pregunta.aciertos !== null && pregunta.aciertos !== undefined ? ` · ${pregunta.aciertos}% de acierto` : ""}
        {pregunta.promedio !== null && pregunta.promedio !== undefined ? ` · promedio ${pregunta.promedio}` : ""}
      </Text>
      <Text style={styles.preguntaTexto}>{pregunta.prompt}</Text>

      {pregunta.opciones && pregunta.opciones.length > 0 ? (
        pregunta.opciones.map((o) => (
          <View key={o.id} style={styles.barraFila}>
            <Text style={styles.barraEtiqueta}>
              {textoImprimible(o.texto)}
              {o.esCorrecta ? "  (correcta)" : ""}
            </Text>
            <Barra
              fraccion={pregunta.respuestas > 0 ? o.conteo / pregunta.respuestas : 0}
              color={o.esCorrecta ? COLORS.success : COLORS.primary}
            />
            <Text style={styles.barraConteo}>
              {o.conteo} ({pregunta.respuestas > 0 ? Math.round((o.conteo / pregunta.respuestas) * 100) : 0}%)
            </Text>
          </View>
        ))
      ) : pregunta.distribucion && pregunta.distribucion.length > 0 ? (
        pregunta.distribucion.map((d) => (
          <View key={d.valor} style={styles.barraFila}>
            <Text style={styles.barraEtiqueta}>{d.valor}</Text>
            <Barra fraccion={pregunta.respuestas > 0 ? d.conteo / pregunta.respuestas : 0} color={COLORS.primary} />
            <Text style={styles.barraConteo}>
              {d.conteo} ({pregunta.respuestas > 0 ? Math.round((d.conteo / pregunta.respuestas) * 100) : 0}%)
            </Text>
          </View>
        ))
      ) : pregunta.textos && pregunta.textos.length > 0 ? (
        <View>
          {pregunta.textos.slice(0, 12).map((t, i) => (
            <Text key={i} style={styles.textoAbierto}>
              · {textoImprimible(t.length > 180 ? `${t.slice(0, 180)}…` : t)}
            </Text>
          ))}
          {pregunta.textos.length > 12 && (
            <Text style={styles.emptyText}>… y {pregunta.textos.length - 12} respuestas más (ver CSV).</Text>
          )}
        </View>
      ) : (
        <Text style={styles.emptyText}>Sin respuestas para esta pregunta.</Text>
      )}
    </View>
  );
}

function InformeEncuestaDocument({ datos, generatedBy }: { datos: ResultadosEncuesta; generatedBy: string }) {
  const { encuesta, totales, minutosPromedio, puntaje, cumplimiento, evolucion, porPregunta } = datos;
  const totalPreguntas = encuesta.pages.reduce((s, p) => s + p.questions.length, 0);
  const semaforo =
    cumplimiento.porcentaje >= 85 ? "Cumple" : cumplimiento.porcentaje >= 70 ? "Aceptable" : "Crítico";

  return (
    <Document
      title={`Informe ${encuesta.code} — ${encuesta.title}`}
      author="RedSalud Te Forma"
      subject="Informe de resultados de encuesta"
    >
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{encuesta.title}</Text>
        <Text style={styles.subtitle}>
          Informe de resultados · {encuesta.code} · generado el {new Date().toLocaleDateString("es-CO")} por{" "}
          {generatedBy}
        </Text>

        <View style={styles.metaRow}>
          <Text style={styles.metaItem}>
            Estado: <Text style={styles.metaValue}>{ESTADO[encuesta.status] ?? encuesta.status}</Text>
          </Text>
          <Text style={styles.metaItem}>
            Audiencia: <Text style={styles.metaValue}>{AUDIENCIA[encuesta.audience] ?? encuesta.audience}</Text>
          </Text>
          <Text style={styles.metaItem}>
            Preguntas: <Text style={styles.metaValue}>{totalPreguntas}</Text> en {encuesta.pages.length}{" "}
            {encuesta.pages.length === 1 ? "bloque" : "bloques"}
          </Text>
          {encuesta.trainingActivity && (
            <Text style={styles.metaItem}>
              Capacitación: <Text style={styles.metaValue}>{encuesta.trainingActivity.title}</Text>
            </Text>
          )}
          {encuesta.trainingPlan && (
            <Text style={styles.metaItem}>
              Plan: <Text style={styles.metaValue}>{encuesta.trainingPlan.title}</Text>
            </Text>
          )}
          {encuesta.opensAt && (
            <Text style={styles.metaItem}>
              Abre: <Text style={styles.metaValue}>{encuesta.opensAt.toLocaleDateString("es-CO")}</Text>
            </Text>
          )}
          {encuesta.closesAt && (
            <Text style={styles.metaItem}>
              Cierra: <Text style={styles.metaValue}>{encuesta.closesAt.toLocaleDateString("es-CO")}</Text>
            </Text>
          )}
        </View>
        {encuesta.description ? (
          <Text style={{ fontSize: 9, color: COLORS.muted, marginTop: 2 }}>{encuesta.description}</Text>
        ) : null}

        <Text style={styles.sectionTitle}>Participación y cumplimiento</Text>
        <View style={styles.kpiGrid}>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Respuestas totales</Text>
            <Text style={styles.kpiValue}>{totales.respuestas}</Text>
            <Text style={styles.kpiDetail}>{totales.parciales} quedaron a medias</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Completadas</Text>
            <Text style={styles.kpiValue}>{totales.completadas}</Text>
            <Text style={styles.kpiDetail}>
              {minutosPromedio !== null ? `${minutosPromedio} min promedio` : "sin tiempo medido"}
            </Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Tasa de finalización</Text>
            <Text style={styles.kpiValue}>{totales.tasaFinalizacion}%</Text>
            <Text style={styles.kpiDetail}>de quienes la abrieron</Text>
          </View>
          <View style={[styles.kpiBox, { borderColor: colorSemaforo(cumplimiento.porcentaje) }]}>
            <Text style={styles.kpiLabel}>
              {cumplimiento.base === "puntaje" ? "Puntaje global" : "Cumplimiento"}
            </Text>
            <Text style={[styles.kpiValue, { color: colorSemaforo(cumplimiento.porcentaje) }]}>
              {cumplimiento.porcentaje}%
            </Text>
            <Text style={styles.kpiDetail}>
              {semaforo} · {cumplimiento.base === "puntaje" ? "según clave de respuestas" : "según finalización"}
            </Text>
          </View>
        </View>

        {puntaje && puntaje.porBloque.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Puntaje por bloque</Text>
            {puntaje.porBloque.map((b) => (
              <View key={b.pageId} style={styles.barraFila}>
                <Text style={styles.barraEtiqueta}>{b.titulo}</Text>
                <Barra fraccion={b.porcentaje / 100} color={colorSemaforo(b.porcentaje)} />
                <Text style={styles.barraConteo}>{b.porcentaje}%</Text>
              </View>
            ))}
            <Text style={styles.kpiDetail}>
              Calculado sobre {puntaje.respuestasCalificadas}{" "}
              {puntaje.respuestasCalificadas === 1 ? "respuesta calificada" : "respuestas calificadas"} (suma de
              puntos, no promedio de promedios).
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Evolución diaria de respuestas</Text>
        <GraficaEvolucionPdf evolucion={evolucion} />

        <Text style={styles.sectionTitle}>Resultados por pregunta</Text>
        {porPregunta.length === 0 ? (
          <Text style={styles.emptyText}>La encuesta no tiene preguntas todavía.</Text>
        ) : (
          porPregunta.map((p) => <BloquePregunta key={p.id} pregunta={p} totalRespuestas={totales.respuestas} />)
        )}

        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) =>
            `RedSalud Te Forma · Red Salud Casanare E.S.E. · ${encuesta.code} · página ${pageNumber} de ${totalPages}`
          }
        />
      </Page>
    </Document>
  );
}

export async function renderInformeEncuestaPdf(datos: ResultadosEncuesta, generatedBy: string) {
  return renderToBuffer(<InformeEncuestaDocument datos={datos} generatedBy={generatedBy} />);
}
