import type { Periodo } from "@/lib/encuestas/metrics";

/** Lee el periodo de los parámetros de una URL; null si no es válido. */
export function leerPeriodo(params: URLSearchParams): Periodo | null {
  const tipo = params.get("tipo") ?? "mensual";
  const anio = Number(params.get("anio"));
  if (!Number.isInteger(anio) || anio < 2020 || anio > 2100) return null;
  if (tipo === "mensual") {
    const mes = Number(params.get("mes"));
    if (!Number.isInteger(mes) || mes < 1 || mes > 12) return null;
    return { tipo, anio, mes };
  }
  if (tipo === "trimestral") {
    const trimestre = Number(params.get("trimestre"));
    if (!Number.isInteger(trimestre) || trimestre < 1 || trimestre > 4) return null;
    return { tipo, anio, trimestre };
  }
  if (tipo === "anual") return { tipo, anio };
  return null;
}

/** Periodo por defecto: el mes en curso (hora de Bogotá). */
export function periodoActual(tipo: Periodo["tipo"] = "mensual"): Periodo {
  const d = new Date(Date.now() - 5 * 3600e3);
  const anio = d.getUTCFullYear();
  const mes = d.getUTCMonth() + 1;
  if (tipo === "mensual") return { tipo, anio, mes };
  if (tipo === "trimestral") return { tipo, anio, trimestre: Math.floor((mes - 1) / 3) + 1 };
  return { tipo, anio };
}
