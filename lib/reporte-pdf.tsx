import { readFile } from "node:fs/promises";
import { Document, Page, View, Text, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { publicUploadDiskPath } from "@/lib/storage";
import type { FilaCertificados, FilaCumplimiento, FilaPlanta, KpisReporte } from "@/lib/reportes";

/**
 * Informe PDF del centro de datos (Fase 8.4).
 *
 * Se usa @react-pdf/renderer, el mismo motor que ya genera los certificados,
 * en vez de sumar un navegador headless a producción solo para imprimir. Las
 * barras se dibujan con primitivas (una View con ancho porcentual), que para
 * un gráfico de barras da el mismo resultado que rasterizar una gráfica.
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

const styles = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 48, paddingHorizontal: 36, fontSize: 9, color: COLORES.texto },
  portadaBanda: { backgroundColor: COLORES.navy, padding: 20, borderRadius: 8, marginBottom: 16 },
  titulo: { fontSize: 20, color: "#FFFFFF", fontWeight: "bold" },
  subtitulo: { fontSize: 10, color: "#C9D6E2", marginTop: 4 },
  seccion: { marginTop: 16 },
  seccionTitulo: { fontSize: 12, fontWeight: "bold", color: COLORES.navy, marginBottom: 6 },
  filaKpis: { flexDirection: "row", gap: 8, marginBottom: 4 },
  kpi: { flex: 1, backgroundColor: COLORES.fondo, borderRadius: 6, padding: 8 },
  kpiValor: { fontSize: 15, fontWeight: "bold", color: COLORES.navy },
  kpiEtiqueta: { fontSize: 7, color: COLORES.suave, marginTop: 2 },
  barraFila: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  barraEtiqueta: { width: 150, fontSize: 8, color: COLORES.texto },
  barraPista: { flex: 1, height: 9, backgroundColor: COLORES.fondo, borderRadius: 4 },
  barraValor: { height: 9, borderRadius: 4 },
  barraCifra: { width: 74, fontSize: 7, color: COLORES.suave, textAlign: "right" },
  th: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: COLORES.navy, paddingBottom: 3, marginBottom: 2 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: COLORES.linea, paddingVertical: 3 },
  celda: { fontSize: 8 },
  filtros: { backgroundColor: COLORES.fondo, borderRadius: 6, padding: 8, marginBottom: 4 },
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

function colorPorcentaje(pct: number) {
  return pct >= 80 ? COLORES.exito : pct >= 40 ? COLORES.alerta : COLORES.peligro;
}

/** Barra horizontal con etiqueta y cifra, equivalente a la del tablero. */
function Barras({ filas }: { filas: FilaCumplimiento[] }) {
  if (filas.length === 0) {
    return <Text style={{ fontSize: 8, color: COLORES.suave }}>Sin datos para estos filtros.</Text>;
  }
  return (
    <View>
      {filas.map((f) => {
        const pct = f.personas > 0 ? Math.round((f.completaron / f.personas) * 100) : 0;
        return (
          <View key={f.etiqueta} style={styles.barraFila} wrap={false}>
            <Text style={styles.barraEtiqueta}>{f.etiqueta}</Text>
            <View style={styles.barraPista}>
              <View style={[styles.barraValor, { width: `${Math.max(pct, 1)}%`, backgroundColor: colorPorcentaje(pct) }]} />
            </View>
            <Text style={styles.barraCifra}>
              {pct}% ({f.completaron}/{f.personas})
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export type DatosInforme = {
  generadoPor: string;
  filtrosDescritos: string[];
  kpis: KpisReporte;
  cumplimientoMunicipio: FilaCumplimiento[];
  cumplimientoCargo: FilaCumplimiento[];
  cumplimientoGrupo: FilaCumplimiento[];
  certificadosMunicipio: FilaCertificados[];
  planta: FilaPlanta[];
  logoUrl: string | null;
};

function InformeDoc({ datos, logo }: { datos: DatosInforme; logo: string | null }) {
  const hoy = new Date().toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short" });
  const totalPlanta = datos.planta.reduce((s, p) => s + p.personas, 0);

  return (
    <Document title="Informe del centro de datos — RedSalud Te Forma">
      <Page size="A4" style={styles.page}>
        {/* Portada institucional */}
        <View style={styles.portadaBanda}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            {logo && <Image src={logo} style={{ width: 46, height: 46, objectFit: "contain" }} />}
            <View style={{ flex: 1 }}>
              <Text style={styles.titulo}>Informe del centro de datos</Text>
              <Text style={styles.subtitulo}>Red Salud Casanare E.S.E. · Talento Humano</Text>
              <Text style={styles.subtitulo}>
                Generado el {hoy} por {datos.generadoPor}
              </Text>
            </View>
          </View>
        </View>

        {/* Filtros aplicados: hace el informe auditable por sí solo */}
        <View style={styles.filtros}>
          <Text style={{ fontSize: 8, fontWeight: "bold", color: COLORES.navy, marginBottom: 2 }}>
            Filtros aplicados
          </Text>
          <Text style={{ fontSize: 8, color: COLORES.suave }}>
            {datos.filtrosDescritos.length > 0 ? datos.filtrosDescritos.join("  ·  ") : "Sin filtros: toda la población"}
          </Text>
        </View>

        {/* KPIs */}
        <View style={styles.filaKpis}>
          {[
            { v: datos.kpis.personas, e: "Personas" },
            { v: datos.kpis.inscritos, e: "Inscritas" },
            { v: datos.kpis.completaron, e: "Completaron" },
            { v: `${datos.kpis.cumplimiento}%`, e: "Cumplimiento" },
            { v: datos.kpis.certificados, e: "Certificados" },
          ].map((k) => (
            <View key={k.e} style={styles.kpi}>
              <Text style={styles.kpiValor}>{String(k.v)}</Text>
              <Text style={styles.kpiEtiqueta}>{k.e}</Text>
            </View>
          ))}
        </View>

        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>Cumplimiento por municipio</Text>
          <Barras filas={datos.cumplimientoMunicipio} />
        </View>

        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>Cumplimiento por cargo</Text>
          <Barras filas={datos.cumplimientoCargo.slice(0, 12)} />
        </View>

        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>Cumplimiento por grupo poblacional</Text>
          <Barras filas={datos.cumplimientoGrupo} />
        </View>

        <View style={styles.pie} fixed>
          <Text>RedSalud Te Forma · Talento Humano</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.seccionTitulo}>Personal de planta</Text>
        <View style={styles.filaKpis}>
          <View style={styles.kpi}>
            <Text style={styles.kpiValor}>{totalPlanta}</Text>
            <Text style={styles.kpiEtiqueta}>Total de planta</Text>
          </View>
          {datos.planta.map((p) => (
            <View key={p.grupo} style={styles.kpi}>
              <Text style={styles.kpiValor}>{p.personas}</Text>
              <Text style={styles.kpiEtiqueta}>
                {p.grupo === "ASISTENCIAL" ? "Asistencial" : "Administrativo"}
              </Text>
            </View>
          ))}
        </View>

        {/* Tabla de respaldo: las mismas cifras que alimentan las barras */}
        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>Detalle por municipio</Text>
          <View style={styles.th}>
            <Text style={[styles.celda, { flex: 3, fontWeight: "bold" }]}>Municipio</Text>
            <Text style={[styles.celda, { flex: 1, textAlign: "right", fontWeight: "bold" }]}>Personas</Text>
            <Text style={[styles.celda, { flex: 1, textAlign: "right", fontWeight: "bold" }]}>Completaron</Text>
            <Text style={[styles.celda, { flex: 1, textAlign: "right", fontWeight: "bold" }]}>%</Text>
          </View>
          {datos.cumplimientoMunicipio.map((f) => {
            const pct = f.personas > 0 ? Math.round((f.completaron / f.personas) * 100) : 0;
            return (
              <View key={f.etiqueta} style={styles.tr} wrap={false}>
                <Text style={[styles.celda, { flex: 3 }]}>{f.etiqueta}</Text>
                <Text style={[styles.celda, { flex: 1, textAlign: "right" }]}>{f.personas}</Text>
                <Text style={[styles.celda, { flex: 1, textAlign: "right" }]}>{f.completaron}</Text>
                <Text style={[styles.celda, { flex: 1, textAlign: "right" }]}>{pct}%</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>Certificados por municipio</Text>
          {datos.certificadosMunicipio.length === 0 ? (
            <Text style={{ fontSize: 8, color: COLORES.suave }}>Todavía no hay certificados emitidos.</Text>
          ) : (
            <>
              <View style={styles.th}>
                <Text style={[styles.celda, { flex: 3, fontWeight: "bold" }]}>Municipio</Text>
                <Text style={[styles.celda, { flex: 1, textAlign: "right", fontWeight: "bold" }]}>Certificados</Text>
              </View>
              {datos.certificadosMunicipio.map((f) => (
                <View key={f.etiqueta} style={styles.tr} wrap={false}>
                  <Text style={[styles.celda, { flex: 3 }]}>{f.etiqueta}</Text>
                  <Text style={[styles.celda, { flex: 1, textAlign: "right" }]}>{f.certificados}</Text>
                </View>
              ))}
            </>
          )}
        </View>

        <View style={styles.pie} fixed>
          <Text>RedSalud Te Forma · Talento Humano</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function renderInformePdf(datos: DatosInforme): Promise<Buffer> {
  let logo: string | null = null;
  if (datos.logoUrl) {
    try {
      const buffer = await readFile(publicUploadDiskPath(datos.logoUrl));
      logo = `data:image/png;base64,${buffer.toString("base64")}`;
    } catch {
      // Sin logo el informe se genera igual; no vale la pena fallar por eso.
    }
  }
  return renderToBuffer(<InformeDoc datos={datos} logo={logo} />);
}
