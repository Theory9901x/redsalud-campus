import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { Document, Page, View, Text, Image, StyleSheet, Font, renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { publicUploadDiskPath } from "@/lib/storage";
import type { SesionReunion } from "@/lib/reuniones";

/**
 * ACTA DE REUNIÓN (PDF) de una sesión de una reunión abierta: membrete,
 * datos de la sesión, cifras de asistencia, orden del día, desarrollo,
 * compromisos, lista de asistencia (nombre, cargo, hora de registro y
 * permanencia real en la llamada) y firmas. Mismo lenguaje visual que el
 * informe de jornada.
 */
Font.registerHyphenationCallback((palabra) => [palabra]);

const C = {
  navy: "#0F2438", navy2: "#163A5A", cian: "#2BA6DE", ink: "#0F2438", muted: "#5B7184",
  sutil: "#94A3B3", borde: "#E2E8F0", pista: "#EEF2F6", fondo: "#F7F9FB", blanco: "#FFFFFF",
};

const s = StyleSheet.create({
  page: { paddingBottom: 46, fontSize: 9, color: C.ink, fontFamily: "Helvetica" },
  cuerpo: { paddingHorizontal: 32 },
  etiqueta: { fontFamily: "Courier", fontSize: 6.8, letterSpacing: 1.1, textTransform: "uppercase", color: C.muted },
  seccion: { marginTop: 16 },
  cab: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 7 },
  num: { fontFamily: "Courier", fontSize: 8, color: C.cian, fontWeight: 700 },
  titulo: { fontSize: 11.5, fontWeight: 700 },
  linea: { flex: 1, height: 1, backgroundColor: C.borde, marginLeft: 6 },
  parrafo: { fontSize: 9, lineHeight: 1.5, color: C.ink },
  vacio: { fontSize: 8.5, color: C.muted, fontStyle: "italic" },
  tabla: { borderWidth: 1, borderColor: C.borde, borderRadius: 6, overflow: "hidden" },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.borde, alignItems: "center" },
  th: { paddingVertical: 5, paddingHorizontal: 6, fontFamily: "Courier", fontSize: 6.6, letterSpacing: 0.8, textTransform: "uppercase", color: C.muted, fontWeight: 700 },
  td: { paddingVertical: 5, paddingHorizontal: 6, fontSize: 8.3 },
  pie: { position: "absolute", bottom: 18, left: 32, right: 32, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: C.borde, paddingTop: 6 },
});

const FECHA = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "America/Bogota" });
const HORA = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });
const CORTA = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Bogota" });

function Seccion({ n, titulo, children }: { n: string; titulo: string; children: React.ReactNode }) {
  return (
    <View style={s.seccion}>
      <View style={s.cab} minPresenceAhead={50}>
        <Text style={s.num}>{n}</Text>
        <Text style={s.titulo}>{titulo}</Text>
        <View style={s.linea} />
      </View>
      {children}
    </View>
  );
}

function Acta({ d, codigo, logo, institucion, generadoPor }: { d: SesionReunion; codigo: string; logo: string | null; institucion: string; generadoPor: string }) {
  const j = d.jornada;
  const datos: [string, string][] = [
    ["Fecha", j ? FECHA.format(j.startsAt) : "—"],
    ["Hora", j ? `${HORA.format(j.startsAt)}${j.endsAt ? ` – ${HORA.format(j.endsAt)}` : ""}` : "—"],
    ["Modalidad", "Virtual · sala integrada RedSalud Te Forma"],
    ["Responsable", d.responsable ?? "—"],
    ["Dirigida a", d.dirigidoA ?? "—"],
    ["Estado", d.estado === "CLOSED" ? `Cerrada${d.cerradaEl ? ` el ${CORTA.format(d.cerradaEl)}` : ""}` : "Abierta"],
  ];
  const cifras: [string, string][] = [
    [String(d.resumen.registrados), "Asistentes"],
    [String(d.resumen.conectados), "En la sala"],
    [`${d.resumen.permanenciaPromedio} min`, "Permanencia prom."],
    [d.resumen.minutosTotales >= 60 ? `${Math.floor(d.resumen.minutosTotales / 60)}h ${d.resumen.minutosTotales % 60}m` : `${d.resumen.minutosTotales}m`, "Tiempo total"],
  ];
  return (
    <Document title={`Acta · ${d.titulo}`} author="RedSalud Te Forma">
      <Page size="A4" style={s.page}>
        {/* Membrete */}
        <View style={{ backgroundColor: C.navy, paddingHorizontal: 32, paddingTop: 22, paddingBottom: 18 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de react-pdf: no admite alt */}
              {logo && <Image src={logo} style={{ width: 26, height: 26, objectFit: "contain" }} />}
              <View>
                <Text style={{ fontSize: 8.5, fontWeight: 700, color: C.blanco }}>{institucion}</Text>
                <Text style={{ fontFamily: "Courier", fontSize: 6.8, letterSpacing: 1.4, color: "#8FC9E8" }}>ACTA DE REUNIÓN</Text>
              </View>
            </View>
            <Text style={{ fontFamily: "Courier", fontSize: 7.5, color: "#8FC9E8", letterSpacing: 1 }}>{codigo}</Text>
          </View>
          <Text style={{ fontFamily: "Courier", fontSize: 7, color: "#8FC9E8", letterSpacing: 1.4, marginTop: 14 }}>{d.reunion.titulo.toUpperCase()}</Text>
          <Text style={{ fontSize: 16, fontWeight: 700, color: C.blanco, marginTop: 4, lineHeight: 1.2 }}>{d.titulo}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 10 }}>
            {datos.map(([k, v]) => (
              <View key={k} style={{ maxWidth: 240 }}>
                <Text style={{ fontFamily: "Courier", fontSize: 6.3, color: "#7FA3BF", letterSpacing: 1, textTransform: "uppercase" }}>{k}</Text>
                <Text style={{ fontSize: 8, color: C.blanco, marginTop: 1 }}>{v}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={s.cuerpo}>
          {/* Cifras */}
          <View style={{ flexDirection: "row", borderWidth: 1, borderColor: C.borde, borderRadius: 8, marginTop: 14 }}>
            {cifras.map(([v, k], i) => (
              <View key={k} style={{ flex: 1, paddingVertical: 8, paddingHorizontal: 8, borderLeftWidth: i === 0 ? 0 : 1, borderLeftColor: C.borde }}>
                <Text style={{ fontFamily: "Courier", fontSize: 13, fontWeight: 700 }}>{v}</Text>
                <Text style={[s.etiqueta, { fontSize: 6, marginTop: 3 }]}>{k}</Text>
              </View>
            ))}
          </View>

          <Seccion n="01" titulo="Objetivo">
            <Text style={d.objetivo ? s.parrafo : s.vacio}>{d.objetivo || "Sin objetivo registrado."}</Text>
          </Seccion>

          <Seccion n="02" titulo="Orden del día">
            {d.reunion.ordenDelDia.length === 0 ? (
              <Text style={s.vacio}>Sin orden del día registrado.</Text>
            ) : (
              d.reunion.ordenDelDia.map((p, i) => (
                <View key={i} style={{ flexDirection: "row", gap: 6, marginBottom: 3 }}>
                  <Text style={{ fontFamily: "Courier", fontSize: 8, color: C.cian, width: 14 }}>{String(i + 1).padStart(2, "0")}</Text>
                  <Text style={[s.parrafo, { flex: 1 }]}>{p.replace(/^\d+[.)]\s*/, "")}</Text>
                </View>
              ))
            )}
          </Seccion>

          <Seccion n="03" titulo="Desarrollo de la sesión">
            <Text style={d.desarrollo ? s.parrafo : s.vacio}>{d.desarrollo || "Sin desarrollo registrado."}</Text>
          </Seccion>

          <Seccion n="04" titulo="Compromisos">
            {d.compromisos.length === 0 ? (
              <Text style={s.vacio}>Sin compromisos registrados.</Text>
            ) : (
              <View style={s.tabla}>
                <View style={[s.tr, { backgroundColor: C.pista }]}>
                  <Text style={[s.th, { width: 24 }]}>#</Text>
                  <Text style={[s.th, { flex: 1 }]}>Compromiso</Text>
                </View>
                {d.compromisos.map((c, i) => (
                  <View key={i} style={[s.tr, i % 2 ? { backgroundColor: C.fondo } : {}]} wrap={false}>
                    <Text style={[s.td, { width: 24, fontFamily: "Courier", color: C.sutil }]}>{String(i + 1).padStart(2, "0")}</Text>
                    <Text style={[s.td, { flex: 1 }]}>{c}</Text>
                  </View>
                ))}
              </View>
            )}
          </Seccion>

          <Seccion n="05" titulo={`Asistencia · ${d.asistentes.length}`}>
            {d.asistentes.length === 0 ? (
              <Text style={s.vacio}>Sin registros de asistencia.</Text>
            ) : (
              <View style={s.tabla}>
                <View style={[s.tr, { backgroundColor: C.pista }]} fixed>
                  <Text style={[s.th, { width: 24 }]}>#</Text>
                  <Text style={[s.th, { flex: 2.4 }]}>Nombre</Text>
                  <Text style={[s.th, { flex: 2 }]}>Cargo</Text>
                  <Text style={[s.th, { flex: 1.1 }]}>Registro</Text>
                  <Text style={[s.th, { flex: 1 }]}>Permanencia</Text>
                </View>
                {d.asistentes.map((a, i) => (
                  <View key={a.clave} style={[s.tr, i % 2 ? { backgroundColor: C.fondo } : {}]} wrap={false}>
                    <Text style={[s.td, { width: 24, fontFamily: "Courier", color: C.sutil }]}>{String(i + 1).padStart(2, "0")}</Text>
                    <Text style={[s.td, { flex: 2.4 }]}>{a.nombre}</Text>
                    <Text style={[s.td, { flex: 2 }]}>{a.cargo}</Text>
                    <Text style={[s.td, { flex: 1.1, fontFamily: "Courier", fontSize: 7.6 }]}>{a.registradoEl ? HORA.format(a.registradoEl) : "—"}</Text>
                    <Text style={[s.td, { flex: 1, fontFamily: "Courier", fontSize: 7.6 }]}>{a.minutos > 0 ? `${a.minutos} min` : "—"}</Text>
                  </View>
                ))}
              </View>
            )}
            <Text style={{ fontSize: 7, color: C.muted, marginTop: 5 }}>
              Registro electrónico por el enlace de la sesión (nombre completo y cargo). Permanencia = tiempo real conectado a la sala virtual.
            </Text>
          </Seccion>

          {/* Firmas */}
          <View style={{ flexDirection: "row", gap: 40, marginTop: 46 }} wrap={false}>
            {["Responsable de la reunión", "Secretario(a) / quien elabora el acta"].map((r) => (
              <View key={r} style={{ flex: 1 }}>
                <View style={{ borderTopWidth: 1, borderTopColor: C.ink, paddingTop: 4 }}>
                  <Text style={{ fontSize: 8.5, fontWeight: 700 }}>{r}</Text>
                  <Text style={{ fontSize: 7.5, color: C.muted, marginTop: 2 }}>Nombre, cargo y firma</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={s.pie} fixed>
          <Text style={[s.etiqueta, { fontSize: 6.3, flex: 1, paddingRight: 12 }]}>{codigo} · generado {CORTA.format(new Date())} por {generadoPor}</Text>
          <Text style={[s.etiqueta, { fontSize: 6.3, width: 80, textAlign: "right" }]} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function renderActaReunionPdf(d: SesionReunion, generadoPor: string): Promise<{ buffer: Buffer; codigo: string }> {
  const ajustes = await prisma.institutionSettings.findUnique({ where: { id: "singleton" }, select: { logoUrl: true, institutionName: true } });
  let logo: string | null = null;
  if (ajustes?.logoUrl) {
    try {
      const png = await sharp(await readFile(publicUploadDiskPath(ajustes.logoUrl))).resize(160, 160, { fit: "inside" }).png().toBuffer();
      logo = `data:image/png;base64,${png.toString("base64")}`;
    } catch {
      /* sin logo */
    }
  }
  const anio = d.jornada?.startsAt.getFullYear() ?? new Date().getFullYear();
  const codigo = `ACT-${anio}-${d.id.slice(-6).toUpperCase()}`;
  const buffer = await renderToBuffer(<Acta d={d} codigo={codigo} logo={logo} institucion={ajustes?.institutionName ?? "Red Salud Casanare E.S.E."} generadoPor={generadoPor} />);
  return { buffer, codigo };
}
