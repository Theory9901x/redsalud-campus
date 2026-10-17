import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { requireSurveyAccess } from "@/lib/auth-helpers";
import { leerConfig, type ValorRespuesta } from "@/lib/encuestas/tipos";

/**
 * BASE DE RESPUESTAS de una encuesta: una fila por respuesta completa, una
 * columna por pregunta, más encuestado, fecha, canal y puntaje. Es el
 * soporte documental que se anexa a un informe.
 *
 * ?formato=xlsx -> Excel (lo que se usa; encabezado navy, fila fija, fechas
 * en hora de Colombia). Sin él, el CSV de siempre, para enlaces viejos.
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // ?pregunta=<id>: solo esa pregunta, una fila por respuesta (para
  // analizar una métrica aparte sin cargar toda la tabla).
  const soloPregunta = new URL(request.url).searchParams.get("pregunta");
  const enExcel = new URL(request.url).searchParams.get("formato") === "xlsx";

  const encuesta = await prisma.survey.findUnique({
    where: { slug },
    include: {
      pages: { orderBy: { sortOrder: "asc" }, include: { questions: { orderBy: { sortOrder: "asc" } } } },
    },
  });
  if (!encuesta) return NextResponse.json({ error: "Encuesta no encontrada." }, { status: 404 });

  try {
    await requireSurveyAccess(encuesta.id);
  } catch {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const respuestas = await prisma.surveyResponse.findMany({
    where: { surveyId: encuesta.id, completed: true },
    orderBy: { submittedAt: "asc" },
    select: {
      submittedAt: true,
      channel: true,
      respondentName: true,
      scorePercent: true,
      user: { select: { fullName: true, documentNumber: true } },
      answers: { select: { questionId: true, value: true, textValue: true } },
    },
  });

  const todas = encuesta.pages.flatMap((p) => p.questions);
  const preguntas = soloPregunta ? todas.filter((q) => q.id === soloPregunta) : todas;
  if (soloPregunta && preguntas.length === 0) {
    return NextResponse.json({ error: "Pregunta no encontrada." }, { status: 404 });
  }

  function legible(preguntaId: string, valor: ValorRespuesta | null, texto: string | null): string {
    if (texto) return texto;
    if (!valor) return "";
    const config = leerConfig(preguntas.find((q) => q.id === preguntaId)?.config);
    const nombreOpcion = (id: string) =>
      config.opciones?.find((o) => o.id === id)?.texto ?? (id === "si" ? "Sí" : id === "no" ? "No" : id);
    switch (valor.tipo) {
      case "opcion":
        return nombreOpcion(valor.opcionId);
      case "opciones":
        return valor.opcionIds.map(nombreOpcion).join(" | ");
      case "escala":
      case "numero":
        return String(valor.valor);
      case "fecha":
        return valor.valor;
      case "relacion":
        return valor.pares
          .map((p) => `${nombreOpcion(p.elementoId)} -> ${config.grupos?.find((g) => g.id === p.grupoId)?.titulo ?? p.grupoId}`)
          .join(" | ");
      default:
        return "";
    }
  }

  const celda = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const cabecera = ["Encuestado", "Documento", "Fecha", "Canal", "Puntaje %", ...preguntas.map((q) => q.prompt)];
  const nombreBase = `${encuesta.code}-${soloPregunta ? `pregunta-${preguntas[0].sortOrder}` : "respuestas"}`;

  if (enExcel) {
    const wb = new ExcelJS.Workbook();
    wb.creator = "RedSalud Te Forma";
    wb.created = new Date();
    const hoja = wb.addWorksheet("Respuestas", { views: [{ state: "frozen", ySplit: 1 }] });
    hoja.columns = cabecera.map((titulo, i) => ({
      header: titulo,
      width: i === 0 ? 32 : i === 1 ? 16 : i === 2 ? 18 : i === 3 ? 16 : i === 4 ? 11 : 34,
      style: i === 2 ? { numFmt: "dd/mm/yyyy hh:mm" } : i === 4 ? { numFmt: "0" } : {},
    }));
    hoja.getRow(1).height = 40;
    hoja.getRow(1).eachCell((c) => {
      c.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F2438" } };
      c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });
    for (const r of respuestas) {
      const porPregunta = new Map(r.answers.map((a) => [a.questionId, a]));
      hoja.addRow([
        r.user?.fullName ?? r.respondentName ?? "Anónimo",
        r.user?.documentNumber ?? "",
        // ExcelJS escribe en UTC: se corre a hora de Colombia (UTC-5 fijo).
        r.submittedAt ? new Date(r.submittedAt.getTime() - 5 * 3600e3) : "",
        r.channel === "publico" ? "Enlace público" : "Plataforma",
        r.scorePercent ?? "",
        ...preguntas.map((q) => {
          const a = porPregunta.get(q.id);
          return legible(q.id, (a?.value as unknown as ValorRespuesta) ?? null, a?.textValue ?? null);
        }),
      ]);
    }
    for (let i = 2; i <= hoja.rowCount; i++) {
      const fila = hoja.getRow(i);
      fila.font = { size: 10 };
      fila.alignment = { vertical: "top", wrapText: true };
      if (i % 2 === 0) fila.eachCell({ includeEmpty: true }, (c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4F7FA" } }));
    }
    if (hoja.rowCount > 1) hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: hoja.rowCount, column: cabecera.length } };
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${nombreBase}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  }
  const filas = respuestas.map((r) => {
    const porPregunta = new Map(r.answers.map((a) => [a.questionId, a]));
    return [
      r.user?.fullName ?? r.respondentName ?? "Anónimo",
      r.user?.documentNumber ?? "",
      r.submittedAt?.toISOString() ?? "",
      r.channel === "publico" ? "Enlace público" : "Plataforma",
      r.scorePercent !== null ? String(r.scorePercent) : "",
      ...preguntas.map((q) => {
        const a = porPregunta.get(q.id);
        return legible(q.id, (a?.value as unknown as ValorRespuesta) ?? null, a?.textValue ?? null);
      }),
    ];
  });

  const csv = "﻿" + [cabecera, ...filas].map((f) => f.map(celda).join(";")).join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombreBase}.csv"`,
    },
  });
}
