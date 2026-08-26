import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSurveyAccess } from "@/lib/auth-helpers";
import { leerConfig, type ValorRespuesta } from "@/lib/encuestas/tipos";

/**
 * EXPORTACIÓN CSV de una encuesta: una fila por respuesta completa, una
 * columna por pregunta, más encuestado, fecha, canal y puntaje. Es el
 * soporte documental que se anexa a un informe.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

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

  const preguntas = encuesta.pages.flatMap((p) => p.questions);

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
      "Content-Disposition": `attachment; filename="${encuesta.code}-respuestas.csv"`,
    },
  });
}
