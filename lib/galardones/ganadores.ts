import type { GalardonValor } from "@prisma/client";
import type { ResultadoIps } from "@/lib/galardones/consultas";
import { ORDEN_VALORES, valorInfo } from "@/lib/galardones/valores";

/**
 * QUIÉN GANA EN CADA CENTRO. Son tres galardones por centro IPS, uno por
 * valor, y TRES PERSONAS DISTINTAS: nadie gana dos valores en el mismo
 * centro. Función pura (sin base de datos) para poder probarla.
 *
 * 1. Las decisiones de Talento Humano (desempates) se respetan primero.
 * 2. Después, valor por valor, gana la persona con más postulaciones válidas
 *    que todavía no haya ganado otro valor. Se resuelve primero el valor
 *    con el liderazgo más claro (más votos, sin empate), para que el
 *    reparto no dependa del orden en que se listan los valores.
 * 3. Si quien más votos tenía ya ganó otro valor, gana el siguiente y queda
 *    anotado (REASIGNADO), para que nadie piense que hubo un error.
 * 4. Si los primeros disponibles empatan, se devuelven todos (EMPATE) hasta
 *    que Talento Humano defina; la ceremonia no elige por nadie.
 *
 * Los nombres ya llegan agrupados: el que más se repite gana aunque se haya
 * escrito distinto.
 */

export type Persona = { id: string; nombre: string; votos: number; porcentaje: number };

export type OrigenGanador = "MAYORIA" | "REASIGNADO" | "DECISION" | "EMPATE" | "SIN_POSTULACIONES";

export type Ganador = {
  valor: GalardonValor;
  /** El ganador; con empate, todos los empatados. Vacío si nadie quedó. */
  personas: Persona[];
  empate: boolean;
  /** Postulaciones válidas del valor en el centro. */
  total: number;
  origen: OrigenGanador;
  /** Explicación corta cuando no ganó simplemente el más votado. */
  nota?: string;
};

export type Decision = { ips: string; valor: GalardonValor; candidatoId: string };

export function calcularGanadores(centro: ResultadoIps, decisiones: Decision[]): Ganador[] {
  const porValor = new Map(centro.valores.map((v) => [v.valor, v]));
  const persona = (c: { id: string; nombre: string; votos: number; porcentaje: number }): Persona => ({ id: c.id, nombre: c.nombre, votos: c.votos, porcentaje: c.porcentaje });
  const resultado = new Map<GalardonValor, Ganador>();
  const usados = new Map<string, GalardonValor>();

  // 1. Decisiones de Talento Humano.
  for (const d of decisiones) {
    if (d.ips !== centro.ips || resultado.has(d.valor)) continue;
    const v = porValor.get(d.valor);
    const c = v?.candidatos.find((x) => x.id === d.candidatoId);
    if (!v || !c || usados.has(c.id)) continue;
    resultado.set(d.valor, { valor: d.valor, personas: [persona(c)], empate: false, total: v.total, origen: "DECISION" });
    usados.set(c.id, d.valor);
  }

  // 2-4. El resto, del liderazgo más claro al más disputado.
  for (;;) {
    const pendientes = ORDEN_VALORES.filter((v) => !resultado.has(v));
    if (!pendientes.length) break;
    const opciones = pendientes.map((valor) => {
      const v = porValor.get(valor);
      const disponibles = (v?.candidatos ?? []).filter((c) => c.votos > 0 && !usados.has(c.id));
      const tope = disponibles[0]?.votos ?? 0;
      const empatados = disponibles.filter((c) => c.votos === tope);
      return { valor, v, disponibles, tope, empatados };
    });
    opciones.sort(
      (a, b) =>
        Number(a.empatados.length > 1) - Number(b.empatados.length > 1) ||
        b.tope - a.tope ||
        ORDEN_VALORES.indexOf(a.valor) - ORDEN_VALORES.indexOf(b.valor),
    );
    const { valor, v, disponibles, empatados } = opciones[0];
    const total = v?.total ?? 0;

    if (!disponibles.length) {
      const habia = (v?.candidatos ?? []).some((c) => c.votos > 0);
      resultado.set(valor, {
        valor,
        personas: [],
        empate: false,
        total,
        origen: "SIN_POSTULACIONES",
        nota: habia ? "Todas las personas postuladas en este valor ya ganaron otro" : undefined,
      });
      continue;
    }

    if (empatados.length > 1) {
      resultado.set(valor, { valor, personas: empatados.map(persona), empate: true, total, origen: "EMPATE", nota: "Empate: lo define Talento Humano" });
      // Los empatados no se reservan: si luego alguno gana otro valor, sale de aquí (ver abajo).
      continue;
    }

    const g = disponibles[0];
    const primero = v?.candidatos[0];
    const reasignado = primero && primero.id !== g.id && usados.has(primero.id);
    resultado.set(valor, {
      valor,
      personas: [persona(g)],
      empate: false,
      total,
      origen: reasignado ? "REASIGNADO" : "MAYORIA",
      nota: reasignado ? `${primero.nombre} encabezaba este valor, pero ganó en ${valorInfo(usados.get(primero.id)!).nombre}` : undefined,
    });
    usados.set(g.id, valor);
  }

  // Un empatado que terminó ganando otro valor ya no compite en el empate.
  for (const [valor, g] of resultado) {
    if (g.origen !== "EMPATE") continue;
    const quedan = g.personas.filter((p) => !usados.has(p.id) || usados.get(p.id) === valor);
    if (quedan.length === 1) {
      resultado.set(valor, { ...g, personas: quedan, empate: false, origen: "MAYORIA", nota: "Empate resuelto: la otra persona empatada ganó en otro valor" });
      usados.set(quedan[0].id, valor);
    } else if (quedan.length === 0) {
      resultado.set(valor, { ...g, personas: [], empate: false, origen: "SIN_POSTULACIONES", nota: "Las personas empatadas ganaron otros valores: lo define Talento Humano" });
    } else if (quedan.length !== g.personas.length) {
      resultado.set(valor, { ...g, personas: quedan });
    }
  }

  return ORDEN_VALORES.map((v) => resultado.get(v)!);
}
