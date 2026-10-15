import { TrendingUp, Layers, Users2, type LucideIcon } from "lucide-react";
import { UMBRAL_AMARILLO, UMBRAL_VERDE, type Semaforo } from "@/lib/semaforo-indicadores";

/**
 * CATÁLOGO ESTÁTICO de los indicadores del PIC: identidad, ficha técnica,
 * variables de la fórmula y cómo se formatea el resultado.
 *
 * Sin nada de base de datos a propósito: lo importan tanto las páginas de
 * servidor como los componentes de cliente (pestañas, gráficas). El cálculo
 * vive en lib/plan-indicadores.ts y la lectura para gestión en
 * lib/indicadores-gestion.ts; aquí solo está lo que no cambia.
 */

export const CODIGOS = ["PIC-ADH-01", "PIC-COB-02", "PIC-ASI-03"] as const;
export type CodigoIndicador = (typeof CODIGOS)[number];

export function esCodigo(x: string): x is CodigoIndicador {
  return (CODIGOS as readonly string[]).includes(x);
}

export const ROMANO = ["I", "II", "III", "IV"] as const;
export const MESES_TRIMESTRE = ["ene–mar", "abr–jun", "jul–sep", "oct–dic"] as const;

/** Una variable de la fórmula, con la letra con que aparece en ella. */
export type VariableFormula = { simbolo: string; nombre: string; descripcion: string };

export type FichaTecnica = {
  codigo: CodigoIndicador;
  nombre: string;
  corto: string;
  principal: boolean;
  Icono: LucideIcon;
  /** Tono propio del indicador (oklch), para la aurora y el acento de su ficha. */
  tono: { a: string; b: string };
  resumen: string;
  objetivo: string;
  formula: string;
  variables: VariableFormula[];
  unidad: string;
  fuente: string;
  periodicidad: string;
  responsable: string;
  alcance: string;
  /** Etiquetas de las dos variables que se muestran junto a cada medición. */
  columnas: [string, string];
  /** La meta institucional en lenguaje del indicador. */
  meta: string;
  tendenciaDeseada: "ascendente";
};

const SEMAFORIZACION = [
  { sem: "verde" as const, etiqueta: "Cumple", rango: `≥ ${UMBRAL_VERDE}` },
  { sem: "amarillo" as const, etiqueta: "En alerta", rango: `${UMBRAL_AMARILLO} – ${UMBRAL_VERDE - 0.1}` },
  { sem: "rojo" as const, etiqueta: "Crítico", rango: `< ${UMBRAL_AMARILLO}` },
] as const;

export function rangosSemaforo(unidad: string) {
  return SEMAFORIZACION.map((r) => ({ ...r, rango: `${r.rango} ${unidad}` }));
}

export const VEREDICTO: Record<Semaforo, string> = {
  verde: "Cumple",
  amarillo: "En alerta",
  rojo: "Crítico",
  "sin-datos": "Sin datos",
};

export const CATALOGO: Record<CodigoIndicador, FichaTecnica> = {
  "PIC-ADH-01": {
    codigo: "PIC-ADH-01",
    nombre: "Adherencia institucional del conocimiento",
    corto: "Adherencia",
    principal: true,
    Icono: TrendingUp,
    tono: { a: "oklch(0.62 0.13 230)", b: "oklch(0.7 0.12 200)" },
    resumen: "Cuánto mejora el conocimiento del personal entre el presaber y el postsaber.",
    objetivo:
      "Medir la apropiación real del conocimiento impartido: la mejora de cada persona entre su evaluación previa (presaber) y su evaluación posterior (postsaber) a la capacitación.",
    formula: "((Promedio postsaber − Promedio presaber) ÷ Promedio presaber) × 100, calculada POR PERSONA y luego promediada sobre quienes tienen ambos intentos completos.",
    variables: [
      { simbolo: "Post", nombre: "Promedio postsaber", descripcion: "Nota de la evaluación posterior a la capacitación, por persona." },
      { simbolo: "Pre", nombre: "Promedio presaber", descripcion: "Nota de la evaluación previa, por persona. Debe ser mayor que cero: sin línea base no hay comparación." },
      { simbolo: "n", nombre: "Personas con ciclo completo", descripcion: "Quienes tienen ambos intentos en jornadas CERRADAS." },
    ],
    unidad: "pp",
    fuente:
      "Intentos de evaluación con momento presaber/postsaber, congelados al crear cada intento. En jornadas cerradas se lee del informe congelado del acta: el histórico no cambia aunque se toquen registros después.",
    periodicidad:
      "Cálculo automático y en tiempo real, con corte trimestral según la programación del PIC. Una jornada entra al indicador cuando su responsable la CIERRA; no requiere ningún registro manual.",
    responsable: "Talento Humano (líder del PIC). La medición la hace la plataforma.",
    alcance: "Institucional, con desagregación por área y por trimestre según la programación del PIC.",
    columnas: ["Jornadas cerradas", "Personas"],
    meta: `Mejora promedio ≥ ${UMBRAL_VERDE} pp entre presaber y postsaber.`,
    tendenciaDeseada: "ascendente",
  },
  "PIC-COB-02": {
    codigo: "PIC-COB-02",
    nombre: "Cobertura de contenido del PIC",
    corto: "Cobertura",
    principal: false,
    Icono: Layers,
    tono: { a: "oklch(0.55 0.16 270)", b: "oklch(0.66 0.13 250)" },
    resumen: "Qué proporción de las líneas del plan ya tiene su curso montado en la plataforma.",
    objetivo:
      "Vigilar que cada capacitación programada en el PIC tenga su contenido (presentación y evaluación) publicado y disponible para el personal.",
    formula: "(Líneas del PIC con curso vinculado ÷ Total de líneas del PIC) × 100.",
    variables: [
      { simbolo: "C", nombre: "Líneas con contenido", descripcion: "Capacitaciones del PIC con un curso vinculado." },
      { simbolo: "T", nombre: "Total de líneas", descripcion: "Capacitaciones programadas en el PIC para el corte." },
    ],
    unidad: "%",
    fuente: "Vínculo actividad → curso de cada línea del plan. Sin registro manual.",
    periodicidad: "Cálculo automático y en tiempo real, con corte trimestral: cambia al montar o desvincular contenido.",
    responsable: "Cada área responde por sus líneas; Talento Humano consolida.",
    alcance: "Institucional, con desagregación por área y por trimestre.",
    columnas: ["Programadas", "Con contenido"],
    meta: `≥ ${UMBRAL_VERDE} % de las líneas con curso montado.`,
    tendenciaDeseada: "ascendente",
  },
  "PIC-ASI-03": {
    codigo: "PIC-ASI-03",
    nombre: "Asistencia efectiva",
    corto: "Asistencia",
    principal: false,
    Icono: Users2,
    tono: { a: "oklch(0.6 0.13 170)", b: "oklch(0.7 0.12 150)" },
    resumen: "Cuántas de las convocatorias del plan terminan en una asistencia registrada.",
    objetivo:
      "Medir la participación real del personal convocado: quién efectivamente llegó a cada capacitación, frente a la audiencia objetivo que el plan define para esa línea.",
    formula: "(Asistencias registradas ÷ Convocatorias) × 100, donde cada convocatoria es un par persona × capacitación según la audiencia objetivo de la línea.",
    variables: [
      { simbolo: "A", nombre: "Asistencias registradas", descripcion: "Registros de asistencia (automáticos o manuales) en el corte." },
      { simbolo: "K", nombre: "Convocatorias", descripcion: "Pares persona × capacitación según la audiencia objetivo. No son personas distintas." },
    ],
    unidad: "%",
    fuente: "Registro de asistencia automático (entrar a la sala o presentar la evaluación lo deja solo) y manual del área cuando aplica.",
    periodicidad: "Cálculo automático y en tiempo real, con corte trimestral, con cada asistencia que se registra.",
    responsable: "Cada área en su jornada; Talento Humano consolida.",
    alcance: "Institucional, con desagregación por área, actividad y trimestre.",
    columnas: ["Convocatorias", "Asistencias"],
    meta: `≥ ${UMBRAL_VERDE} % de las convocatorias con asistencia registrada.`,
    tendenciaDeseada: "ascendente",
  },
};

/** Resultado ya formateado en la unidad del indicador. */
export function formatearValor(codigo: CodigoIndicador, valor: number | null): string {
  if (valor === null) return "—";
  if (codigo === "PIC-ADH-01") return `${valor > 0 ? "+" : ""}${valor} pp`;
  return `${valor} %`;
}

export const ESTADO_MEJORA = {
  ABIERTO: "Abierto",
  EN_CURSO: "En curso",
  CERRADO: "Cerrado",
  VENCIDO: "Vencido",
} as const;
export type EstadoMejoraVisible = keyof typeof ESTADO_MEJORA;
