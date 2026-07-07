/** Escapa un valor para CSV: entre comillas si contiene comas, comillas o saltos de línea. */
function escapeCsvField(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/**
 * Arma un CSV UTF-8 (con BOM, para que Excel muestre tildes y ñ correctas)
 * a partir de encabezados y filas.
 */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.map(escapeCsvField).join(","), ...rows.map((row) => row.map(escapeCsvField).join(","))];
  return "﻿" + lines.join("\r\n");
}

export function csvResponse(fileName: string, csv: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
