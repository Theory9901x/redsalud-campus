import type { SurveyQuestionType } from "@prisma/client";

/**
 * La CONFIGURACIÓN de cada pregunta, que en base de datos vive como JSON.
 *
 * Está aquí y no repartida en columnas porque cada tipo necesita cosas
 * distintas y añadir un tipo no debería costar una migración: es lo que dejó
 * clavado al modelo anterior en cuatro tipos durante todo el proyecto.
 */
export type OpcionPregunta = {
  id: string;
  texto: string;
  /** Solo IMAGE_CHOICE. */
  imagenUrl?: string;
  /**
   * PRESENTACIÓN (encuestas externas de cara al usuario, como la SIAU).
   * `tono` colorea la opción según lo que significa -no según su posición-,
   * `ayuda` es la frase de lectura bajo la carita (no se persiste) e
   * `icono` es el nombre del icono lucide de la tarjeta de servicio.
   */
  tono?: TonoOpcion;
  ayuda?: string;
  icono?: string;
};

/** Semántica de una opción: manda el color y la carita, nunca la posición. */
export type TonoOpcion = "exc" | "bue" | "reg" | "mal" | "muymal" | "na";

/**
 * Cómo se PINTA una pregunta en el formulario público. Sin estilo se usa la
 * presentación estándar del módulo; con él, la versión de cara al usuario
 * externo (tarjetas con icono, caritas, semáforo…). Son solo hints de
 * presentación: la respuesta guardada es la misma en ambos casos.
 */
export type EstiloPregunta =
  | "habeas"    // puerta de consentimiento: NO cierra sin guardar nada
  | "servicios" // tarjetas con icono, una por servicio
  | "caritas"   // E/B/R/M como caritas grandes con frase de ayuda
  | "matriz"    // fila de calificación E/B/R/M/NA de un perfil del personal
  | "tarjetas"  // opciones literales en tarjetas de dos columnas con color por tono
  | "semaforo"  // tres opciones verde/amarillo/rojo con borde izquierdo
  | "sexo"      // dos botones grandes M/F
  | "selector"; // lista desplegable (municipio, EPS)

export type GrupoRelacion = {
  id: string;
  titulo: string;
  subtitulo?: string;
  /** Color de marca del grupo, para que la pantalla de relacionar se lea de un vistazo. */
  color?: string;
};

export type ConfigPregunta = {
  /** SINGLE_CHOICE · MULTIPLE_CHOICE · YES_NO · IMAGE_CHOICE */
  opciones?: OpcionPregunta[];
  /** MULTIPLE_CHOICE: tope de selecciones (sin límite si falta). */
  maxSelecciones?: number;

  /** SCALE */
  escalaMin?: number;
  escalaMax?: number;
  /** Presentación: botones numéricos (defecto) o puntuación por estrellas. */
  escalaEstilo?: "numeros" | "estrellas";
  etiquetaMin?: string;
  etiquetaMax?: string;

  /** NUMBER */
  minimo?: number;
  maximo?: number;
  unidad?: string;

  /** MATCHING: los elementos se arrastran a los grupos. */
  grupos?: GrupoRelacion[];

  /**
   * CLAVE DE RESPUESTA. Una pregunta entra al puntaje SOLO si trae
   * `opcionCorrectaId`; sin eso queda fuera del cálculo por completo.
   * Nunca se asume una respuesta correcta por defecto: si el documento
   * fuente no la define, se deja sin clave en vez de adivinarla.
   */
  opcionCorrectaId?: string;
  puntos?: number;

  // ---- presentación de cara al usuario externo (solo hints) ----
  estilo?: EstiloPregunta;
  /**
   * Papel del dato en la ficha: `nombre` se usa como nombre de quien
   * responde (y el formulario ya no lo pide aparte), `fecha` nace con el día
   * de hoy, `otro` es el "¿cuál?" que solo aparece si en la pregunta anterior
   * se eligió la opción cuyo texto empieza por "Otro".
   */
  rol?: "nombre" | "telefono" | "fecha" | "eps" | "municipio" | "otro";
  /** Avanzar solo 500 ms después de elegir (preguntas de una sola elección). */
  autoAvanzar?: boolean;
  /** Tope de caracteres del texto libre. */
  maxLen?: number;
  /**
   * `matriz`: servicios (texto literal de P1) en los que este perfil atiende.
   * El formulario sube y resalta las filas del servicio elegido; las demás
   * quedan plegadas bajo "Otro personal que lo atendió".
   */
  servicios?: string[];
  /** `matriz`: perfil transversal (facturación, vigilancia, servicios generales): siempre visible. */
  transversal?: boolean;
};

/** ¿La encuesta se pinta con la presentación de cara al usuario externo? */
export function esPresentacionExterna(pages: { questions: { config: unknown }[] }[]): boolean {
  return pages.some((p) => p.questions.some((q) => Boolean(leerConfig(q.config).estilo)));
}

/** Lo que el navegador manda como respuesta, según el tipo. */
export type ValorRespuesta =
  | { tipo: "texto"; texto: string }
  | { tipo: "opcion"; opcionId: string }
  | { tipo: "opciones"; opcionIds: string[] }
  | { tipo: "escala"; valor: number }
  | { tipo: "numero"; valor: number }
  | { tipo: "fecha"; valor: string }
  | { tipo: "relacion"; pares: { elementoId: string; grupoId: string }[] };

export const ETIQUETA_TIPO: Record<SurveyQuestionType, string> = {
  SHORT_TEXT: "Texto corto",
  LONG_TEXT: "Texto largo",
  SINGLE_CHOICE: "Selección única",
  MULTIPLE_CHOICE: "Selección múltiple",
  YES_NO: "Sí / No",
  SCALE: "Escala",
  NUMBER: "Número",
  DATE: "Fecha",
  IMAGE_CHOICE: "Opciones con imagen",
  MATCHING: "Relacionar",
};

/** Tipos que se responden eligiendo entre opciones. */
export const TIPOS_DE_OPCION: SurveyQuestionType[] = [
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "YES_NO",
  "IMAGE_CHOICE",
];

export function esTipoDeOpcion(tipo: SurveyQuestionType) {
  return TIPOS_DE_OPCION.includes(tipo);
}

/** Puede llevar clave de respuesta: solo tiene sentido donde hay UNA correcta. */
export function admiteClave(tipo: SurveyQuestionType) {
  return tipo === "SINGLE_CHOICE" || tipo === "YES_NO" || tipo === "IMAGE_CHOICE";
}

export function leerConfig(config: unknown): ConfigPregunta {
  return (config ?? {}) as ConfigPregunta;
}

/**
 * Quita del `config` todo lo que revelaría la respuesta correcta.
 *
 * Se aplica SIEMPRE antes de mandar una encuesta al navegador de quien la
 * responde: sin esto, la clave viaja en el HTML y cualquiera con la consola
 * abierta saca el 100 %.
 */
export function configSinClave(config: unknown): ConfigPregunta {
  const { opcionCorrectaId: _clave, puntos: _puntos, ...resto } = leerConfig(config);
  return resto;
}
