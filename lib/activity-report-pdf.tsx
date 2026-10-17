import { Document, Page, View, Text, Image, Svg, Path, Circle, Rect, StyleSheet, Font, renderToBuffer } from "@react-pdf/renderer";

// Sin separación silábica: las etiquetas cortas en mayúsculas ("TIEMPO
// TOTAL") se partían con guion. Mejor que salten de línea completas.
Font.registerHyphenationCallback((palabra) => [palabra]);
import type { ActivityReportData } from "@/lib/training-plans";
import type { EvidenciaJornada } from "@/lib/activity-evidence";
import type { ContextoInforme, PermanenciaPersona } from "@/lib/activity-report-contexto";
import { tituloLegible } from "@/components/training-plans/labels";

/**
 * INFORME DE LA JORNADA — formato "tablero ejecutivo".
 *
 * Página 1 es para DECIDIR: membrete navy con código del informe, cuatro
 * indicadores principales (cobertura con anillo, permanencia, evolución del
 * conocimiento, externos), una franja de métricas técnicas, una LECTURA
 * RÁPIDA redactada a partir de los datos y dos gráficos (permanencia y
 * pre/post). Las páginas siguientes son ANEXOS para auditar: asistencia con
 * minutos conectados por persona, resultados, acierto por pregunta,
 * jornadas, externos, encuestas y evidencias.
 *
 * Minimalista a propósito: navy + un cian de marca; verde/rojo solo como
 * señal (mejoró / empeoró). Metadatos en Courier (monoespaciada) como
 * telemetría; cifras grandes en Helvetica Bold.
 */
const C = {
  navy: "#0F2438",
  navy2: "#163A5A",
  cian: "#2BA6DE",
  cianSuave: "#E6F5FC",
  ink: "#0F2438",
  muted: "#5B7184",
  sutil: "#94A3B3",
  borde: "#E2E8F0",
  pista: "#EEF2F6",
  fondo: "#F7F9FB",
  verde: "#2E9E45",
  rojo: "#C4232A",
  ambar: "#B7791F",
  blanco: "#FFFFFF",
};

const s = StyleSheet.create({
  page: { paddingBottom: 46, fontSize: 9, color: C.ink, fontFamily: "Helvetica" },
  cuerpo: { paddingHorizontal: 32 },
  mono: { fontFamily: "Courier" },
  etiquetaMono: { fontFamily: "Courier", fontSize: 7, letterSpacing: 1.2, textTransform: "uppercase", color: C.muted },
  seccion: { marginTop: 18 },
  seccionCab: { flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 6 },
  seccionNum: { fontFamily: "Courier", fontSize: 8, color: C.cian, fontWeight: 700 },
  seccionTitulo: { fontSize: 11.5, fontWeight: 700, color: C.ink },
  seccionLinea: { flex: 1, height: 1, backgroundColor: C.borde, marginLeft: 6 },
  tabla: { borderWidth: 1, borderColor: C.borde, borderRadius: 6, overflow: "hidden" },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.borde, alignItems: "center" },
  trCebra: { backgroundColor: C.fondo },
  th: { paddingVertical: 5, paddingHorizontal: 6, fontFamily: "Courier", fontSize: 6.8, letterSpacing: 0.8, textTransform: "uppercase", color: C.muted, fontWeight: 700 },
  td: { paddingVertical: 5, paddingHorizontal: 6, fontSize: 8.3 },
  vacio: { fontSize: 8.5, color: C.muted, fontStyle: "italic" },
  pie: { position: "absolute", bottom: 18, left: 32, right: 32, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: C.borde, paddingTop: 6 },
});

const FMT_FECHA = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Bogota" });
const FMT_HORA = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });
const fecha = (d: Date | null | undefined) => (d ? FMT_FECHA.format(d) : "—");
const pctDe = (v: number, sobre: number) => (sobre > 0 ? Math.round((v / sobre) * 100) : null);
const signo = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const normal = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
/** Semáforo institucional: ≥85 cumple · 70–84.9 en alerta · <70 crítico (igual que los indicadores del plan). */
const semaforo = (v: number | null) => (v === null ? null : v >= 85 ? { t: "CUMPLE", c: "#7EE2A0" } : v >= 70 ? { t: "EN ALERTA", c: "#FFD37E" } : { t: "CRÍTICO", c: "#FF9B9B" });
const prom = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
};
const ROMANO = ["I", "II", "III", "IV"];
const MODALIDAD: Record<string, string> = { VIRTUAL: "Virtual", PRESENCIAL: "Presencial", MIXTA: "Mixta" };
const TIPO: Record<string, string> = { COURSE: "Capacitación", EXTERNAL_EVENT: "Evento / jornada", WORKSHOP: "Taller", OTHER: "Otra" };

/* ───────────────────────── piezas gráficas ───────────────────────── */

/** Anillo de porcentaje (arco SVG). */
function Anillo({ valor, tam = 64, color = C.cian, fondo = "#2A4A66" }: { valor: number | null; tam?: number; color?: string; fondo?: string }) {
  const r = tam / 2 - 5;
  const c = tam / 2;
  const v = valor === null ? 0 : Math.min(100, Math.max(0, valor));
  const ang = (v / 100) * 2 * Math.PI - Math.PI / 2;
  const x = c + r * Math.cos(ang);
  const y = c + r * Math.sin(ang);
  const grande = v > 50 ? 1 : 0;
  return (
    <View style={{ width: tam, height: tam, position: "relative" }}>
      <Svg width={tam} height={tam} viewBox={`0 0 ${tam} ${tam}`}>
        <Circle cx={c} cy={c} r={r} stroke={fondo} strokeWidth={6} fill="none" />
        {v >= 99.9 ? (
          <Circle cx={c} cy={c} r={r} stroke={color} strokeWidth={6} fill="none" />
        ) : v > 0 ? (
          <Path d={`M ${c} ${c - r} A ${r} ${r} 0 ${grande} 1 ${x} ${y}`} stroke={color} strokeWidth={6} fill="none" strokeLinecap="round" />
        ) : null}
      </Svg>
      <View style={{ position: "absolute", top: 0, left: 0, width: tam, height: tam, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: tam > 56 ? 13 : 10, fontWeight: 700, color: C.blanco }}>{valor === null ? "—" : `${Math.round(v)}%`}</Text>
      </View>
    </View>
  );
}

/** Barra horizontal segmentada (medidor). */
function Medidor({ valor, ancho = 120, color = C.cian, alto = 5 }: { valor: number | null; ancho?: number; color?: string; alto?: number }) {
  const v = valor === null ? 0 : Math.min(100, Math.max(0, valor));
  const segs = Math.floor(ancho / 4);
  const llenos = Math.round((v / 100) * segs);
  return (
    <Svg width={ancho} height={alto} viewBox={`0 0 ${ancho} ${alto}`}>
      {Array.from({ length: segs }, (_, i) => (
        <Rect key={i} x={i * 4} y={0} width={3} height={alto} fill={i < llenos ? color : C.pista} />
      ))}
    </Svg>
  );
}

function Seccion({ n, titulo, children, wrap = true }: { n: string; titulo: string; children: React.ReactNode; wrap?: boolean }) {
  return (
    <View style={s.seccion} wrap={wrap}>
      <View style={s.seccionCab} minPresenceAhead={60}>
        <Text style={s.seccionNum}>{n}</Text>
        <Text style={s.seccionTitulo}>{titulo}</Text>
        <View style={s.seccionLinea} />
      </View>
      {children}
    </View>
  );
}

/* ───────────────────────── página 1: tablero ───────────────────────── */

function Membrete({ data, ctx, generadoPor }: { data: ActivityReportData; ctx: ContextoInforme | null; generadoPor: string }) {
  return (
    <View style={{ backgroundColor: C.navy, paddingHorizontal: 32, paddingTop: 22, paddingBottom: 20 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de react-pdf: no admite alt */}
          {ctx?.logo && <Image src={ctx.logo} style={{ width: 26, height: 26, objectFit: "contain" }} />}
          <View>
            <Text style={{ fontSize: 8.5, fontWeight: 700, color: C.blanco }}>Red Salud Casanare E.S.E.</Text>
            <Text style={{ fontFamily: "Courier", fontSize: 6.8, letterSpacing: 1.4, color: "#8FC9E8" }}>RED SALUD TE FORMA · INFORME DE JORNADA</Text>
          </View>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontFamily: "Courier", fontSize: 7.5, color: "#8FC9E8", letterSpacing: 1 }}>{ctx?.codigo ?? "INF"}</Text>
          <View style={{ marginTop: 4, borderWidth: 1, borderColor: "#3E6585", borderRadius: 3, paddingHorizontal: 5, paddingVertical: 2 }}>
            <Text style={{ fontFamily: "Courier", fontSize: 6.8, color: C.blanco, letterSpacing: 1.2 }}>
              {data.status === "CLOSED" ? "INFORME DEFINITIVO · JORNADA CERRADA" : "INFORME PRELIMINAR · JORNADA EN CURSO"}
            </Text>
          </View>
        </View>
      </View>

      <Text style={{ fontFamily: "Courier", fontSize: 7, color: "#8FC9E8", letterSpacing: 1.4, marginTop: 16 }}>
        {[data.area, data.programa].filter(Boolean).join(" · ").toUpperCase() || "CAPACITACIÓN DEL PLAN"}
      </Text>
      <Text style={{ fontSize: 17, fontWeight: 700, color: C.blanco, marginTop: 4, lineHeight: 1.2 }}>{tituloLegible(data.titulo)}</Text>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 10 }}>
        {[
          ["Plan", data.plan],
          ["Responsable", data.responsable ?? "—"],
          ["Dirigido a", data.dirigidoA ?? "—"],
          ["Programación", data.ficha ? `${data.ficha.trimestres.length ? `Trimestre ${data.ficha.trimestres.map((t) => ROMANO[t - 1] ?? t).join(", ")}` : "Sin trimestre"} · ${MODALIDAD[data.ficha.modalidad] ?? data.ficha.modalidad}` : "—"],
          ["Jornadas", ctx?.jornadas.length ? `${ctx.jornadas.length} · ${fecha(ctx.jornadas[0].inicio)}${ctx.jornadas.length > 1 ? ` – ${fecha(ctx.jornadas[ctx.jornadas.length - 1].inicio)}` : ""}` : "—"],
          ["Cierre", fecha(data.cerradaEl)],
          ["Generado", `${fecha(new Date())} · ${generadoPor}`],
        ].map(([k, v]) => (
          <View key={k}>
            <Text style={{ fontFamily: "Courier", fontSize: 6.3, color: "#7FA3BF", letterSpacing: 1, textTransform: "uppercase" }}>{k}</Text>
            <Text style={{ fontSize: 8, color: C.blanco, marginTop: 1, maxWidth: 190 }}>{v}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Los 4 indicadores principales, en la banda navy. */
function IndicadoresPrincipales({ data, ctx }: { data: ActivityReportData; ctx: ContextoInforme | null }) {
  const ind = data.indicadores;
  const cob = ctx?.cobertura;
  const perm = ctx?.permanencia ?? [];
  const promedioMin = perm.length ? Math.round(perm.reduce((a, p) => a + p.minutos, 0) / perm.length) : null;
  const conAmbos = ind.promedioPre !== null && ind.promedioPost !== null;
  const tarjeta = { flex: 1, borderWidth: 1, borderColor: "#2E5576", borderRadius: 8, padding: 10, backgroundColor: C.navy2 };
  const etiqueta = { fontFamily: "Courier", fontSize: 6.5, letterSpacing: 1.1, color: "#8FC9E8", textTransform: "uppercase" as const };

  return (
    <View style={{ backgroundColor: C.navy, paddingHorizontal: 32, paddingBottom: 20 }}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {/* Cobertura */}
        <View style={[tarjeta, { flexDirection: "row", alignItems: "center", gap: 9, flex: 1.25 }]}>
          <Anillo valor={cob ? cob.porcentaje : pctDe(ind.asistentes, 0)} tam={58} />
          <View style={{ flex: 1 }}>
            <Text style={etiqueta}>Cobertura</Text>
            <Text style={{ fontSize: 18, fontWeight: 700, color: C.blanco, marginTop: 2 }}>
              {cob ? cob.asistieron : ind.asistentes}
              <Text style={{ fontSize: 9, color: "#9FB6C9" }}> / {cob ? cob.convocados : "—"}</Text>
            </Text>
            <Text style={{ fontSize: 7, color: "#9FB6C9", marginTop: 1 }}>
              {cob?.audienciaComite ? "integrantes" : "personal objetivo"}
            </Text>
            {cob && semaforo(cob.porcentaje) && (
              <Text style={{ fontFamily: "Courier", fontSize: 6, letterSpacing: 1, marginTop: 3, color: semaforo(cob.porcentaje)!.c }}>{semaforo(cob.porcentaje)!.t}</Text>
            )}
          </View>
        </View>
        {/* Permanencia */}
        <View style={tarjeta}>
          <Text style={etiqueta}>Permanencia</Text>
          <Text style={{ fontSize: 18, fontWeight: 700, color: C.blanco, marginTop: 2 }}>
            {promedioMin ?? "—"}
            {promedioMin !== null && <Text style={{ fontSize: 9, color: "#9FB6C9" }}> min</Text>}
          </Text>
          <Text style={{ fontSize: 7, color: "#9FB6C9", marginTop: 1 }}>promedio por persona en la sala</Text>
        </View>
        {/* Conocimiento */}
        <View style={tarjeta}>
          <Text style={etiqueta}>Conocimiento</Text>
          {conAmbos ? (
            <>
              <Text style={{ fontSize: 18, fontWeight: 700, color: ind.diferencia! >= 0 ? "#7EE2A0" : "#FF9B9B", marginTop: 2 }}>
                {signo(ind.diferencia!)}
                <Text style={{ fontSize: 9 }}> pp</Text>
              </Text>
              <Text style={{ fontSize: 7, color: "#9FB6C9", marginTop: 1 }}>
                pre {ind.promedioPre}% a post {ind.promedioPost}%
              </Text>
            </>
          ) : (
            <>
              <Text style={{ fontSize: 18, fontWeight: 700, color: C.blanco, marginTop: 2 }}>—</Text>
              <Text style={{ fontSize: 7, color: "#9FB6C9", marginTop: 1 }}>sin evaluación pre/post</Text>
            </>
          )}
        </View>
        {/* Aprobación postsaber */}
        <View style={tarjeta}>
          <Text style={etiqueta}>Aprobó postsaber</Text>
          {ind.evaluadosPost > 0 ? (
            <>
              <Text style={{ fontSize: 18, fontWeight: 700, color: C.blanco, marginTop: 2 }}>
                {pctDe(ind.adherentesPost, ind.evaluadosPost)}
                <Text style={{ fontSize: 9, color: "#9FB6C9" }}>%</Text>
              </Text>
              <Text style={{ fontSize: 7, color: "#9FB6C9", marginTop: 1 }}>{ind.adherentesPost} de {ind.evaluadosPost} · mínimo {data.passingScore}%</Text>
              {semaforo(pctDe(ind.adherentesPost, ind.evaluadosPost)) && (
                <Text style={{ fontFamily: "Courier", fontSize: 6, letterSpacing: 1, marginTop: 3, color: semaforo(pctDe(ind.adherentesPost, ind.evaluadosPost))!.c }}>{semaforo(pctDe(ind.adherentesPost, ind.evaluadosPost))!.t}</Text>
              )}
            </>
          ) : (
            <>
              <Text style={{ fontSize: 18, fontWeight: 700, color: C.blanco, marginTop: 2 }}>—</Text>
              <Text style={{ fontSize: 7, color: "#9FB6C9", marginTop: 1 }}>nadie ha presentado el postsaber</Text>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

/** Franja de métricas técnicas (8 celdas). */
function FranjaMetricas({ data, ctx }: { data: ActivityReportData; ctx: ContextoInforme | null }) {
  const ind = data.indicadores;
  const perm = ctx?.permanencia ?? [];
  const totalMin = perm.reduce((a, p) => a + p.minutos, 0);
  const celdas: [string, string][] = [
    ["Asistencia", ctx ? `${ctx.cobertura.porcentaje}%` : "—"],
    ["Asistentes", String(ind.asistentes)],
    ["En la sala", String(perm.length)],
    ["Tiempo", totalMin >= 60 ? `${Math.floor(totalMin / 60)}h ${totalMin % 60}m` : `${totalMin}m`],
    ["Jornadas", String(ctx?.jornadas.length ?? 0)],
    ["Pre y post", String(ind.completaronCiclo)],
    ["Aprobó post", ind.evaluadosPost ? `${pctDe(ind.adherentesPost, ind.evaluadosPost)}%` : "—"],
    ["Mejoraron", ind.completaronCiclo ? `${pctDe(ind.mejoraron, ind.completaronCiclo)}%` : "—"],
    ["Externos", String(data.externos.length)],
    ["Satisfacción", (() => { const f = prom(data.encuestas.map((e) => e.satisfaccion?.favorable ?? null)); return f === null ? "—" : `${f}%`; })()],
  ];
  return (
    <View style={[s.cuerpo, { marginTop: 14 }]}>
      <View style={{ flexDirection: "row", borderWidth: 1, borderColor: C.borde, borderRadius: 8 }}>
        {celdas.map(([k, v], i) => (
          <View key={k} style={{ flex: 1, paddingVertical: 8, paddingHorizontal: 6, borderLeftWidth: i === 0 ? 0 : 1, borderLeftColor: C.borde }}>
            <Text style={{ fontFamily: "Courier", fontSize: 12, fontWeight: 700, color: C.ink }}>{v}</Text>
            <Text style={[s.etiquetaMono, { fontSize: 5.8, marginTop: 3 }]}>{k}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Hallazgos redactados a partir de los datos: lo primero que se lee. */
function LecturaRapida({ data, ctx }: { data: ActivityReportData; ctx: ContextoInforme | null }) {
  const ind = data.indicadores;
  const cob = ctx?.cobertura;
  const perm = ctx?.permanencia ?? [];
  const hallazgos: { tono: "bien" | "alerta" | "neutro"; texto: string }[] = [];

  if (cob && cob.convocados > 0) {
    hallazgos.push({
      tono: cob.porcentaje >= 70 ? "bien" : cob.porcentaje >= 40 ? "neutro" : "alerta",
      texto: `Asistió el ${cob.porcentaje}% de ${cob.audienciaComite ? "los integrantes" : "la población objetivo"} (${cob.asistieron} de ${cob.convocados}).${cob.otrosAsistieron > 0 ? ` Además asistieron ${cob.otrosAsistieron} ${cob.otrosAsistieron === 1 ? "persona" : "personas"} que no hacen parte de esa población: figuran en la lista de asistencia, pero no cuentan para la cobertura ni la adherencia.` : ""}`,
    });
  }
  if (ctx && ctx.jornadas.length > 1) {
    const conRegistro = ctx.jornadas.filter((j) => j.asistentes + j.invitados > 0).length;
    hallazgos.push({
      tono: "neutro",
      texto: `Se dictó en ${ctx.jornadas.length} jornadas${conRegistro < ctx.jornadas.length ? ` (${conRegistro} con registros por sus enlaces)` : ""}; el detalle de asistentes, presaber, postsaber e invitados de cada una está en «Jornadas dictadas».`,
    });
  }
  if (perm.length > 0) {
    const prom = Math.round(perm.reduce((a, p) => a + p.minutos, 0) / perm.length);
    const largos = perm.filter((p) => p.minutos >= 30).length;
    const cortos = perm.filter((p) => p.minutos < 10).length;
    hallazgos.push({
      tono: cortos > perm.length / 3 ? "alerta" : "neutro",
      texto: `La permanencia promedio en la sala fue de ${prom} min: ${largos} de ${perm.length} personas estuvieron 30 min o más${cortos ? ` y ${cortos} menos de 10 min` : ""}.`,
    });
  } else {
    hallazgos.push({ tono: "neutro", texto: "No hay conexiones a la sala virtual registradas (jornada presencial o sin sala integrada)." });
  }
  if (ind.promedioPre !== null && ind.promedioPost !== null) {
    hallazgos.push({
      tono: (ind.diferencia ?? 0) > 0 ? "bien" : (ind.diferencia ?? 0) < 0 ? "alerta" : "neutro",
      texto: `El conocimiento pasó de ${ind.promedioPre}% a ${ind.promedioPost}% (${signo(ind.diferencia ?? 0)} pp); ${ind.mejoraron} de ${ind.completaronCiclo} personas que presentaron ambos momentos mejoraron su nota.`,
    });
  } else if (ind.evaluadosPre + ind.evaluadosPost === 0) {
    hallazgos.push({ tono: "neutro", texto: "No se aplicó la evaluación presaber/postsaber en esta jornada." });
  }
  if (ind.evaluadosPost > 0) {
    const aprob = pctDe(ind.adherentesPost, ind.evaluadosPost) ?? 0;
    hallazgos.push({
      tono: aprob >= 80 ? "bien" : aprob >= 60 ? "neutro" : "alerta",
      texto: `${aprob}% aprobó el postsaber (mínimo ${data.passingScore}%): ${ind.adherentesPost} de ${ind.evaluadosPost}.`,
    });
  }
  if (data.externos.length > 0) {
    const pre = prom(data.externos.map((e) => e.presaber));
    const post = prom(data.externos.map((e) => e.postsaber));
    hallazgos.push({
      tono: pre !== null && post !== null ? (post > pre ? "bien" : "neutro") : "neutro",
      texto: `${data.externos.length} participantes externos se registraron por el enlace de invitados${pre !== null && post !== null ? `: su conocimiento pasó de ${pre}% a ${post}% (${signo(post - pre)} pp)` : ""}.`,
    });
  }
  for (const e of data.encuestas) {
    if (!e.satisfaccion || e.respuestas === 0) continue;
    const f = e.satisfaccion.favorable;
    const esc = e.satisfaccion.promedioEscala;
    hallazgos.push({
      tono: f === null ? "neutro" : f >= 85 ? "bien" : f >= 70 ? "neutro" : "alerta",
      texto: `Satisfacción (${e.respuestas} ${e.respuestas === 1 ? "respuesta" : "respuestas"}): ${f !== null ? `${f}% calificó la jornada como buena o excelente` : "sin pregunta de calificación general"}${esc !== null ? `; promedio ${esc} de ${e.satisfaccion.escalaMax ?? 5} en las preguntas de escala` : ""}.`,
    });
  }

  const color = { bien: C.verde, alerta: C.rojo, neutro: C.cian };
  return (
    <View style={[s.cuerpo, s.seccion]}>
      <View style={s.seccionCab}>
        <Text style={s.seccionNum}>01</Text>
        <Text style={s.seccionTitulo}>Lectura rápida</Text>
        <View style={s.seccionLinea} />
      </View>
      {hallazgos.map((h, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 7, marginBottom: 5, alignItems: "flex-start" }}>
          <View style={{ width: 3, height: 11, backgroundColor: color[h.tono], borderRadius: 1, marginTop: 1 }} />
          <Text style={{ flex: 1, fontSize: 8.8, lineHeight: 1.4, color: C.ink }}>{h.texto}</Text>
        </View>
      ))}
    </View>
  );
}

/** Distribución de permanencia (barras por rango) + pre/post. */
function Graficos({ data, ctx }: { data: ActivityReportData; ctx: ContextoInforme | null }) {
  const perm = ctx?.permanencia ?? [];
  const rangos: [string, (m: number) => boolean][] = [
    ["< 10 min", (m) => m < 10],
    ["10–29", (m) => m >= 10 && m < 30],
    ["30–59", (m) => m >= 30 && m < 60],
    ["60–119", (m) => m >= 60 && m < 120],
    ["120+", (m) => m >= 120],
  ];
  const conteos = rangos.map(([, f]) => perm.filter((p) => f(p.minutos)).length);
  const max = Math.max(1, ...conteos);
  const ind = data.indicadores;
  const caja = { flex: 1, borderWidth: 1, borderColor: C.borde, borderRadius: 8, padding: 10 };

  return (
    <View style={[s.cuerpo, s.seccion]} wrap={false}>
      <View style={s.seccionCab}>
        <Text style={s.seccionNum}>02</Text>
        <Text style={s.seccionTitulo}>Comportamiento de la jornada</Text>
        <View style={s.seccionLinea} />
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={caja}>
          <Text style={s.etiquetaMono}>Permanencia en la sala · personas por rango</Text>
          {perm.length === 0 ? (
            <Text style={[s.vacio, { marginTop: 10 }]}>Sin conexiones registradas.</Text>
          ) : (
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, height: 86, marginTop: 10 }}>
              {conteos.map((n, i) => (
                <View key={i} style={{ flex: 1, alignItems: "center" }}>
                  <Text style={{ fontFamily: "Courier", fontSize: 7.5, fontWeight: 700, marginBottom: 2 }}>{n}</Text>
                  <View style={{ width: "100%", height: Math.max(2, (n / max) * 58), backgroundColor: i >= 2 ? C.cian : "#9CCFE8", borderRadius: 2 }} />
                  <Text style={{ fontFamily: "Courier", fontSize: 5.8, color: C.muted, marginTop: 3 }}>{rangos[i][0]}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
        <View style={caja}>
          <Text style={s.etiquetaMono}>Evaluación · promedio presaber vs postsaber</Text>
          {ind.promedioPre === null && ind.promedioPost === null ? (
            <Text style={[s.vacio, { marginTop: 10 }]}>Sin evaluación aplicada.</Text>
          ) : (
            <View style={{ marginTop: 12, gap: 10 }}>
              {[
                ["Presaber", ind.promedioPre, ind.evaluadosPre, "#9CCFE8"],
                ["Postsaber", ind.promedioPost, ind.evaluadosPost, C.cian],
              ].map(([k, v, n, col]) => (
                <View key={k as string}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
                    <Text style={{ fontSize: 8, fontWeight: 700 }}>{k as string}</Text>
                    <Text style={{ fontFamily: "Courier", fontSize: 8 }}>
                      {v === null ? "—" : `${v}%`} · n={n as number}
                    </Text>
                  </View>
                  <Medidor valor={v as number | null} ancho={220} alto={7} color={col as string} />
                </View>
              ))}
              <Text style={{ fontFamily: "Courier", fontSize: 6.8, color: C.muted }}>Mínimo para aprobar: {data.passingScore}%</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

/** Lo programado en el PIC: objetivo, metodología y seguimiento. */
function FichaPic({ data }: { data: ActivityReportData }) {
  const f = data.ficha;
  if (!f) return null;
  const filas: [string, string][] = [
    ["Objetivo", f.objetivo ?? "—"],
    ["Metodología", f.metodologia ?? "—"],
    ["Dirigido a", data.dirigidoA ?? "—"],
    ["Personas a capacitar", f.convocados !== null ? `${f.convocados}${f.convocadosNota ? ` · ${f.convocadosNota}` : ""}` : f.convocadosNota ?? "—"],
    ["Tipo y modalidad", `${TIPO[f.tipo] ?? f.tipo} · ${MODALIDAD[f.modalidad] ?? f.modalidad}`],
    ["Seguimiento (PIC)", f.seguimiento.length ? f.seguimiento.map((x, i) => `${i + 1}. ${x}`).join("  ") : "—"],
  ];
  return (
    <Seccion n="03" titulo="Ficha de la capacitación · PIC">
      <View style={{ borderWidth: 1, borderColor: C.borde, borderRadius: 6 }}>
        {filas.map(([k, v], i) => (
          <View key={k} style={{ flexDirection: "row", paddingVertical: 5, paddingHorizontal: 8, borderTopWidth: i ? 1 : 0, borderTopColor: C.borde, backgroundColor: i % 2 ? C.fondo : C.blanco }}>
            <Text style={[s.etiquetaMono, { width: 112, fontSize: 6.5, marginTop: 1 }]}>{k}</Text>
            <Text style={{ flex: 1, fontSize: 8.4, lineHeight: 1.4 }}>{v}</Text>
          </View>
        ))}
      </View>
    </Seccion>
  );
}

/** Acciones que se desprenden de los datos: lo que el área debería hacer después. */
function PlanDeAccion({ data, ctx }: { data: ActivityReportData; ctx: ContextoInforme | null }) {
  const ind = data.indicadores;
  const acciones: string[] = [];
  const cob = ctx?.cobertura;
  if (cob && cob.convocados > 0 && cob.porcentaje < 70) {
    acciones.push(`Reconvocar al ${100 - cob.porcentaje}% del personal objetivo que no asistió (${cob.convocados - cob.asistieron} personas): programar una jornada de refuerzo o compartir la grabación con control de visualización.`);
  }
  const dificiles = data.porPregunta.filter((q) => q.postsaber !== null && q.postsaber < 60);
  if (dificiles.length) {
    acciones.push(`Reforzar en la siguiente jornada los ${dificiles.length} temas con menos de 60% de acierto en el postsaber: ${dificiles.map((q) => `«${q.statement.length > 70 ? q.statement.slice(0, 67) + "…" : q.statement}»`).join("; ")}.`);
  }
  const sinPost = ind.evaluadosPre - ind.completaronCiclo;
  if (sinPost > 0) acciones.push(`Gestionar el postsaber de ${sinPost} ${sinPost === 1 ? "persona que presentó" : "personas que presentaron"} el presaber y aún no cierran su ciclo (el postsaber ya está habilitado para ellas).`);
  if (ind.evaluadosPost > 0 && ind.adherentesPost < ind.evaluadosPost) {
    acciones.push(`Acompañar a ${ind.evaluadosPost - ind.adherentesPost} ${ind.evaluadosPost - ind.adherentesPost === 1 ? "persona que no alcanzó" : "personas que no alcanzaron"} el mínimo del ${data.passingScore}% en el postsaber: pueden volver a presentarlo si les quedan intentos.`);
  }
  const perm = ctx?.permanencia ?? [];
  const cortos = perm.filter((p) => p.minutos < 10).length;
  if (perm.length && cortos > perm.length / 3) acciones.push(`Revisar la conectividad y la convocatoria: ${cortos} de ${perm.length} personas estuvieron menos de 10 minutos en la sala.`);
  for (const e of data.encuestas) {
    if (e.satisfaccion?.comentarios.length) acciones.push(`Atender las sugerencias de la encuesta «${e.titulo}»: ${e.satisfaccion.comentarios.slice(0, 3).map((c) => `«${c}»`).join("; ")}.`);
  }
  if (data.status !== "CLOSED") acciones.push("Cerrar la jornada cuando termine el ciclo: el informe queda congelado como evidencia definitiva y el personal no adherente se registra nominalmente.");
  if (!acciones.length) acciones.push("Sin acciones pendientes: la jornada cumplió cobertura, aprobación y adherencia. Archivar el informe como evidencia del PIC.");
  return (
    <Seccion n="04" titulo="Plan de acción sugerido">
      {acciones.map((a, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 7, marginBottom: 5, alignItems: "flex-start" }} wrap={false}>
          <Text style={{ fontFamily: "Courier", fontSize: 8, color: C.cian, fontWeight: 700, width: 16 }}>{String(i + 1).padStart(2, "0")}</Text>
          <Text style={{ flex: 1, fontSize: 8.6, lineHeight: 1.4 }}>{a}</Text>
        </View>
      ))}
      <Text style={{ fontSize: 7, color: C.muted, marginTop: 4 }}>Generado automáticamente a partir de los datos de la jornada; el área lo valida y lo convierte en plan de mejora si aplica.</Text>
    </Seccion>
  );
}

/* ───────────────────────── anexos ───────────────────────── */

function Asistencia({ data, ctx }: { data: ActivityReportData; ctx: ContextoInforme | null }) {
  const minutosPorNombre = new Map<string, PermanenciaPersona>();
  for (const p of ctx?.permanencia ?? []) if (!p.externo) minutosPorNombre.set(normal(p.nombre), p);
  return (
    <Seccion n="06" titulo={`Lista de asistencia · ${data.asistencia.length}`}>
      {data.asistencia.length === 0 ? (
        <Text style={s.vacio}>Sin asistencias registradas.</Text>
      ) : (
        <View style={s.tabla}>
          <View style={[s.tr, { backgroundColor: C.pista }]} fixed>
            <Text style={[s.th, { width: 22 }]}>#</Text>
            <Text style={[s.th, { flex: 2.3 }]}>Nombre</Text>
            <Text style={[s.th, { flex: 1.2 }]}>Documento</Text>
            <Text style={[s.th, { flex: 1.3 }]}>Fecha</Text>
            <Text style={[s.th, { flex: 1.5 }]}>Permanencia</Text>
            <Text style={[s.th, { flex: 0.9 }]}>Origen</Text>
          </View>
          {data.asistencia.map((a, i) => {
            const p = minutosPorNombre.get(normal(a.fullName));
            return (
              <View key={i} style={[s.tr, i % 2 ? s.trCebra : {}]} wrap={false}>
                <Text style={[s.td, s.mono, { width: 22, color: C.sutil }]}>{String(i + 1).padStart(2, "0")}</Text>
                <Text style={[s.td, { flex: 2.3 }]}>{a.fullName}</Text>
                <Text style={[s.td, s.mono, { flex: 1.2 }]}>{a.documentNumber}</Text>
                <Text style={[s.td, { flex: 1.3 }]}>{fecha(a.fecha)}</Text>
                <View style={[s.td, { flex: 1.5, flexDirection: "row", alignItems: "center", gap: 4 }]}>
                  {p ? (
                    <>
                      <Medidor valor={Math.min(100, (p.minutos / 120) * 100)} ancho={44} alto={4} />
                      <Text style={{ fontFamily: "Courier", fontSize: 7.5 }}>{p.minutos} min</Text>
                    </>
                  ) : (
                    <Text style={{ fontSize: 7.5, color: C.sutil }}>—</Text>
                  )}
                </View>
                <Text style={[s.td, { flex: 0.9, fontSize: 7.5, color: C.muted }]}>{a.source === "AUTOMATIC" ? "Automático" : "Manual"}</Text>
              </View>
            );
          })}
        </View>
      )}
      <Text style={{ fontSize: 7, color: C.muted, marginTop: 5 }}>
        Registro electrónico por autenticación institucional en RedSalud Te Forma. Permanencia = suma de los tramos reales de conexión a la sala (barra a escala de 120 min).
      </Text>
    </Seccion>
  );
}

function Personas({ data }: { data: ActivityReportData }) {
  if (data.personas.length === 0 && data.indicadores.evaluadosPre + data.indicadores.evaluadosPost === 0) return null;
  return (
    <Seccion n="07" titulo="Resultados por persona · mejor intento de cada momento">
      {data.personas.length === 0 ? (
        <Text style={s.vacio}>Nadie presentó la evaluación.</Text>
      ) : (
        <View style={s.tabla}>
          <View style={[s.tr, { backgroundColor: C.pista }]} fixed>
            <Text style={[s.th, { flex: 2.4 }]}>Nombre</Text>
            <Text style={[s.th, { flex: 1.2 }]}>Documento</Text>
            <Text style={[s.th, { flex: 0.8 }]}>Pre</Text>
            <Text style={[s.th, { flex: 0.8 }]}>Post</Text>
            <Text style={[s.th, { flex: 1.4 }]}>Variación</Text>
          </View>
          {data.personas.map((p, i) => (
            <View key={i} style={[s.tr, i % 2 ? s.trCebra : {}]} wrap={false}>
              <Text style={[s.td, { flex: 2.4 }]}>{p.fullName}</Text>
              <Text style={[s.td, s.mono, { flex: 1.2 }]}>{p.documentNumber}</Text>
              <Text style={[s.td, s.mono, { flex: 0.8 }]}>{p.presaber !== null ? `${p.presaber}%` : "—"}</Text>
              <Text style={[s.td, s.mono, { flex: 0.8, fontWeight: 700 }]}>{p.postsaber !== null ? `${p.postsaber}%` : "—"}</Text>
              <Text
                style={[
                  s.td,
                  s.mono,
                  { flex: 1.4, fontWeight: 700, color: p.diferencia === null ? C.sutil : p.diferencia > 0 ? C.verde : p.diferencia < 0 ? C.rojo : C.muted },
                ]}
              >
                {p.diferencia !== null ? `${signo(p.diferencia)} pp` : "—"}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Seccion>
  );
}

function PorPregunta({ data }: { data: ActivityReportData }) {
  if (data.porPregunta.length === 0) return null;
  return (
    <Seccion n="08" titulo="Acierto por pregunta">
      <View style={s.tabla}>
        <View style={[s.tr, { backgroundColor: C.pista }]} fixed>
          <Text style={[s.th, { width: 22 }]}>#</Text>
          <Text style={[s.th, { flex: 3 }]}>Pregunta</Text>
          <Text style={[s.th, { flex: 1.6 }]}>Presaber</Text>
          <Text style={[s.th, { flex: 1.6 }]}>Postsaber</Text>
        </View>
        {data.porPregunta.map((q, i) => (
          <View key={i} style={[s.tr, i % 2 ? s.trCebra : {}]} wrap={false}>
            <Text style={[s.td, s.mono, { width: 22, color: C.sutil }]}>{String(i + 1).padStart(2, "0")}</Text>
            <Text style={[s.td, { flex: 3 }]}>{q.statement}</Text>
            {[q.presaber, q.postsaber].map((v, j) => (
              <View key={j} style={[s.td, { flex: 1.6, flexDirection: "row", alignItems: "center", gap: 4 }]}>
                <Medidor valor={v} ancho={50} alto={4} color={j ? C.cian : "#9CCFE8"} />
                <Text style={{ fontFamily: "Courier", fontSize: 7.5, color: v !== null && v < 60 ? C.rojo : C.ink }}>{v !== null ? `${v}%` : "—"}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
      <Text style={{ fontSize: 7, color: C.muted, marginTop: 5 }}>En rojo, preguntas con menos de 60% de acierto: candidatas a reforzar en la siguiente jornada.</Text>
    </Seccion>
  );
}

function Jornadas({ ctx }: { ctx: ContextoInforme | null }) {
  if (!ctx || ctx.jornadas.length === 0) return null;
  const MOD: Record<string, string> = { VIRTUAL: "Virtual", PRESENCIAL: "Presencial", MIXTA: "Mixta" };
  const EST: Record<string, string> = { DRAFT: "Borrador", OPEN: "Abierta", CLOSED: "Cerrada" };
  return (
    <Seccion n="05" titulo={`Jornadas dictadas · ${ctx.jornadas.length}`}>
      <View style={s.tabla}>
        <View style={[s.tr, { backgroundColor: C.pista }]}>
          <Text style={[s.th, { flex: 1.4 }]}>Fecha</Text>
          <Text style={[s.th, { flex: 1.4 }]}>Horario</Text>
          <Text style={[s.th, { flex: 1 }]}>Modalidad</Text>
          <Text style={[s.th, { flex: 0.9 }]}>Estado</Text>
          <Text style={[s.th, { flex: 0.8 }]}>Asist.</Text>
          <Text style={[s.th, { flex: 0.7 }]}>Pre</Text>
          <Text style={[s.th, { flex: 0.7 }]}>Post</Text>
          <Text style={[s.th, { flex: 0.8 }]}>Invit.</Text>
        </View>
        {ctx.jornadas.map((j, i) => (
          <View key={i} style={[s.tr, i % 2 ? s.trCebra : {}]} wrap={false}>
            <Text style={[s.td, { flex: 1.4 }]}>{fecha(j.inicio)}</Text>
            <Text style={[s.td, s.mono, { flex: 1.4 }]}>
              {FMT_HORA.format(j.inicio)}
              {j.fin ? ` – ${FMT_HORA.format(j.fin)}` : ""}
            </Text>
            <Text style={[s.td, { flex: 1 }]}>{MOD[j.modalidad] ?? j.modalidad}</Text>
            <Text style={[s.td, { flex: 0.9 }]}>{EST[j.estado] ?? j.estado}</Text>
            <Text style={[s.td, s.mono, { flex: 0.8 }]}>{j.asistentes}</Text>
            <Text style={[s.td, s.mono, { flex: 0.7 }]}>{j.presaber}</Text>
            <Text style={[s.td, s.mono, { flex: 0.7 }]}>{j.postsaber}</Text>
            <Text style={[s.td, s.mono, { flex: 0.8 }]}>{j.invitados}</Text>
          </View>
        ))}
      </View>
      <Text style={{ fontSize: 7, color: C.muted, marginTop: 5 }}>
        Cada jornada tiene sus propios enlaces y QR: asistentes, presaber, postsaber e invitados son lo registrado por los enlaces de esa jornada.
      </Text>
    </Seccion>
  );
}

function Externos({ data, ctx }: { data: ActivityReportData; ctx: ContextoInforme | null }) {
  if (data.externos.length === 0) return null;
  const minutos = new Map((ctx?.permanencia ?? []).filter((p) => p.externo).map((p) => [normal(p.nombre), p.minutos]));
  return (
    <Seccion n="09" titulo={`Participantes externos · ${data.externos.length}`}>
      <View style={s.tabla}>
        <View style={[s.tr, { backgroundColor: C.pista }]} fixed>
          <Text style={[s.th, { flex: 2.2 }]}>Nombre</Text>
          <Text style={[s.th, { flex: 1.8 }]}>Entidad / cargo</Text>
          <Text style={[s.th, { flex: 1 }]}>Permanencia</Text>
          <Text style={[s.th, { flex: 0.7 }]}>Pre</Text>
          <Text style={[s.th, { flex: 0.7 }]}>Post</Text>
        </View>
        {data.externos.map((e, i) => (
          <View key={i} style={[s.tr, i % 2 ? s.trCebra : {}]} wrap={false}>
            <Text style={[s.td, { flex: 2.2 }]}>{e.fullName}</Text>
            <Text style={[s.td, { flex: 1.8 }]}>{e.company}</Text>
            <Text style={[s.td, s.mono, { flex: 1 }]}>{minutos.has(normal(e.fullName)) ? `${minutos.get(normal(e.fullName))} min` : "—"}</Text>
            <Text style={[s.td, s.mono, { flex: 0.7 }]}>{e.presaber !== null ? `${e.presaber}%` : "—"}</Text>
            <Text style={[s.td, s.mono, { flex: 0.7 }]}>{e.postsaber !== null ? `${e.postsaber}%` : "—"}</Text>
          </View>
        ))}
      </View>
      <Text style={{ fontSize: 7, color: C.muted, marginTop: 5 }}>
        Población externa registrada por el enlace de invitados de cada jornada: no se mezcla con la adherencia del personal propio.
      </Text>
    </Seccion>
  );
}

function EncuestasYEvidencias({ data, evidencia }: { data: ActivityReportData; evidencia?: EvidenciaJornada }) {
  const docs = evidencia?.documentos ?? [];
  return (
    <Seccion n="10" titulo="Anexos · encuestas y documentos">
      {data.encuestas.length > 0 && (
        <View style={{ gap: 8, marginBottom: 10 }}>
          {data.encuestas.map((e, i) => (
            <View key={i} style={{ borderWidth: 1, borderColor: C.borde, borderRadius: 6, padding: 9 }} wrap={false}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 9, fontWeight: 700 }}>{e.titulo}</Text>
                  <Text style={{ fontSize: 7.5, color: C.muted, marginTop: 1 }}>{e.respuestas} {e.respuestas === 1 ? "respuesta" : "respuestas"}</Text>
                </View>
                {[
                  ["Favorable", e.satisfaccion?.favorable !== null && e.satisfaccion?.favorable !== undefined ? `${e.satisfaccion.favorable}%` : "—"],
                  ["Escala", e.satisfaccion?.promedioEscala !== null && e.satisfaccion?.promedioEscala !== undefined ? `${e.satisfaccion.promedioEscala} / ${e.satisfaccion.escalaMax ?? 5}` : "—"],
                ].map(([k, v]) => (
                  <View key={k} style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontFamily: "Courier", fontSize: 12, fontWeight: 700 }}>{v}</Text>
                    <Text style={[s.etiquetaMono, { fontSize: 5.8 }]}>{k}</Text>
                  </View>
                ))}
              </View>
              {!!e.satisfaccion?.comentarios.length && (
                <View style={{ marginTop: 6, borderTopWidth: 1, borderTopColor: C.borde, paddingTop: 5 }}>
                  <Text style={[s.etiquetaMono, { fontSize: 6 }]}>Comentarios</Text>
                  {e.satisfaccion.comentarios.map((c, j) => (
                    <Text key={j} style={{ fontSize: 7.8, color: C.ink, marginTop: 2 }}>· {c}</Text>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
      )}
      {docs.length === 0 ? (
        <Text style={s.vacio}>Sin archivos adjuntos. La grabación y los soportes se archivan en los documentos de la capacitación.</Text>
      ) : (
        <View style={s.tabla}>
          <View style={[s.tr, { backgroundColor: C.pista }]}>
            <Text style={[s.th, { flex: 3 }]}>Archivo</Text>
            <Text style={[s.th, { flex: 0.8 }]}>Tipo</Text>
            <Text style={[s.th, { flex: 0.8 }]}>Tamaño</Text>
            <Text style={[s.th, { flex: 1 }]}>Archivado</Text>
          </View>
          {docs.map((d, i) => (
            <View key={i} style={[s.tr, i % 2 ? s.trCebra : {}]} wrap={false}>
              <Text style={[s.td, { flex: 3 }]}>
                {d.esGrabacion ? "Grabación · " : ""}
                {d.nombre}
              </Text>
              <Text style={[s.td, s.mono, { flex: 0.8 }]}>{d.esGrabacion ? "VIDEO" : d.tipo.split("/").pop()?.toUpperCase() ?? "—"}</Text>
              <Text style={[s.td, s.mono, { flex: 0.8 }]}>{d.tamanoMB > 0 ? `${d.tamanoMB} MB` : "<0.1 MB"}</Text>
              <Text style={[s.td, { flex: 1 }]}>{fecha(d.subidoEl)}</Text>
            </View>
          ))}
        </View>
      )}
    </Seccion>
  );
}

function Pie({ ctx }: { ctx: ContextoInforme | null }) {
  return (
    <View style={s.pie} fixed>
      <Text style={[s.etiquetaMono, { fontSize: 6.5 }]}>Red Salud Casanare E.S.E. · RedSalud Te Forma · {ctx?.codigo ?? "Informe de jornada"}</Text>
      <Text style={[s.etiquetaMono, { fontSize: 6.5 }]} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
    </View>
  );
}

function ActivityReportDocument({
  data,
  generatedBy,
  evidencia,
  contexto,
}: {
  data: ActivityReportData;
  generatedBy: string;
  evidencia?: EvidenciaJornada;
  contexto: ContextoInforme | null;
}) {
  return (
    <Document title={`Informe de jornada · ${tituloLegible(data.titulo)}`} author="RedSalud Te Forma" subject={data.plan}>
      <Page size="A4" style={s.page}>
        <Membrete data={data} ctx={contexto} generadoPor={generatedBy} />
        <IndicadoresPrincipales data={data} ctx={contexto} />
        <FranjaMetricas data={data} ctx={contexto} />
        <LecturaRapida data={data} ctx={contexto} />
        <Graficos data={data} ctx={contexto} />
        <Pie ctx={contexto} />
      </Page>
      <Page size="A4" style={[s.page, { paddingTop: 28 }]}>
        <View style={s.cuerpo}>
          <Text style={[s.etiquetaMono, { color: C.cian }]}>Ficha, plan de acción y anexos · {tituloLegible(data.titulo)}</Text>
          <FichaPic data={data} />
          <PlanDeAccion data={data} ctx={contexto} />
          <Jornadas ctx={contexto} />
          <Asistencia data={data} ctx={contexto} />
          <Personas data={data} />
          <PorPregunta data={data} />
          <Externos data={data} ctx={contexto} />
          <EncuestasYEvidencias data={data} evidencia={evidencia} />
        </View>
        <Pie ctx={contexto} />
      </Page>
    </Document>
  );
}

export async function renderActivityReportPdf(
  data: ActivityReportData,
  generatedBy: string,
  evidencia?: EvidenciaJornada,
  contexto: ContextoInforme | null = null
): Promise<Buffer> {
  return renderToBuffer(<ActivityReportDocument data={data} generatedBy={generatedBy} evidencia={evidencia} contexto={contexto} />);
}
