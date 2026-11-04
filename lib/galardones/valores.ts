import type { GalardonValor } from "@prisma/client";

/**
 * Las tres categorías del reconocimiento al mérito "Salud y Vida para el
 * Llano", con el texto del memorando 112.31.07.144 de Gerencia. El orden es el
 * del memorando y el del formulario.
 */
export const VALORES_GALARDON: {
  clave: GalardonValor;
  numero: number;
  nombre: string;
  definicion: string;
  comportamientos: string;
  /** Color de la categoría (matiz oklch); el CSS lo convierte en tono y resplandor. */
  matiz: number;
}[] = [
  {
    clave: "INTEGRIDAD",
    numero: 1,
    nombre: "Integridad",
    definicion:
      "Actuar con honestidad, transparencia y responsabilidad, manteniendo coherencia entre lo que se dice y lo que se hace.",
    comportamientos:
      "Se refleja en el cumplimiento de los compromisos, el cuidado de los recursos institucionales y la confianza que se genera en compañeros y usuarios.",
    matiz: 230,
  },
  {
    clave: "HUMANIZACION",
    numero: 2,
    nombre: "Humanización",
    definicion:
      "Reconocer la dignidad de cada persona y brindar un trato cálido, respetuoso y empático.",
    comportamientos:
      "Se expresa al escuchar, comprender las necesidades de los demás y ofrecer apoyo a usuarios, familias y compañeros de trabajo.",
    matiz: 165,
  },
  {
    clave: "LIDERAZGO",
    numero: 3,
    nombre: "Liderazgo",
    definicion:
      "Inspirar y orientar con el ejemplo, promoviendo la participación y el trabajo en equipo.",
    comportamientos:
      "Se demuestra al proponer soluciones, acompañar a los compañeros y motivar el logro de objetivos compartidos, independientemente del cargo que se desempeñe.",
    matiz: 75,
  },
];

export const ORDEN_VALORES: GalardonValor[] = VALORES_GALARDON.map((v) => v.clave);

export function valorInfo(clave: GalardonValor) {
  return VALORES_GALARDON.find((v) => v.clave === clave)!;
}

export const NOMBRE_RECONOCIMIENTO = "Salud y Vida para el Llano";
export const NOMBRE_EVENTO = "Noche de Galardones";
