import { leerConfig, type ValorRespuesta } from "@/lib/encuestas/tipos";

/**
 * MOTOR DE PUNTAJE de las encuestas que además califican (evaluaciones de
 * conocimiento sobre guías, por ejemplo).
 *
 * Regla única y deliberada: una pregunta entra al cálculo SOLO si su
 * configuración trae `opcionCorrectaId`. Una pregunta sin clave -porque el
 * documento fuente no la definía, o porque es de opinión- se queda fuera del
 * puntaje entera, en vez de asumirle una respuesta correcta. Así una
 * encuesta de satisfacción pura simplemente no tiene puntaje, sin necesidad
 * de marcarla de ninguna forma especial.
 *
 * Sin dependencias de base de datos a propósito: lo usan el envío (para
 * congelar el puntaje de una respuesta) y el panel de resultados (para
 * agregar el de todas), y también corre en el navegador.
 */

export type PreguntaPuntuable = {
  id: string;
  config: unknown;
};

export type BloquePuntuable = {
  id: string;
  title: string;
  questions: PreguntaPuntuable[];
};

export type PuntajeBloque = {
  pageId: string;
  titulo: string;
  obtenido: number;
  posible: number;
  porcentaje: number;
};

export type PuntajeRespuesta = {
  obtenido: number;
  posible: number;
  porcentaje: number | null;
  porBloque: PuntajeBloque[];
};

/** Null si la pregunta no califica. */
export function calificarPregunta(
  pregunta: PreguntaPuntuable,
  valor: ValorRespuesta | undefined
): { acierta: boolean; obtenido: number; posible: number } | null {
  const config = leerConfig(pregunta.config);
  if (!config.opcionCorrectaId) return null;

  const posible = Number(config.puntos) || 0;
  const elegida = valor?.tipo === "opcion" ? valor.opcionId : undefined;
  const acierta = !!elegida && String(elegida) === String(config.opcionCorrectaId);
  return { acierta, obtenido: acierta ? posible : 0, posible };
}

/** ¿Esta encuesta califica en absoluto? */
export function tienePreguntasCalificadas(bloques: BloquePuntuable[]) {
  return bloques.some((b) => b.questions.some((q) => !!leerConfig(q.config).opcionCorrectaId));
}

/** El puntaje de UNA respuesta, con su desglose por bloque. */
export function calcularPuntaje(
  bloques: BloquePuntuable[],
  valorPorPregunta: Map<string, ValorRespuesta>
): PuntajeRespuesta {
  const porBloque: PuntajeBloque[] = [];
  let obtenido = 0;
  let posible = 0;

  for (const bloque of bloques) {
    let bObtenido = 0;
    let bPosible = 0;
    for (const pregunta of bloque.questions) {
      const resultado = calificarPregunta(pregunta, valorPorPregunta.get(pregunta.id));
      if (!resultado) continue;
      bObtenido += resultado.obtenido;
      bPosible += resultado.posible;
    }
    if (bPosible > 0) {
      porBloque.push({
        pageId: bloque.id,
        titulo: bloque.title,
        obtenido: bObtenido,
        posible: bPosible,
        porcentaje: Math.round((bObtenido / bPosible) * 100),
      });
    }
    obtenido += bObtenido;
    posible += bPosible;
  }

  return {
    obtenido,
    posible,
    porcentaje: posible > 0 ? Math.round((obtenido / posible) * 100) : null,
    porBloque,
  };
}

/**
 * Agrega VARIAS respuestas: suma puntos ganados y posibles de todas, no
 * promedia porcentajes. Promediar promedios daría el mismo peso a quien
 * contestó dos preguntas que a quien contestó veinte.
 */
export function agregarPuntajes(
  bloques: BloquePuntuable[],
  valoresPorRespuesta: Map<string, Map<string, ValorRespuesta>>
): PuntajeRespuesta & { respuestasCalificadas: number } {
  const acumPorBloque = new Map<string, PuntajeBloque>();
  let obtenido = 0;
  let posible = 0;
  let respuestasCalificadas = 0;

  for (const valores of valoresPorRespuesta.values()) {
    const puntaje = calcularPuntaje(bloques, valores);
    if (puntaje.posible === 0) continue;
    respuestasCalificadas++;
    obtenido += puntaje.obtenido;
    posible += puntaje.posible;
    for (const b of puntaje.porBloque) {
      const previo = acumPorBloque.get(b.pageId) ?? {
        pageId: b.pageId,
        titulo: b.titulo,
        obtenido: 0,
        posible: 0,
        porcentaje: 0,
      };
      previo.obtenido += b.obtenido;
      previo.posible += b.posible;
      acumPorBloque.set(b.pageId, previo);
    }
  }

  return {
    obtenido,
    posible,
    porcentaje: posible > 0 ? Math.round((obtenido / posible) * 100) : null,
    porBloque: [...acumPorBloque.values()].map((b) => ({
      ...b,
      porcentaje: Math.round((b.obtenido / b.posible) * 100),
    })),
    respuestasCalificadas,
  };
}
