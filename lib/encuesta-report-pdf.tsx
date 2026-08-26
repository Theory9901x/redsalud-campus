import { readFile } from "node:fs/promises";
import { Document, Page, View, Text, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { publicUploadDiskPath } from "@/lib/storage";
import type { ResultadosEncuesta, ResultadoPregunta } from "@/lib/encuestas/consultas";
import { ETIQUETA_TIPO } from "@/lib/encuestas/tipos";
import type { SurveyQuestionType } from "@prisma/client";

/**
 * INFORME PDF DE UNA ENCUESTA: portada institucional con logo, datos
 * generales, KPIs, evolución diaria y la tabulación completa por pregunta.
 *
 * Misma anatomía y paleta que el informe del centro de datos
 * (lib/reporte-pdf.tsx): banda navy de portada, KPIs sobre fondo suave y
 * barras dibujadas con Views de ancho porcentual. Los dos se archivan
 * juntos como evidencias del PIC y deben leerse como una familia.
 */

const COLORES = {
  navy: "#1B2A3D",
  primario: "#2BA3D4",
  exito: "#16A44E",
  alerta: "#E8B23A",
  peligro: "#D6483B",
  texto: "#2B3A4A",
  suave: "#6B7C8F",
  linea: "#DCE3EA",
  fondo: "#F4F7FA",
};

const AUDIENCIA: Record<string, string> = {
  INTERNO: "Personal interno",
  EXTERNO: "Público externo",
  MIXTA: "Interna y externa",
};

const ESTADO: Record<string, string> = {
  DRAFT: "Borrador",
  PUBLISHED: "Publicada",
  CLOSED: "Cerrada",
  ARCHIVED: "Archivada",
};

const styles = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 48, paddingHorizontal: 36, fontSize: 9, color: COLORES.texto },
  portadaBanda: { backgroundColor: COLORES.navy, padding: 20, borderRadius: 8, marginBottom: 14 },
  titulo: { fontSize: 17, color: "#FFFFFF", fontWeight: "bold" },
  subtitulo: { fontSize: 9.5, color: "#C9D6E2", marginTop: 4 },
  chipCodigo: {
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    color: COLORES.navy,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 8,
    fontWeight: "bold",
    marginBottom: 6,
  },
  seccion: { marginTop: 14 },
  seccionTitulo: { fontSize: 12, fontWeight: "bold", color: COLORES.navy, marginBottom: 6 },
  datosCaja: { backgroundColor: COLORES.fondo, borderRadius: 6, padding: 10 },
  datosGrilla: { flexDirection: "row", flexWrap: "wrap" },
  datoItem: { width: "33.33%", paddingVertical: 3, paddingRight: 8 },
  datoEtiqueta: { fontSize: 7, color: COLORES.suave, textTransform: "uppercase" },
  datoValor: { fontSize: 9, fontWeight: "bold", color: COLORES.texto, marginTop: 1.5 },
  filaKpis: { flexDirection: "row", gap: 8 },
  kpi: { flex: 1, backgroundColor: COLORES.fondo, borderRadius: 6, padding: 9 },
  kpiValor: { fontSize: 16, fontWeight: "bold", color: COLORES.navy },
  kpiEtiqueta: { fontSize: 7, color: COLORES.suave, marginTop: 2 },
  kpiDetalle: { fontSize: 6.5, color: COLORES.suave, marginTop: 1.5 },
  barraFila: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  barraEtiqueta: { width: 165, fontSize: 8, color: COLORES.texto, paddingRight: 6 },
  barraPista: { flex: 1, height: 9, backgroundColor: COLORES.fondo, borderRadius: 4 },
  barraValor: { height: 9, borderRadius: 4 },
  barraCifra: { width: 64, fontSize: 7.5, color: COLORES.suave, textAlign: "right" },
  preguntaCaja: {
    borderLeftWidth: 3,
    borderLeftColor: COLORES.primario,
    backgroundColor: COLORES.fondo,
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
  },
  preguntaTipo: { fontSize: 7, color: COLORES.suave, textTransform: "uppercase", marginBottom: 2 },
  preguntaTexto: { fontSize: 10, fontWeight: "bold", color: COLORES.navy, marginBottom: 6 },
  textoAbierto: { fontSize: 8, color: COLORES.texto, marginBottom: 2.5, paddingLeft: 6 },
  notaSuave: { fontSize: 7.5, color: COLORES.suave, marginTop: 3 },
  vacio: { fontSize: 8, color: COLORES.suave },
  pie: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: COLORES.suave,
    borderTopWidth: 0.5,
    borderTopColor: COLORES.linea,
    paddingTop: 6,
  },
});

function colorSemaforo(porcentaje: number) {
  return porcentaje >= 85 ? COLORES.exito : porcentaje >= 70 ? COLORES.alerta : COLORES.peligro;
}

/**
 * Helvetica (WinAnsi) no tiene ✓ ni →: si llegan al PDF salen como
 * comilla o desaparecen. Se sustituyen por equivalentes imprimibles.
 */
function textoImprimible(t: string) {
  return t.replace(/→/g, "›").replace(/[✓✔]/g, "»");
}

/** Barra horizontal etiqueta + pista + cifra, la misma del centro de datos. */
function BarraFila({
  etiqueta,
  fraccion,
  cifra,
  color,
}: {
  etiqueta: string;
  fraccion: number;
  cifra: string;
  color: string;
}) {
  const pct = Math.max(0, Math.min(1, fraccion)) * 100;
  return (
    <View style={styles.barraFila} wrap={false}>
      <Text style={styles.barraEtiqueta}>{etiqueta}</Text>
      <View style={styles.barraPista}>
        <View style={[styles.barraValor, { width: `${Math.max(pct, 1.5)}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.barraCifra}>{cifra}</Text>
    </View>
  );
}

/**
 * Evolución diaria como columnas con su cifra encima: con pocas fechas
 * (lo normal en una encuesta de jornada) se lee mejor que una línea.
 */
function EvolucionColumnas({ evolucion }: { evolucion: { fecha: string; conteo: number }[] }) {
  const puntos = evolucion.slice(-21); // tres semanas: más no cabe legible
  if (puntos.length === 0) return <Text style={styles.vacio}>Sin respuestas registradas todavía.</Text>;
  const max = Math.max(...puntos.map((p) => p.conteo), 1);
  const ALTO = 72;

  return (
    <View style={[styles.datosCaja, { paddingTop: 12 }]}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, height: ALTO + 14 }}>
        {puntos.map((p) => (
          <View key={p.fecha} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end" }}>
            <Text style={{ fontSize: 7, fontWeight: "bold", color: COLORES.navy, marginBottom: 2 }}>
              {p.conteo}
            </Text>
            <View
              style={{
                width: "70%",
                maxWidth: 26,
                height: Math.max((p.conteo / max) * ALTO, 3),
                backgroundColor: COLORES.primario,
                borderTopLeftRadius: 3,
                borderTopRightRadius: 3,
              }}
            />
          </View>
        ))}
      </View>
      <View style={{ borderTopWidth: 0.7, borderTopColor: COLORES.linea, flexDirection: "row", gap: 6, paddingTop: 3 }}>
        {puntos.map((p) => (
          <Text key={p.fecha} style={{ flex: 1, fontSize: 6.5, color: COLORES.suave, textAlign: "center" }}>
            {p.fecha.slice(5)}
          </Text>
        ))}
      </View>
    </View>
  );
}

function BloquePregunta({
  pregunta,
  indice,
  totalRespuestas,
}: {
  pregunta: ResultadoPregunta;
  indice: number;
  totalRespuestas: number;
}) {
  const etiquetaTipo = ETIQUETA_TIPO[pregunta.type as SurveyQuestionType] ?? pregunta.type;
  const acento =
    pregunta.aciertos !== null && pregunta.aciertos !== undefined
      ? colorSemaforo(pregunta.aciertos)
      : COLORES.primario;

  return (
    <View style={[styles.preguntaCaja, { borderLeftColor: acento }]} wrap={false}>
      <Text style={styles.preguntaTipo}>
        Pregunta {indice} · {etiquetaTipo} · {pregunta.respuestas} de {totalRespuestas} respondieron
        {pregunta.aciertos !== null && pregunta.aciertos !== undefined ? ` · ${pregunta.aciertos}% de acierto` : ""}
        {pregunta.promedio !== null && pregunta.promedio !== undefined ? ` · promedio ${pregunta.promedio}` : ""}
      </Text>
      <Text style={styles.preguntaTexto}>{textoImprimible(pregunta.prompt)}</Text>

      {pregunta.opciones && pregunta.opciones.length > 0 ? (
        pregunta.opciones.map((o) => (
          <BarraFila
            key={o.id}
            etiqueta={`${textoImprimible(o.texto)}${o.esCorrecta ? "  (correcta)" : ""}`}
            fraccion={pregunta.respuestas > 0 ? o.conteo / pregunta.respuestas : 0}
            cifra={`${o.conteo} (${pregunta.respuestas > 0 ? Math.round((o.conteo / pregunta.respuestas) * 100) : 0}%)`}
            color={o.esCorrecta ? COLORES.exito : COLORES.primario}
          />
        ))
      ) : pregunta.distribucion && pregunta.distribucion.length > 0 ? (
        pregunta.distribucion.map((d) => (
          <BarraFila
            key={d.valor}
            etiqueta={String(d.valor)}
            fraccion={pregunta.respuestas > 0 ? d.conteo / pregunta.respuestas : 0}
            cifra={`${d.conteo} (${pregunta.respuestas > 0 ? Math.round((d.conteo / pregunta.respuestas) * 100) : 0}%)`}
            color={COLORES.primario}
          />
        ))
      ) : pregunta.textos && pregunta.textos.length > 0 ? (
        <View>
          {pregunta.textos.slice(0, 12).map((t, i) => (
            <Text key={i} style={styles.textoAbierto}>
              · {textoImprimible(t.length > 180 ? `${t.slice(0, 180)}…` : t)}
            </Text>
          ))}
          {pregunta.textos.length > 12 && (
            <Text style={styles.notaSuave}>… y {pregunta.textos.length - 12} respuestas más (ver CSV).</Text>
          )}
        </View>
      ) : (
        <Text style={styles.vacio}>Sin respuestas para esta pregunta.</Text>
      )}
    </View>
  );
}

function InformeEncuestaDocument({
  datos,
  generatedBy,
  logo,
}: {
  datos: ResultadosEncuesta;
  generatedBy: string;
  logo: string | null;
}) {
  const { encuesta, totales, minutosPromedio, puntaje, cumplimiento, evolucion, porPregunta } = datos;
  const totalPreguntas = encuesta.pages.reduce((s, p) => s + p.questions.length, 0);
  const hoy = new Date().toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short" });
  const colorCumpl = colorSemaforo(cumplimiento.porcentaje);
  const semaforo =
    cumplimiento.porcentaje >= 85 ? "Cumple" : cumplimiento.porcentaje >= 70 ? "Aceptable" : "Crítico";

  const datosGenerales: { etiqueta: string; valor: string }[] = [
    { etiqueta: "Código", valor: encuesta.code },
    { etiqueta: "Estado", valor: ESTADO[encuesta.status] ?? encuesta.status },
    { etiqueta: "Audiencia", valor: AUDIENCIA[encuesta.audience] ?? encuesta.audience },
    {
      etiqueta: "Estructura",
      valor: `${totalPreguntas} preguntas en ${encuesta.pages.length} ${encuesta.pages.length === 1 ? "bloque" : "bloques"}`,
    },
    { etiqueta: "Capacitación", valor: encuesta.trainingActivity?.title ?? "—" },
    { etiqueta: "Plan", valor: encuesta.trainingPlan?.title ?? "—" },
    { etiqueta: "Abre", valor: encuesta.opensAt ? encuesta.opensAt.toLocaleDateString("es-CO") : "Sin fecha" },
    { etiqueta: "Cierra", valor: encuesta.closesAt ? encuesta.closesAt.toLocaleDateString("es-CO") : "Sin fecha" },
    {
      etiqueta: "Requiere cuenta",
      valor: encuesta.requireLogin ? "Sí (nominal)" : "No (enlace abierto)",
    },
  ];

  return (
    <Document
      title={`Informe ${encuesta.code} — ${encuesta.title}`}
      author="RedSalud Te Forma"
      subject="Informe de resultados de encuesta"
    >
      <Page size="A4" style={styles.page}>
        {/* Portada institucional */}
        <View style={styles.portadaBanda}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            {logo && <Image src={logo} style={{ width: 46, height: 46, objectFit: "contain" }} />}
            <View style={{ flex: 1 }}>
              <Text style={styles.chipCodigo}>{encuesta.code}</Text>
              <Text style={styles.titulo}>{encuesta.title}</Text>
              <Text style={styles.subtitulo}>Informe de resultados de encuesta · Red Salud Casanare E.S.E.</Text>
              <Text style={styles.subtitulo}>
                Generado el {hoy} por {generatedBy}
              </Text>
            </View>
          </View>
        </View>

        {/* Datos generales */}
        <View style={styles.datosCaja}>
          <Text style={[styles.seccionTitulo, { fontSize: 10, marginBottom: 4 }]}>Datos generales</Text>
          <View style={styles.datosGrilla}>
            {datosGenerales.map((d) => (
              <View key={d.etiqueta} style={styles.datoItem}>
                <Text style={styles.datoEtiqueta}>{d.etiqueta}</Text>
                <Text style={styles.datoValor}>{d.valor}</Text>
              </View>
            ))}
          </View>
          {encuesta.description ? (
            <Text style={[styles.notaSuave, { marginTop: 5 }]}>{encuesta.description}</Text>
          ) : null}
        </View>

        {/* KPIs */}
        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>Participación y cumplimiento</Text>
          <View style={styles.filaKpis}>
            <View style={styles.kpi}>
              <Text style={styles.kpiValor}>{totales.respuestas}</Text>
              <Text style={styles.kpiEtiqueta}>Respuestas totales</Text>
              <Text style={styles.kpiDetalle}>{totales.parciales} quedaron a medias</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiValor}>{totales.completadas}</Text>
              <Text style={styles.kpiEtiqueta}>Completadas</Text>
              <Text style={styles.kpiDetalle}>
                {minutosPromedio !== null ? `${minutosPromedio} min promedio` : "sin tiempo medido"}
              </Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiValor}>{totales.tasaFinalizacion}%</Text>
              <Text style={styles.kpiEtiqueta}>Tasa de finalización</Text>
              <Text style={styles.kpiDetalle}>de quienes la abrieron</Text>
            </View>
            <View style={[styles.kpi, { borderLeftWidth: 3, borderLeftColor: colorCumpl }]}>
              <Text style={[styles.kpiValor, { color: colorCumpl }]}>{cumplimiento.porcentaje}%</Text>
              <Text style={styles.kpiEtiqueta}>
                {cumplimiento.base === "puntaje" ? "Puntaje global" : "Cumplimiento"}
              </Text>
              <Text style={styles.kpiDetalle}>
                {semaforo} · {cumplimiento.base === "puntaje" ? "según clave de respuestas" : "según finalización"}
              </Text>
            </View>
          </View>
        </View>

        {/* Puntaje por bloque */}
        {puntaje && puntaje.porBloque.length > 0 && (
          <View style={styles.seccion}>
            <Text style={styles.seccionTitulo}>Puntaje por bloque</Text>
            {puntaje.porBloque.map((b) => (
              <BarraFila
                key={b.pageId}
                etiqueta={b.titulo}
                fraccion={b.porcentaje / 100}
                cifra={`${b.obtenido}/${b.posible} (${b.porcentaje}%)`}
                color={colorSemaforo(b.porcentaje)}
              />
            ))}
            <Text style={styles.notaSuave}>
              {`Calculado sobre ${puntaje.respuestasCalificadas} ${
                puntaje.respuestasCalificadas === 1 ? "respuesta calificada" : "respuestas calificadas"
              } (suma de puntos, no promedio de promedios). Semaforización institucional: verde de 85 % en adelante, amarillo 70–84,9 %, rojo por debajo de 70 %.`}
            </Text>
          </View>
        )}

        {/* Evolución */}
        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>Evolución diaria de respuestas</Text>
          <EvolucionColumnas evolucion={evolucion} />
        </View>

        {/* Por pregunta */}
        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>Resultados por pregunta</Text>
          {porPregunta.length === 0 ? (
            <Text style={styles.vacio}>La encuesta no tiene preguntas todavía.</Text>
          ) : (
            porPregunta.map((p, i) => (
              <BloquePregunta key={p.id} pregunta={p} indice={i + 1} totalRespuestas={totales.respuestas} />
            ))
          )}
        </View>

        <View style={styles.pie} fixed>
          <Text>RedSalud Te Forma · Red Salud Casanare E.S.E. · {encuesta.code}</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function renderInformeEncuestaPdf(
  datos: ResultadosEncuesta,
  generatedBy: string,
  logoUrl?: string | null
) {
  let logo: string | null = null;
  if (logoUrl) {
    try {
      const buffer = await readFile(publicUploadDiskPath(logoUrl));
      logo = `data:image/png;base64,${buffer.toString("base64")}`;
    } catch {
      // Sin logo el informe se genera igual; no vale la pena fallar por eso.
    }
  }
  return renderToBuffer(<InformeEncuestaDocument datos={datos} generatedBy={generatedBy} logo={logo} />);
}
