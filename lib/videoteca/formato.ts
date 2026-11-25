export function duracionTexto(seg: number | null | undefined) {
  if (!seg) return null;
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  const s = seg % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

/** Duración en palabras: "45 s", "12 min", "1 h 20 min". */
export function duracionLarga(seg: number | null | undefined) {
  if (!seg) return null;
  if (seg < 60) return `${seg} s`;
  const h = Math.floor(seg / 3600);
  const m = Math.round((seg % 3600) / 60);
  return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
}

const FECHA_CORTA = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Bogota" });
const MES = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric", timeZone: "America/Bogota" });

/** "12 nov 2026" (hora de Colombia). */
export function fechaCorta(fecha: Date) {
  return FECHA_CORTA.format(fecha).replace(/\./g, "");
}

/** "Noviembre de 2026": el título de un mes al agrupar por fecha. */
export function mesTexto(fecha: Date) {
  const t = MES.format(fecha);
  return t.charAt(0).toUpperCase() + t.slice(1);
}
