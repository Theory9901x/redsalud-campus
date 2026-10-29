import type { CertificateLayout } from "@/lib/certificate-template";

export const REDSALUD_CERTIFICATE_BACKGROUND_URL = "/uploads/plantillas/fondo/constancia-redsalud-v4-20261029.png";

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
  const rosette = Array.from({ length: 80 }, (_, i) => {
    const angle = i * Math.PI / 40;
    const radius = i % 2 ? 76 : 81;
    return `${(624 + radius * Math.cos(angle)).toFixed(2)},${(694 + radius * Math.sin(angle)).toFixed(2)}`;
  }).join(" ");
  const waves = Array.from({ length: 13 }, (_, n) => {
    const points = Array.from({ length: 31 }, (_, i) => {
      const x = 1060 + i * 6;
      const y = 255 + n * 11 + Math.sin(i / 8) * 72;
      return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(" ");
    return `<path d="${points}" fill="none" stroke="#008AC0" stroke-width="0.65" opacity="0.1"/>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="2526" height="1786" viewBox="0 0 1200 848.456">
  <defs>
    <linearGradient id="blue" x1="0" y1="0" x2="1" y2="0.5"><stop stop-color="#062E4D"/><stop offset="0.55" stop-color="#005D94"/><stop offset="1" stop-color="#009AC7"/></linearGradient>
    <linearGradient id="cyan" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#0079BE"/><stop offset="1" stop-color="#28D5DF"/></linearGradient>
    <linearGradient id="green" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#147C49"/><stop offset="1" stop-color="#6EC747"/></linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#9C6818"/><stop offset="0.25" stop-color="#EFC566"/><stop offset="0.5" stop-color="#FFF0B6"/><stop offset="0.75" stop-color="#D4A343"/><stop offset="1" stop-color="#AE7929"/></linearGradient>
    <linearGradient id="course" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#EFF9FD" stop-opacity="0"/><stop offset="0.5" stop-color="#EAF7FE"/><stop offset="1" stop-color="#EFF9FD" stop-opacity="0"/></linearGradient>
    <pattern id="dots" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="0.9" fill="#FFFFFF" opacity="0.14"/></pattern>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="#002E4F" flood-opacity="0.1"/></filter>
  </defs>
  <rect width="1200" height="848.456" fill="white"/>
  <path d="M0 0H1200V193C911 161 737 214 475 201C264 192 140 206 0 184Z" fill="url(#blue)"/>
  <path d="M0 174C180 203 333 173 503 192S902 182 1200 172V199C932 189 771 223 502 209S153 215 0 194Z" fill="url(#cyan)"/>
  <path d="M730 202C924 171 1079 156 1200 169V181C1043 172 906 190 730 209Z" fill="url(#green)"/>
  <path d="M878 190C1024 165 1121 163 1200 169" fill="none" stroke="#F4C448" stroke-width="4"/>
  <path d="M1029 169C1100 160 1159 162 1200 169" fill="none" stroke="#E74639" stroke-width="3"/>
  <path d="M843 0H1200V167C1030 124 947 77 843 0Z" fill="url(#dots)"/>
  <circle cx="1160" cy="-10" r="162" fill="none" stroke="#FFFFFF" stroke-opacity="0.08" stroke-width="36"/>
  <circle cx="1160" cy="-10" r="210" fill="none" stroke="#FFFFFF" stroke-opacity="0.06" stroke-width="2"/>
  ${waves}
  <path d="M0 636C37 709 98 750 165 786H0Z" fill="#E6F5FB"/>
  <path d="M0 687C22 734 84 775 142 803H0Z" fill="url(#cyan)"/>
  <path d="M0 737C30 764 72 783 117 805H0Z" fill="url(#green)"/>
  <path d="M0 758C21 778 55 792 81 802" fill="none" stroke="#F7CB51" stroke-width="6"/>
  <path d="M0 780C27 795 54 805 72 811" fill="none" stroke="#E5443C" stroke-width="4"/>
  <path d="M0 786H1200V848.456H0Z" fill="url(#blue)"/>
  <path d="M0 844H740" stroke="#00A5D1" stroke-width="8"/>
  <path d="M740 844H1000" stroke="#3DA94A" stroke-width="8"/>
  <path d="M1000 844H1130" stroke="#F4C448" stroke-width="8"/>
  <path d="M1130 844H1200" stroke="#DE3440" stroke-width="8"/>
  <rect x="17" y="17" width="1166" height="814.456" rx="10" fill="none" stroke="#E1C278" stroke-width="1.2"/>
  <rect x="24" y="24" width="1152" height="800.456" rx="7" fill="none" stroke="#A9D7EC" stroke-width="0.55"/>
  <rect x="50" y="38" width="175" height="157" rx="14" fill="white" filter="url(#shadow)"/>
  <image x="62" y="47" width="151" height="139" preserveAspectRatio="xMidYMid meet" xlink:href="${logoDataUri}"/>
  <g font-family="Arial, Helvetica, sans-serif">
    <text x="259" y="80" font-size="12" letter-spacing="2.5" font-weight="700" fill="#8FE6ED">RED SALUD CASANARE E.S.E.</text>
    <text x="257" y="127" font-size="36" font-weight="700" fill="#FFFFFF">Constancia de formación</text>
    <text x="259" y="154" font-size="13" fill="#D1E8F3">Desarrollo del talento humano · Formación institucional</text>
    <image x="720" y="232" width="430" height="395" opacity="0.065" preserveAspectRatio="xMidYMid meet" xlink:href="${logoDataUri}"/>
    <text transform="translate(45 600) rotate(-90)" font-size="6" letter-spacing="1.5" fill="#76A3B7">REDSALUD · TALENTO HUMANO · FORMACIÓN INSTITUCIONAL</text>
    <rect x="419" y="216" width="362" height="33" rx="16.5" fill="#EDF8FC" stroke="#CDE8F2" stroke-width="0.7"/>
    <text x="600" y="236" text-anchor="middle" font-size="12.5" letter-spacing="4" font-weight="700" fill="#0079AD">DA CONSTANCIA DE QUE</text>
    <path d="M542 308H602" stroke="#008EC3" stroke-width="3"/>
    <path d="M606 308H633" stroke="#39A64B" stroke-width="3"/>
    <path d="M637 308H650" stroke="#E9B947" stroke-width="3"/>
    <path d="M654 308H661" stroke="#DD3D45" stroke-width="3"/>
    <rect x="210" y="414" width="780" height="59" rx="29.5" fill="url(#course)"/>
    <rect x="144" y="509" width="288" height="78" rx="9" fill="#EDF8FE" stroke="#C7E6F5" stroke-width="0.8"/>
    <rect x="456" y="509" width="288" height="78" rx="9" fill="#EEF8F0" stroke="#D1E9D4" stroke-width="0.8"/>
    <rect x="768" y="509" width="288" height="78" rx="9" fill="#FFF8E9" stroke="#EDDFBD" stroke-width="0.8"/>
    <path d="M157 509H419" stroke="#0094CA" stroke-width="3"/>
    <path d="M469 509H731" stroke="#38A34A" stroke-width="3"/>
    <path d="M781 509H1043" stroke="#E9B947" stroke-width="3"/>
    <g fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <g stroke="#2797BC"><circle cx="406" cy="534" r="10"/><path d="M406 528V534L410 537"/></g>
      <g stroke="#439759"><rect x="708" y="525" width="19" height="18" rx="3"/><path d="M708 531H727M713 523V528M722 523V528M713 536H717M720 536H722"/></g>
      <g stroke="#BE9138"><path d="M1028 543C1028 543 1020 536 1020 531A8 8 0 0 1 1036 531C1036 536 1028 543 1028 543Z"/><circle cx="1028" cy="531" r="2.6"/></g>
    </g>
    <g font-size="10" letter-spacing="1.5" font-weight="700" fill="#0079AD">
      <text x="162" y="534">INTENSIDAD HORARIA</text>
      <text x="474" y="534">FECHA DE EXPEDICIÓN</text>
      <text x="786" y="534">LUGAR DE EXPEDICIÓN</text>
    </g>
    <path d="M134 713H466" stroke="#123A56" stroke-width="1"/>
    <path d="M590 742L578 786L604 777L620 789L631 747Z" fill="#00669F"/>
    <path d="M631 747L646 789L660 776L681 782L660 739Z" fill="url(#gold)"/>
    <polygon points="${rosette}" fill="url(#gold)" stroke="#C49841" stroke-width="0.6"/>
    <circle cx="624" cy="694" r="73" fill="#FFFFFF"/>
    <g fill="none" stroke="#0079AD">
      <circle cx="624" cy="694" r="72" stroke-width="2"/>
      <circle cx="624" cy="694" r="67" stroke-width="0.9"/>
      <circle cx="624" cy="694" r="49" stroke-width="0.7" stroke-dasharray="1.1 2.3"/>
    </g>
    <g fill="#0079AD" font-weight="700" font-size="7.7">
      ${arcText("RED SALUD CASANARE E.S.E.", 202, 338)}
      ${arcText("FORMACIÓN INSTITUCIONAL", 158, 22, true)}
    </g>
    <circle cx="565" cy="694" r="2.1" fill="#35A144"/><circle cx="683" cy="694" r="2.1" fill="#35A144"/>
    <image x="592" y="654" width="64" height="59" preserveAspectRatio="xMidYMid meet" xlink:href="${logoDataUri}"/>
    <text x="624" y="728" text-anchor="middle" font-size="7.2" font-weight="700" letter-spacing="1" fill="#0079AD">TALENTO HUMANO</text>
    <rect x="916" y="601" width="156" height="183" rx="12" fill="#FFFFFF" stroke="#D1E4ED" stroke-width="0.8" filter="url(#shadow)"/>
    <path d="M927 628V616H939M1049 616H1061V628M927 736V748H939M1049 748H1061V736" fill="none" stroke="#0092C3" stroke-width="2"/>
    <text x="994" y="613" text-anchor="middle" font-size="8" letter-spacing="1.05" font-weight="700" fill="#0079AD">VALIDACIÓN EN LÍNEA</text>
    <text x="259" y="811" font-size="10" font-weight="700" fill="#FFFFFF">Salud y vida para el llano</text>
    <text x="1129" y="811" text-anchor="end" font-size="9" fill="#D0ECF7">campusvirtual.redsaludteforma.com</text>
  </g>
</svg>`;
}
