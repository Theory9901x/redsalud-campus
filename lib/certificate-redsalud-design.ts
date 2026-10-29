import type { CertificateLayout } from "@/lib/certificate-template";

export const REDSALUD_CERTIFICATE_BACKGROUND_URL = "/uploads/plantillas/fondo/constancia-redsalud-v3-20261029.png";

/** Diseño original de RedSalud. Los datos, firma y QR siguen siendo elementos editables. */
export const REDSALUD_CERTIFICATE_LAYOUT: CertificateLayout = {
  elements: [
    { id: "nombre", type: "text", fieldKey: "nombreCompleto", x: 8, y: 31.1, widthPct: 84, fontSize: 25, fontFamily: "Helvetica-Bold", color: "#102E45", align: "center", fitToWidth: true },
    { id: "identificado", type: "static", text: "Identificado(a) con", x: 26, y: 39.1, widthPct: 23, fontSize: 10, fontFamily: "Helvetica", color: "#536C7C", align: "right" },
    { id: "tipo-documento", type: "text", fieldKey: "tipoDocumento", x: 50, y: 39.1, widthPct: 4, fontSize: 10, fontFamily: "Helvetica-Bold", color: "#102E45", align: "center" },
    { id: "numero-documento", type: "text", fieldKey: "numeroDocumento", x: 55, y: 39.1, widthPct: 20, fontSize: 10, fontFamily: "Helvetica-Bold", color: "#102E45", align: "left" },
    { id: "curso-intro", type: "static", text: "Completó satisfactoriamente el curso de", x: 12, y: 45.8, widthPct: 76, fontSize: 11, fontFamily: "Helvetica", color: "#536C7C", align: "center" },
    { id: "curso", type: "text", fieldKey: "curso", x: 10, y: 50.3, widthPct: 80, fontSize: 20, fontFamily: "Helvetica-Bold", color: "#0079AD", align: "center", fitToWidth: true },
    { id: "intensidad", type: "text", fieldKey: "intensidadHoraria", x: 13.5, y: 64, widthPct: 21, fontSize: 12, fontFamily: "Helvetica-Bold", color: "#102E45", align: "left" },
    { id: "fecha", type: "text", fieldKey: "fecha", x: 39.5, y: 64, widthPct: 23, fontSize: 11, fontFamily: "Helvetica-Bold", color: "#102E45", align: "left" },
    { id: "ciudad", type: "text", fieldKey: "ciudad", x: 65.5, y: 64, widthPct: 21, fontSize: 12, fontFamily: "Helvetica-Bold", color: "#102E45", align: "left" },
    { id: "firma", type: "image", kind: "firma", src: null, x: 12.5, y: 73.2, widthPct: 25, heightPct: 10.3 },
    { id: "cargo-firmante", type: "text", fieldKey: "cargoFirmante", x: 7.8, y: 85.5, widthPct: 34.4, fontSize: 7.6, fontFamily: "Helvetica-Bold", color: "#102E45", align: "center" },
    { id: "firma-entidad", type: "static", text: "Red Salud Casanare E.S.E.", x: 9, y: 88.2, widthPct: 32, fontSize: 8, fontFamily: "Helvetica", color: "#536C7C", align: "center" },
    { id: "qr", type: "qr", x: 78.3, y: 73.9, sizePct: 9 },
    { id: "codigo", type: "text", fieldKey: "codigo", x: 70.5, y: 88, widthPct: 24.6, fontSize: 9, fontFamily: "Helvetica-Bold", color: "#0079AD", align: "center" },
    { id: "qr-ayuda", type: "static", text: "Consulta su validez con este QR", x: 70.5, y: 90.6, widthPct: 24.6, fontSize: 7.2, fontFamily: "Helvetica", color: "#536C7C", align: "center" },
  ],
};

/** Fondo vectorial propio: colores del logo, marca de agua y sello ornamental institucional. */
export function redSaludCertificateSvg(logoDataUri: string): string {
  // Letras sobre el arco: compatible con rasterizadores SVG sin soporte de textPath.
  const arcText = (text: string, start: number, end: number, bottom = false) => [...text].map((char, i, letters) => {
    const angle = start + (end - start) * i / (letters.length - 1);
    const radians = angle * Math.PI / 180;
    const x = 624 + 60 * Math.cos(radians);
    const y = 694 + 60 * Math.sin(radians);
    const escaped = char.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    return `<text transform="translate(${x.toFixed(3)} ${y.toFixed(3)}) rotate(${angle + (bottom ? -90 : 90)})" text-anchor="middle">${escaped}</text>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="2526" height="1786" viewBox="0 0 1200 848.456">
  <defs>
    <linearGradient id="wash" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#F3FAFE"/><stop offset="1" stop-color="#FFFFFF"/></linearGradient>
    <linearGradient id="blue" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#004D7D"/><stop offset="1" stop-color="#00A1CD"/></linearGradient>
    <path id="seal-top" d="M 565,694 A 59,59 0 0,1 683,694"/>
    <path id="seal-bottom" d="M 565,694 A 59,59 0 0,0 683,694"/>
  </defs>
  <rect width="1200" height="848.456" fill="white"/>
  <path d="M780 0 H1200 V198 C1100 160 966 97 780 0Z" fill="url(#wash)"/>
  <path d="M0 690 C97 724 133 792 238 848.456 H0Z" fill="#F0F8FC"/>
  <path d="M955 0 H1200 V70 C1110 55 1046 38 955 0Z" fill="#EAF6ED"/>
  <path d="M1090 0 H1200 V33Z" fill="#2F9E42"/>
  <path d="M0 780 V848.456 H112Z" fill="url(#blue)"/>
  <rect x="24" y="24" width="1152" height="800.456" rx="9" fill="none" stroke="#123A56" stroke-width="1.4"/>
  <rect x="31" y="31" width="1138" height="786.456" rx="5" fill="none" stroke="#D5E7F0" stroke-width="0.7"/>
  <path d="M66 24H150" stroke="#008ECC" stroke-width="4"/>
  <path d="M155 24H185" stroke="#34A13C" stroke-width="4"/>
  <path d="M190 24H209" stroke="#F6BD00" stroke-width="4"/>
  <path d="M214 24H229" stroke="#D90D21" stroke-width="4"/>
  <image x="62" y="47" width="151" height="139" preserveAspectRatio="xMidYMid meet" xlink:href="${logoDataUri}"/>
  <g font-family="Arial, Helvetica, sans-serif">
    <text x="259" y="80" font-size="12" letter-spacing="2.5" font-weight="700" fill="#0079AD">RED SALUD CASANARE E.S.E.</text>
    <text x="257" y="127" font-size="36" font-weight="700" fill="#102E45">Constancia de formación</text>
    <text x="259" y="154" font-size="13" fill="#536C7C">Desarrollo del talento humano · Formación institucional</text>
    <path d="M259 179 H1129" stroke="#D8E7ED" stroke-width="1"/>
    <path d="M259 179 H335" stroke="#0095C7" stroke-width="2.5"/>
    <image x="720" y="232" width="430" height="395" opacity="0.045" preserveAspectRatio="xMidYMid meet" xlink:href="${logoDataUri}"/>
    <text x="600" y="236" text-anchor="middle" font-size="12.5" letter-spacing="4" font-weight="700" fill="#0079AD">DA CONSTANCIA DE QUE</text>
    <path d="M562 308H638" stroke="#38A34A" stroke-width="2.5"/>
    <g fill="#F5F9FC" stroke="#DCE9F0" stroke-width="0.8">
      <rect x="144" y="509" width="288" height="78" rx="9"/>
      <rect x="456" y="509" width="288" height="78" rx="9"/>
      <rect x="768" y="509" width="288" height="78" rx="9"/>
    </g>
    <g font-size="10" letter-spacing="1.5" font-weight="700" fill="#0079AD">
      <text x="162" y="534">INTENSIDAD HORARIA</text>
      <text x="474" y="534">FECHA DE EXPEDICIÓN</text>
      <text x="786" y="534">LUGAR DE EXPEDICIÓN</text>
    </g>
    <path d="M134 713H466" stroke="#123A56" stroke-width="1"/>
    <g fill="none" stroke="#0079AD">
      <circle cx="624" cy="694" r="72" stroke-width="1.5"/>
      <circle cx="624" cy="694" r="67" stroke-width="0.7"/>
      <circle cx="624" cy="694" r="49" stroke-width="0.7" stroke-dasharray="1.1 2.3"/>
    </g>
    <g fill="#0079AD" font-weight="700" font-size="7.7">
      ${arcText("RED SALUD CASANARE E.S.E.", 202, 338)}
      ${arcText("FORMACIÓN INSTITUCIONAL", 158, 22, true)}
    </g>
    <circle cx="565" cy="694" r="2.1" fill="#35A144"/><circle cx="683" cy="694" r="2.1" fill="#35A144"/>
    <image x="592" y="654" width="64" height="59" preserveAspectRatio="xMidYMid meet" xlink:href="${logoDataUri}"/>
    <text x="624" y="728" text-anchor="middle" font-size="7.2" font-weight="700" letter-spacing="1" fill="#0079AD">TALENTO HUMANO</text>
    <text x="994" y="614" text-anchor="middle" font-size="9" letter-spacing="1.2" font-weight="700" fill="#0079AD">VALIDACIÓN EN LÍNEA</text>
    <path d="M259 790H1129" stroke="#E2ECF1" stroke-width="0.8"/>
    <text x="259" y="807" font-size="9" fill="#536C7C">Salud y vida para el llano</text>
    <text x="1129" y="807" text-anchor="end" font-size="9" fill="#536C7C">campusvirtual.redsaludteforma.com</text>
  </g>
</svg>`;
}
