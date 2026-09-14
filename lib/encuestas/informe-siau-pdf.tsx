import { readFile } from "node:fs/promises";
import { Document, Page, View, Text, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { publicUploadDiskPath } from "@/lib/storage";
import type { InformeSiau, MetricaPregunta } from "@/lib/encuestas/metrics";
import type { TonoOpcion } from "@/lib/encuestas/tipos";

/**
 * INFORME GENERAL SIAU EN PDF, por periodo: portada institucional, KPIs
 * con semáforo y variación, tendencia mensual (columnas), ranking de
 * sedes, detalle por pregunta con distribución por carita, P2 por perfil,
 * cruces por variable y sugerencias por tema. Misma familia visual que el
 * informe de encuestas y el del centro de datos.
 */

const C = { navy: "#1B2A3D", primario: "#2BA3D4", exito: "#16A44E", alerta: "#E8B23A", peligro: "#D6483B", texto: "#2B3A4A", suave: "#6B7C8F", linea: "#DCE3EA", fondo: "#F4F7FA" };
const TONO: Record<TonoOpcion, string> = { exc: "#1f9d5a", bue: "#2f80c2", reg: "#e0a11c", mal: "#e0642e", muymal: "#d64545", na: "#94a3b8" };

const s = StyleSheet.create({
  page: { paddingTop: 34, paddingBottom: 46, paddingHorizontal: 34, fontSize: 9, color: C.texto },
  banda: { backgroundColor: C.navy, padding: 18, borderRadius: 8, marginBottom: 12 },
  titulo: { fontSize: 16, color: "#FFF", fontWeight: "bold" },
  sub: { fontSize: 9, color: "#C9D6E2", marginTop: 3 },
  chip: { alignSelf: "flex-start", backgroundColor: "#FFF", color: C.navy, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, fontSize: 8, fontWeight: "bold", marginBottom: 6 },
  seccion: { marginTop: 12 },
  h2: { fontSize: 12, fontWeight: "bold", color: C.navy, marginBottom: 6 },
  h3: { fontSize: 9.5, fontWeight: "bold", color: C.navy, marginBottom: 3, marginTop: 4 },
  kpis: { flexDirection: "row", gap: 8 },
  kpi: { flex: 1, backgroundColor: C.fondo, borderRadius: 6, padding: 9 },
  kpiValor: { fontSize: 16, fontWeight: "bold", color: C.navy },
  kpiEt: { fontSize: 7, color: C.suave, marginTop: 2 },
  kpiDet: { fontSize: 6.5, color: C.suave, marginTop: 1.5 },
  fila: { flexDirection: "row", alignItems: "center", marginBottom: 3.5 },
  et: { width: 150, fontSize: 8, paddingRight: 6 },
  pista: { flex: 1, height: 8, backgroundColor: C.fondo, borderRadius: 4, flexDirection: "row", overflow: "hidden" },
  valor: { height: 8 },
  cifra: { width: 74, fontSize: 7.5, color: C.suave, textAlign: "right" },
  caja: { borderLeftWidth: 3, borderLeftColor: C.primario, backgroundColor: C.fondo, borderRadius: 6, padding: 9, marginBottom: 7 },
  nota: { fontSize: 7.5, color: C.suave, marginTop: 3 },
  tabla: { borderWidth: 0.5, borderColor: C.linea, borderRadius: 4, marginTop: 4 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: C.linea },
  th: { flex: 1, padding: 3.5, fontSize: 7, fontWeight: "bold", color: C.suave, backgroundColor: C.fondo, textTransform: "uppercase" },
  td: { flex: 1, padding: 3.5, fontSize: 7.5 },
  pie: { position: "absolute", bottom: 22, left: 34, right: 34, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: C.suave, borderTopWidth: 0.5, borderTopColor: C.linea, paddingTop: 6 },
});

const sem = (v: number | null) => (v === null ? C.suave : v >= 85 ? C.exito : v >= 70 ? C.alerta : C.peligro);
const pct = (v: number | null) => (v === null ? "—" : `${v}%`);
const semTexto = (v: number | null) => (v === null ? "Sin datos" : v >= 85 ? "Cumple" : v >= 70 ? "Aceptable" : "Crítico");
const limpio = (t: string) => t.replace(/→/g, "›").replace(/[✓✔]/g, "»");

function Barra({ etiqueta, valor, cifra }: { etiqueta: string; valor: number | null; cifra: string }) {
  return (
    <View style={s.fila} wrap={false}>
      <Text style={s.et}>{limpio(etiqueta)}</Text>
      <View style={s.pista}><View style={[s.valor, { width: `${Math.max(valor ?? 0, 1)}%`, backgroundColor: sem(valor) }]} /></View>
      <Text style={s.cifra}>{cifra}</Text>
    </View>
  );
}

function Distribucion({ p }: { p: MetricaPregunta }) {
  return (
    <View>
      <View style={[s.pista, { height: 9, marginTop: 3 }]}>
        {p.distribucion.filter((d) => d.n > 0).map((d) => (
          <View key={d.opcionId} style={{ width: `${d.pct}%`, height: 9, backgroundColor: TONO[d.tono ?? "na"] }} />
        ))}
      </View>
      <Text style={s.nota}>{p.distribucion.map((d) => `${d.texto}: ${d.n} (${d.pct}%)`).join(" · ")}</Text>
    </View>
  );
}

function Tendencia({ datos }: { datos: InformeSiau["tendencia"] }) {
  if (datos.length === 0) return <Text style={s.nota}>Sin datos en el periodo.</Text>;
  const ALTO = 70;
  return (
    <View style={{ backgroundColor: C.fondo, borderRadius: 6, padding: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, height: ALTO + 14 }}>
        {datos.map((d) => (
          <View key={d.clave} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end" }}>
            <Text style={{ fontSize: 7, fontWeight: "bold", color: C.navy, marginBottom: 2 }}>{pct(d.adherencia)}</Text>
            <View style={{ width: "60%", maxWidth: 30, height: Math.max(((d.adherencia ?? 0) / 100) * ALTO, 3), backgroundColor: sem(d.adherencia), borderTopLeftRadius: 3, borderTopRightRadius: 3 }} />
          </View>
        ))}
      </View>
      <View style={{ borderTopWidth: 0.7, borderTopColor: C.linea, flexDirection: "row", gap: 8, paddingTop: 3 }}>
        {datos.map((d) => <Text key={d.clave} style={{ flex: 1, fontSize: 6.5, color: C.suave, textAlign: "center" }}>{d.etiqueta} (n{d.total})</Text>)}
      </View>
    </View>
  );
}

function Cruce({ titulo, filas, preguntas }: { titulo: string; filas: InformeSiau["porSede"]; preguntas: MetricaPregunta[] }) {
  return (
    <View style={s.seccion} wrap={false}>
      <Text style={s.h3}>{titulo}</Text>
      <View style={s.tabla}>
        <View style={s.tr}>
          <Text style={[s.th, { flex: 2 }]}>Valor</Text><Text style={s.th}>n</Text><Text style={s.th}>General</Text>
          {preguntas.map((p) => <Text key={p.clave} style={s.th}>P{p.numero}</Text>)}
        </View>
        {filas.map((f) => (
          <View key={f.valor} style={s.tr}>
            <Text style={[s.td, { flex: 2 }]}>{f.valor}</Text><Text style={s.td}>{f.total}</Text>
            <Text style={[s.td, { fontWeight: "bold", color: sem(f.adherencia) }]}>{pct(f.adherencia)}</Text>
            {preguntas.map((p) => { const v = f.porPregunta[p.clave] ?? null; return <Text key={p.clave} style={[s.td, { color: sem(v) }]}>{pct(v)}</Text>; })}
          </View>
        ))}
      </View>
    </View>
  );
}

function Doc({ inf, generadoPor, logo, temas }: { inf: InformeSiau; generadoPor: string; logo: string | null; temas: { tema: string; n: number }[] }) {
  const m = inf.metricas;
  const prev = inf.metricasPrevias;
  const hoy = new Date().toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short", timeZone: "America/Bogota" });
  const filtros = Object.entries(inf.filtros).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(" · ");
  const variacion = inf.variacionGeneral;
  return (
    <Document title={`Informe SIAU · ${inf.rango.etiqueta}`} author="RedSalud Te Forma">
      <Page size="A4" style={s.page}>
        <View style={s.banda}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            {logo && <Image src={logo} style={{ width: 46, height: 46, objectFit: "contain" }} />}
            <View style={{ flex: 1 }}>
              <Text style={s.chip}>PM-7-SIAU-PR-02 V.1 · Resolución 0256 de 2016</Text>
              <Text style={s.titulo}>Encuesta de Atención al Usuario · Informe general</Text>
              <Text style={s.sub}>{inf.rango.etiqueta}{filtros ? ` · ${filtros}` : ""} · comparado con {inf.rangoPrevio.etiqueta}</Text>
              <Text style={s.sub}>Red Salud Casanare E.S.E. · generado el {hoy} por {generadoPor}</Text>
            </View>
          </View>
        </View>

        <View style={s.seccion}>
          <Text style={s.h2}>Vista general</Text>
          <View style={s.kpis}>
            <View style={s.kpi}><Text style={s.kpiValor}>{m.total}</Text><Text style={s.kpiEt}>Encuestas del periodo</Text><Text style={s.kpiDet}>{prev ? `${prev.total} en el periodo anterior` : ""}</Text></View>
            <View style={[s.kpi, { borderLeftWidth: 3, borderLeftColor: sem(m.adherenciaGeneral) }]}><Text style={[s.kpiValor, { color: sem(m.adherenciaGeneral) }]}>{pct(m.adherenciaGeneral)}</Text><Text style={s.kpiEt}>Adherencia general</Text><Text style={s.kpiDet}>{semTexto(m.adherenciaGeneral)}{variacion !== null ? ` · ${variacion > 0 ? "+" : ""}${variacion} pp vs anterior` : ""}</Text></View>
            <View style={s.kpi}><Text style={s.kpiValor}>{pct(m.puntajeGeneral)}</Text><Text style={s.kpiEt}>Puntaje promedio</Text><Text style={s.kpiDet}>promedio de la escala sobre su máximo</Text></View>
            <View style={s.kpi}><Text style={s.kpiValor}>{inf.porSede.filter((x) => x.valor !== "Sin dato").length}</Text><Text style={s.kpiEt}>Sedes con datos</Text><Text style={s.kpiDet}>{inf.porSede.filter((x) => x.semaforo === "success").length} en verde</Text></View>
          </View>
          <Text style={s.nota}>Adherencia = respuestas favorables (Excelente/Bueno, Sí) sobre válidas; No aplica no cuenta. Semáforo: verde ≥ 85 %, amarillo 70–84,9 %, rojo &lt; 70 %.</Text>
        </View>

        <View style={s.seccion}>
          <Text style={s.h2}>Tendencia mensual de adherencia</Text>
          <Tendencia datos={inf.tendencia} />
        </View>

        <View style={[s.seccion, { flexDirection: "row", gap: 10 }]}>
          <View style={{ flex: 1 }}>
            <Text style={s.h3}>Mejores preguntas</Text>
            {m.mejores.map((p) => <Barra key={p.clave} etiqueta={`P${p.numero} · ${p.enunciado.slice(0, 40)}…`} valor={p.adherencia} cifra={pct(p.adherencia)} />)}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.h3}>Preguntas por mejorar</Text>
            {m.peores.map((p) => <Barra key={p.clave} etiqueta={`P${p.numero} · ${p.enunciado.slice(0, 40)}…`} valor={p.adherencia} cifra={pct(p.adherencia)} />)}
          </View>
        </View>

        <View style={s.seccion}>
          <Text style={s.h2}>Por sede</Text>
          {inf.porSede.map((x) => <Barra key={x.valor} etiqueta={x.valor} valor={x.adherencia} cifra={`${pct(x.adherencia)} · n${x.total}${x.adherencia !== null && m.adherenciaGeneral !== null ? ` (${x.adherencia - m.adherenciaGeneral >= 0 ? "+" : ""}${Math.round((x.adherencia - m.adherenciaGeneral) * 10) / 10})` : ""}`} />)}
          <Text style={s.nota}>Entre paréntesis: diferencia en puntos frente al promedio institucional ({pct(m.adherenciaGeneral)}).</Text>
        </View>

        <View style={s.seccion}>
          <Text style={s.h2}>Por pregunta</Text>
          {m.porPregunta.map((p) => (
            <View key={p.clave} style={[s.caja, { borderLeftColor: sem(p.adherencia) }]} wrap={false}>
              <Text style={{ fontSize: 7, color: C.suave, textTransform: "uppercase", marginBottom: 2 }}>Pregunta {p.numero} · {p.n} respuestas · {p.validas} válidas · {semTexto(p.adherencia)}{inf.variacionPorPregunta[p.clave] != null ? ` · ${inf.variacionPorPregunta[p.clave]! > 0 ? "+" : ""}${inf.variacionPorPregunta[p.clave]} pp vs anterior` : ""}</Text>
              <Text style={{ fontSize: 9.5, fontWeight: "bold", color: C.navy, marginBottom: 3 }}>{limpio(p.enunciado)}</Text>
              <Text style={{ fontSize: 8 }}>Adherencia <Text style={{ fontWeight: "bold", color: sem(p.adherencia) }}>{pct(p.adherencia)}</Text> · Puntaje {pct(p.puntaje)} · Promedio {p.promedio ?? "—"} / {p.maximo}</Text>
              <Distribucion p={p} />
            </View>
          ))}
          <Text style={s.h3}>P2 · Trato del personal por perfil</Text>
          {m.porPerfil.map((p) => <Barra key={p.clave} etiqueta={p.perfil ?? ""} valor={p.adherencia} cifra={`${pct(p.adherencia)} · n${p.validas}`} />)}
        </View>

        <View style={s.seccion}>
          <Text style={s.h2}>Cruces por variable</Text>
          <Cruce titulo="Adherencia × servicio (P1)" filas={inf.porServicio} preguntas={m.porPregunta} />
          <Cruce titulo="Adherencia × sexo" filas={inf.porSexo} preguntas={m.porPregunta} />
          <Cruce titulo="Adherencia × EPS" filas={inf.porEps} preguntas={m.porPregunta} />
          <Cruce titulo="Adherencia × sede" filas={inf.porSede} preguntas={m.porPregunta} />
        </View>

        <View style={s.seccion}>
          <Text style={s.h2}>Sugerencias y comentarios (P9)</Text>
          <Text style={s.nota}>{m.sugerencias.length} comentarios. Temas: {temas.length ? temas.map((t) => `${t.tema} (${t.n})`).join(" · ") : "—"}</Text>
          {m.sugerencias.slice(0, 40).map((sug, i) => (
            <Text key={i} style={{ fontSize: 8, marginTop: 2.5, paddingLeft: 6 }}>· [{sug.sede ?? "—"}{sug.servicio ? ` · ${sug.servicio}` : ""}] {limpio(sug.texto.length > 220 ? `${sug.texto.slice(0, 220)}…` : sug.texto)}</Text>
          ))}
          {m.sugerencias.length > 40 && <Text style={s.nota}>… y {m.sugerencias.length - 40} más (ver datos crudos).</Text>}
        </View>

        <View style={s.pie} fixed>
          <Text>RedSalud Te Forma · Red Salud Casanare E.S.E. · Encuesta SIAU · {inf.rango.etiqueta}</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function renderInformeSiauPdf(inf: InformeSiau, generadoPor: string, logoUrl?: string | null, temas: { tema: string; n: number }[] = []) {
  let logo: string | null = null;
  if (logoUrl) {
    try {
      const b = await readFile(publicUploadDiskPath(logoUrl));
      logo = `data:image/png;base64,${b.toString("base64")}`;
    } catch {
      /* sin logo */
    }
  }
  return renderToBuffer(<Doc inf={inf} generadoPor={generadoPor} logo={logo} temas={temas} />);
}
