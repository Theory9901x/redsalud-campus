const PARTICULAS_NOMBRE = new Set(["de", "del", "la", "las", "los", "y", "e", "da", "van", "von"]);
const CONECTORES_TITULO = new Set([
  "de", "del", "la", "las", "el", "los", "y", "e", "o", "u", "a", "al", "en", "para", "por", "con", "sin", "sobre", "entre",
]);

function capitalizar(palabra: string): string {
  const minus = palabra.toLocaleLowerCase("es-CO");
  return minus.charAt(0).toLocaleUpperCase("es-CO") + minus.slice(1);
}

/**
 * Pone mayúscula inicial a cada palabra, salvo los conectores (en minúscula
 * cuando no van de primeros). Las palabras con mayúsculas y minúsculas
 * mezcladas ("McAllister", "Julián", "SST-Covid") se respetan tal cual.
 */
function mayusculaInicial(texto: string | null | undefined, conectores: Set<string>): string {
  if (!texto) return "";
  const palabras = texto.trim().split(/\s+/).filter(Boolean);
  return palabras
    .map((palabra, i) => {
      const minus = palabra.toLocaleLowerCase("es-CO");
      if (i > 0 && conectores.has(minus)) return minus;
      const mezclada = palabra !== minus && palabra !== palabra.toLocaleUpperCase("es-CO");
      if (mezclada) return palabra;
      // Compuestos con guion o apóstrofo: "garcia-lopez" → "Garcia-Lopez".
      return palabra.split(/([-'’])/).map((t) => (/^[-'’]$/.test(t) ? t : capitalizar(t))).join("");
    })
    .join(" ");
}

/**
 * Escribe un nombre de persona como nombre propio, sin importar cómo lo
 * digitó quien se registró:
 *   "mateo robayo moreno"      → "Mateo Robayo Moreno"
 *   "GLORIBETH CORREDOR"       → "Gloribeth Corredor"
 *   "maria DE LA cruz"         → "Maria de la Cruz"
 * Solo presentación: el dato guardado no cambia.
 */
export function nombrePropio(nombre: string | null | undefined): string {
  return mayusculaInicial(nombre, PARTICULAS_NOMBRE);
}

/**
 * Título de curso como aparece en la constancia:
 *   "Inducción y reinducción" → "Inducción y Reinducción"
 * Las siglas (palabras en MAYÚSCULAS de hasta 5 letras, p. ej. "SST", "IAMI")
 * se conservan. Solo presentación: el título guardado no cambia (hay scripts
 * que ubican cursos por su título exacto).
 */
export function tituloCurso(titulo: string | null | undefined): string {
  if (!titulo) return "";
  return titulo
    .trim()
    .split(/\s+/)
    .map((palabra, i) => {
      const letras = palabra.replace(/[^\p{L}]/gu, "");
      const esSigla = letras.length > 1 && letras.length <= 5 && letras === letras.toLocaleUpperCase("es-CO");
      if (esSigla) return palabra;
      const minus = palabra.toLocaleLowerCase("es-CO");
      if (i > 0 && CONECTORES_TITULO.has(minus)) return minus;
      return mayusculaInicial(palabra, CONECTORES_TITULO);
    })
    .join(" ");
}
