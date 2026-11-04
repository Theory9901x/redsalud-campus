/**
 * Agrupación de nombres de persona escritos a mano.
 *
 * Quien postula escribe el nombre como le sale: "Fabian Bolivar", "Bolívar
 * Boyacá Fabián David", "fabian d. bolibar". Todas esas postulaciones deben
 * contar para la MISMA persona. Aquí se decide cuándo dos nombres son la
 * misma persona, sin base de datos: solo texto.
 *
 * Regla (mismaPersona):
 *  1. Se normaliza: sin tildes, minúsculas, solo letras, sin partículas
 *     ("de", "del", "la"…). Si los textos normalizados son iguales, listo.
 *  2. Se comparan como CONJUNTOS de tokens (el orden no importa: en Colombia
 *     se escribe igual "nombre apellido" que "apellido nombre"). Un token
 *     coincide con otro si es igual, si es una inicial del otro ("d" ~ "david")
 *     o si se parecen mucho (Jaro-Winkler ≥ 0,88: "bolibar" ~ "bolivar").
 *  3. Son la misma persona si coinciden al menos 2 tokens y esos cubren al
 *     menos dos tercios del nombre más corto. Así "Fabian Bolivar" cuenta
 *     para "Fabian David Bolivar Boyaca", pero "Fabian Perez" no.
 *
 * Un nombre de una sola palabra solo agrupa por igualdad exacta: "Fabián" a
 * secas es demasiado ambiguo para sumarlo a nadie.
 *
 * Es una heurística: puede juntar a dos personas distintas que compartan dos
 * nombres, o separar a una misma persona escrita de dos formas muy
 * distintas. Por eso los resultados muestran los nombres tal como se
 * escribieron y Talento Humano puede fusionar o separar candidatos.
 */

const PARTICULAS = new Set(["de", "del", "la", "las", "los", "y", "e", "da", "van", "von", "el"]);

export function tokensNombre(nombre: string): string[] {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !PARTICULAS.has(t));
}

/** Clave normalizada para guardar y comparar: tokens ordenados alfabéticamente. */
export function claveNombre(nombre: string): string {
  return [...tokensNombre(nombre)].sort().join(" ");
}

export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const ventana = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const am = new Array<boolean>(a.length).fill(false);
  const bm = new Array<boolean>(b.length).fill(false);
  let coincidencias = 0;
  for (let i = 0; i < a.length; i++) {
    const desde = Math.max(0, i - ventana);
    const hasta = Math.min(b.length - 1, i + ventana);
    for (let j = desde; j <= hasta; j++) {
      if (bm[j] || a[i] !== b[j]) continue;
      am[i] = bm[j] = true;
      coincidencias++;
      break;
    }
  }
  if (!coincidencias) return 0;
  let transposiciones = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!am[i]) continue;
    while (!bm[k]) k++;
    if (a[i] !== b[k]) transposiciones++;
    k++;
  }
  const jaro = (coincidencias / a.length + coincidencias / b.length + (coincidencias - transposiciones / 2) / coincidencias) / 3;
  let prefijo = 0;
  while (prefijo < Math.min(4, a.length, b.length) && a[prefijo] === b[prefijo]) prefijo++;
  return jaro + prefijo * 0.1 * (1 - jaro);
}

const UMBRAL_TOKEN = 0.88;

function tokensCoinciden(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length === 1 || b.length === 1) return a[0] === b[0];
  return jaroWinkler(a, b) >= UMBRAL_TOKEN;
}

/** Cuántos tokens de `a` encuentran pareja en `b` (cada token de `b` se usa una vez). */
function tokensEmparejados(a: string[], b: string[]): number {
  const usados = new Set<number>();
  let n = 0;
  for (const ta of a) {
    let mejor = -1;
    let mejorPuntaje = 0;
    for (let j = 0; j < b.length; j++) {
      if (usados.has(j) || !tokensCoinciden(ta, b[j])) continue;
      const puntaje = ta === b[j] ? 2 : 1;
      if (puntaje > mejorPuntaje) {
        mejorPuntaje = puntaje;
        mejor = j;
      }
    }
    if (mejor >= 0) {
      usados.add(mejor);
      n++;
    }
  }
  return n;
}

export function mismaPersona(nombreA: string, nombreB: string): boolean {
  const a = tokensNombre(nombreA);
  const b = tokensNombre(nombreB);
  if (!a.length || !b.length) return false;
  if ([...a].sort().join(" ") === [...b].sort().join(" ")) return true;
  const corto = Math.min(a.length, b.length);
  if (corto < 2) return false;
  const m = tokensEmparejados(a.length <= b.length ? a : b, a.length <= b.length ? b : a);
  return m >= 2 && m / corto >= 0.66;
}
