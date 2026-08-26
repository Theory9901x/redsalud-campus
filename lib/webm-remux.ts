import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const ejecutar = promisify(execFile);

/**
 * Repara la cabecera de un WebM grabado con MediaRecorder.
 *
 * MediaRecorder escribe el archivo mientras graba, así que cuando empieza no
 * sabe cuánto va a durar: deja el Segment con tamaño desconocido, sin
 * Duration y sin índice de búsqueda. El resultado se REPRODUCE bien, pero el
 * navegador muestra 0:00 como duración total y no deja saltar a un punto
 * concreto hasta haber descargado el archivo entero -inservible para revisar
 * una jornada de una hora-.
 *
 * `ffmpeg -c copy` reescribe el contenedor con la duración y el índice ya
 * calculados. NO recodifica: copia las pistas tal cual, así que no hay
 * pérdida de calidad y el costo es de lectura y escritura, no de CPU (una
 * grabación de 36 KB creció 279 bytes; una de una hora crece unos pocos KB).
 *
 * Si ffmpeg no está o falla, devuelve el original: una grabación con la
 * cabecera imperfecta sigue siendo la evidencia de la jornada, y perderla por
 * un paso de acabado sería mucho peor que mostrar mal la duración.
 */
export async function repararDuracionWebm(entrada: Buffer): Promise<Buffer> {
  let carpeta: string | null = null;
  try {
    carpeta = await mkdtemp(path.join(tmpdir(), "grabacion-"));
    const origen = path.join(carpeta, "origen.webm");
    const destino = path.join(carpeta, "destino.webm");
    await writeFile(origen, entrada);

    await ejecutar("ffmpeg", ["-v", "error", "-i", origen, "-c", "copy", "-y", destino], {
      timeout: 5 * 60 * 1000,
      maxBuffer: 1024 * 1024,
    });

    const salida = await readFile(destino);
    // Una salida vacía o absurdamente pequeña significa que ffmpeg escribió
    // algo roto: en ese caso el original es la mejor versión que existe.
    return salida.byteLength > 1024 ? salida : entrada;
  } catch (error) {
    console.error("No se pudo reparar la cabecera de la grabación; se archiva tal cual.", error);
    return entrada;
  } finally {
    if (carpeta) await rm(carpeta, { recursive: true, force: true }).catch(() => {});
  }
}
