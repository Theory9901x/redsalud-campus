/**
 * Centros IPS de Red Salud Casanare que participan en la Galardones.
 * Lista entregada por Talento Humano (3-nov-2026). Es una lista propia, no la
 * tabla Municipio: el reconocimiento se organiza por centro, y hay municipios
 * del departamento que no entran en la convocatoria.
 */
export const IPS_GALARDONES = [
  "Sácama",
  "La Salina",
  "Hato Corozal",
  "Paz de Ariporo",
  "Pore",
  "Orocué",
  "Trinidad",
  "San Luis de Palenque",
  "Támara",
  "Nunchía",
  "Yopal",
  "Maní",
  "Recetor",
  "Chámeza",
  "Monterrey",
  "Villanueva",
  "Sabanalarga",
] as const;

export type IpsGalardon = (typeof IPS_GALARDONES)[number];

/**
 * Cómo se MUESTRA cada centro. El valor guardado sigue siendo el de la lista
 * (las postulaciones ya registradas dicen "Yopal"); solo cambia el nombre en
 * pantalla. Yopal no es una IPS: es la Sede Administrativa.
 */
const NOMBRES_PANTALLA: Partial<Record<IpsGalardon, string>> = { Yopal: "Yopal - Sede Administrativa" };
export function nombreCentro(ips: string) {
  return NOMBRES_PANTALLA[ips as IpsGalardon] ?? ips;
}
export function tipoCentro(ips: string) {
  return ips === "Yopal" ? "Sede administrativa" : "IPS";
}

const sinTildes = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^la\s+/, "")
    .trim();

export function esIpsValida(valor: string): valor is IpsGalardon {
  return (IPS_GALARDONES as readonly string[]).includes(valor);
}

/** Centro IPS que corresponde a un municipio de la ficha del usuario ("NUNCHIA", "Salina"…), o null. */
export function ipsDesdeMunicipio(municipio: string | null | undefined): IpsGalardon | null {
  if (!municipio) return null;
  const m = sinTildes(municipio);
  return IPS_GALARDONES.find((ips) => sinTildes(ips) === m) ?? null;
}
