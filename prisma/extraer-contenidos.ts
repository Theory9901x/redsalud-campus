/**
 * Extrae las evaluaciones que envían las áreas (.docx) a datos estructurados.
 *
 * Las áreas mandan la evaluación en Word, con la respuesta correcta marcada
 * de dos formas distintas según quién la escriba:
 *
 *   - SUBRAYANDO la opción correcta (SIAU).
 *   - Escribiendo "Respuesta correcta: B" debajo (Talento Humano).
 *
 * Se soportan las dos, y el resultado se versiona como JSON para que la
 * siembra sea reproducible y, sobre todo, REVISABLE: la clave de respuestas
 * de una evaluación institucional no puede quedar escondida dentro de un
 * script.
 *
 *   node --env-file=.env node_modules/tsx/dist/cli.mjs prisma/extraer-contenidos.ts "<carpeta drive-download>"
 */
import path from "node:path";
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { leerParrafosDocx } from "../lib/docx";

const LETRAS = ["A", "B", "C", "D", "E", "F"] as const;

export type OpcionExtraida = { letra: string; texto: string; correcta: boolean };
export type PreguntaExtraida = { numero: number; enunciado: string; opciones: OpcionExtraida[] };
export type EvaluacionExtraida = {
  archivo: string;
  titulo: string;
  /** Cómo venía marcada la respuesta correcta en el documento original. */
  fuenteClave: "SUBRAYADO" | "TEXTO_EXPLICITO";
  preguntas: PreguntaExtraida[];
};

const RE_PREGUNTA = /^(\d{1,2})[.)]\s*(.+)$/;
const RE_OPCION = /^([A-F])[.)]\s*(.+)$/;
const RE_CLAVE = /^respuesta\s+correcta\s*[:.]?\s*([A-F])\b/i;

function normalizar(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function extraer(ruta: string): EvaluacionExtraida {
  const parrafos = leerParrafosDocx(readFileSync(ruta));

  const preguntas: PreguntaExtraida[] = [];
  let actual: PreguntaExtraida | null = null;
  let titulo = "";
  let huboSubrayado = false;
  let huboClaveExplicita = false;

  for (const parrafo of parrafos) {
    const linea = normalizar(parrafo.texto);

    const clave = linea.match(RE_CLAVE);
    if (clave && actual) {
      huboClaveExplicita = true;
      const letra = clave[1].toUpperCase();
      for (const o of actual.opciones) o.correcta = o.letra === letra;
      continue;
    }

    const opcion = linea.match(RE_OPCION);
    if (opcion && actual) {
      // Subrayado: puede cubrir toda la opción o solo parte de ella; con que
      // haya algo subrayado dentro basta para señalarla.
      const marcada = normalizar(parrafo.subrayado).length > 0;
      if (marcada) huboSubrayado = true;
      actual.opciones.push({ letra: opcion[1].toUpperCase(), texto: normalizar(opcion[2]), correcta: marcada });
      continue;
    }

    const pregunta = linea.match(RE_PREGUNTA);
    if (pregunta) {
      actual = { numero: Number(pregunta[1]), enunciado: normalizar(pregunta[2]), opciones: [] };
      preguntas.push(actual);
      continue;
    }

    // Todo lo anterior a la primera pregunta es encabezado del documento.
    if (!actual && linea.length > 3) titulo = titulo ? `${titulo} — ${linea}` : linea;
  }

  return {
    archivo: path.basename(ruta),
    titulo,
    fuenteClave: huboClaveExplicita && !huboSubrayado ? "TEXTO_EXPLICITO" : "SUBRAYADO",
    preguntas,
  };
}

function buscarDocx(raiz: string): string[] {
  const salida: string[] = [];
  const recorrer = (dir: string) => {
    for (const entrada of readdirSync(dir)) {
      const completa = path.join(dir, entrada);
      if (statSync(completa).isDirectory()) recorrer(completa);
      else if (entrada.toLowerCase().endsWith(".docx") && !entrada.startsWith("~$")) salida.push(completa);
    }
  };
  recorrer(raiz);
  return salida.sort();
}

function main() {
  const raiz = process.argv[2];
  if (!raiz) {
    console.error('Uso: … prisma/extraer-contenidos.ts "<carpeta con los .docx>"');
    process.exit(1);
  }

  const evaluaciones = buscarDocx(raiz).map(extraer);

  let problemas = 0;
  for (const e of evaluaciones) {
    const sinClave = e.preguntas.filter((p) => !p.opciones.some((o) => o.correcta));
    const multiples = e.preguntas.filter((p) => p.opciones.filter((o) => o.correcta).length > 1);
    const sinOpciones = e.preguntas.filter((p) => p.opciones.length < 2);

    console.log(`\n${e.archivo}`);
    console.log(`  ${e.preguntas.length} preguntas · clave por ${e.fuenteClave}`);
    console.log(
      `  respuestas: ${e.preguntas
        .map((p) => p.opciones.find((o) => o.correcta)?.letra ?? "?")
        .join(" ")}`
    );
    for (const [etiqueta, lista] of [
      ["SIN respuesta marcada", sinClave],
      ["con VARIAS marcadas", multiples],
      ["con menos de 2 opciones", sinOpciones],
    ] as const) {
      if (lista.length > 0) {
        problemas += lista.length;
        console.log(`  ⚠ ${lista.length} ${etiqueta}: ${lista.map((p) => p.numero).join(", ")}`);
      }
    }
    if (e.preguntas.some((p) => p.opciones.length !== LETRAS.slice(0, p.opciones.length).length)) problemas++;
  }

  const destino = path.join(process.cwd(), "prisma", "data", "evaluaciones-areas.json");
  writeFileSync(destino, JSON.stringify({ extraidoEl: new Date().toISOString().slice(0, 10), evaluaciones }, null, 2), "utf8");
  console.log(`\nEscrito en ${destino}`);
  if (problemas > 0) {
    console.log(`\n${problemas} preguntas necesitan revisión humana antes de sembrar.`);
    process.exit(2);
  }
}

main();
