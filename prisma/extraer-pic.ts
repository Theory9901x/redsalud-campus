/**
 * Extrae el Plan Institucional de Capacitaciones desde el Excel de Talento
 * Humano y lo deja como JSON dentro del repo.
 *
 * El Excel vive en el escritorio de quien administra, no en el repositorio.
 * Sembrar leyéndolo directamente haría que la siembra solo funcionara en ese
 * equipo. Se extrae una vez, se versiona el JSON, y de ahí en adelante la
 * siembra es reproducible en cualquier parte.
 *
 *   npx tsx prisma/extraer-pic.ts "C:/ruta/CRONOGRAMA DE CAPACITACIONES 2026.xlsx"
 *
 * Nada aquí inventa datos: lo que la hoja no dice, queda nulo.
 */
import path from "node:path";
import { writeFileSync } from "node:fs";
import * as XLSX from "xlsx";

const COL = { area: 0, actividad: 1, objetivo: 2, metodologia: 3, dirigidoA: 4, cupo: 5, responsable: 6, t1: 7, seguimiento: 11 };
const PRIMERA_FILA = 4; // 0-3 son título y encabezados de dos niveles

export type ActividadPIC = {
  area: string;
  titulo: string;
  objetivo: string | null;
  metodologia: string | null;
  dirigidoA: string | null;
  /** Texto tal cual del Excel: casi siempre "DATO DE CADA IPS", es decir, no hay cifra. */
  cupoTexto: string | null;
  /** Cifra solo cuando la hoja trae un número; si dice "DATO DE CADA IPS", es null. */
  cupo: number | null;
  /** Rol responsable como texto ("Profesional Lider PAI"): no es un usuario de la plataforma. */
  responsable: string | null;
  /** Trimestres marcados con X. Una actividad puede repetirse en varios. */
  trimestres: number[];
  /** Evidencias exigidas por el PIC ("Registro de asistencia", "Informe de capacitación"…). */
  seguimiento: string[];
  /** Modalidades que menciona la metodología. Derivado, no inventado. */
  modalidades: ("VIRTUAL" | "PRESENCIAL")[];
  filaExcel: number;
};

const limpiar = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();

/**
 * Varias filas meten varias capacitaciones en una sola celda, separadas por
 * salto de línea y a veces numeradas ("1. …", "2. …"). Cada una es un tema
 * distinto, con su propia presentación y su propia evaluación, así que se
 * separan en actividades independientes.
 */
function separarTemas(celda: string): string[] {
  return celda
    .split(/\r?\n/)
    .map((linea) => linea.replace(/^\s*\d+\s*[.)-]\s*/, "").trim())
    .filter((linea) => linea.length > 0);
}

/** "1. Registro de asistencia. 2.Registro fotografico 3.Informe" -> tres evidencias. */
function separarSeguimiento(celda: string): string[] {
  if (!celda) return [];
  return celda
    .split(/\s*\d+\s*[.)]\s*/)
    .map((t) => t.replace(/\s+/g, " ").replace(/[.\s]+$/, "").trim())
    .filter((t) => t.length > 2);
}

function main() {
  const rutaExcel = process.argv[2];
  if (!rutaExcel) {
    console.error('Uso: npx tsx prisma/extraer-pic.ts "<ruta al .xlsx>"');
    process.exit(1);
  }

  const hoja = XLSX.readFile(rutaExcel).Sheets[XLSX.readFile(rutaExcel).SheetNames[0]];
  const filas: string[][] = XLSX.utils.sheet_to_json(hoja, { header: 1, raw: false, defval: "" });

  const actividades: ActividadPIC[] = [];
  let area = "";

  for (let i = PRIMERA_FILA; i < filas.length; i++) {
    const fila = filas[i] ?? [];
    const areaCelda = limpiar(fila[COL.area]);
    if (areaCelda) area = areaCelda; // celdas combinadas: el área se arrastra hacia abajo

    const celdaActividad = String(fila[COL.actividad] ?? "");
    if (!celdaActividad.trim()) continue;
    if (/^fuente\s*:/i.test(limpiar(celdaActividad))) continue; // pie de página

    const objetivo = limpiar(fila[COL.objetivo]) || null;
    const metodologia = limpiar(fila[COL.metodologia]) || null;

    // "Evaluación del Desempeño" ocupa una fila sola, sin objetivo ni
    // responsable: es un subtítulo del bloque de Talento Humano, no una
    // capacitación.
    if (!objetivo && !metodologia && !limpiar(fila[COL.responsable])) continue;

    const trimestres = [0, 1, 2, 3].map((n) => (limpiar(fila[COL.t1 + n]).toUpperCase() === "X" ? n + 1 : 0)).filter(Boolean);

    const cupoTexto = limpiar(fila[COL.cupo]) || null;
    const soloDigitos = cupoTexto && /^\d+$/.test(cupoTexto) ? Number(cupoTexto) : null;

    const metodologiaMayus = (metodologia ?? "").toUpperCase();
    const modalidades: ("VIRTUAL" | "PRESENCIAL")[] = [];
    if (metodologiaMayus.includes("VIRTUAL")) modalidades.push("VIRTUAL");
    if (metodologiaMayus.includes("PRESENCIAL")) modalidades.push("PRESENCIAL");

    for (const titulo of separarTemas(celdaActividad)) {
      actividades.push({
        area,
        titulo,
        objetivo,
        metodologia,
        dirigidoA: limpiar(fila[COL.dirigidoA]) || null,
        cupoTexto,
        cupo: soloDigitos,
        responsable: limpiar(fila[COL.responsable]) || null,
        trimestres,
        seguimiento: separarSeguimiento(limpiar(fila[COL.seguimiento])),
        modalidades,
        filaExcel: i + 1, // 1-based, como se ve en Excel
      });
    }
  }

  const areas = [...new Set(actividades.map((a) => a.area))];
  const salida = {
    origen: path.basename(rutaExcel),
    extraidoEl: new Date().toISOString().slice(0, 10),
    anio: 2026,
    areas,
    actividades,
  };

  const destino = path.join(process.cwd(), "prisma", "data", "pic-2026.json");
  writeFileSync(destino, JSON.stringify(salida, null, 2), "utf8");

  console.log(`Áreas: ${areas.length} · Actividades: ${actividades.length}`);
  for (const a of areas) {
    console.log(`  ${String(actividades.filter((x) => x.area === a).length).padStart(2)} · ${a}`);
  }
  console.log(`\nEscrito en ${destino}`);
}

main();
