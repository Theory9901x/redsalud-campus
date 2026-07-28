import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/audit";
import { PdfNoDisponibleError, renderizarPdf } from "@/lib/pdf";
import { REPORTE_META, esTipoReporte } from "@/lib/reportes-meta";

/** Lanzar Chromium y renderizar un informe largo no cabe en el límite corto. */
export const maxDuration = 120;

const FILTROS_PERMITIDOS = ["municipio", "personal", "curso", "estado"] as const;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const tipo = searchParams.get("tipo");
  if (!esTipoReporte(tipo)) {
    return NextResponse.json({ error: "Tipo de reporte desconocido." }, { status: 400 });
  }

  // Se reconstruyen los filtros desde una lista blanca en vez de reenviar la
  // query entera: así nada de lo que venga en la URL llega a la hoja sin pasar
  // por aquí.
  const filtros = new URLSearchParams();
  for (const clave of FILTROS_PERMITIDOS) {
    const valor = searchParams.get(clave);
    if (valor) filtros.set(clave, valor);
  }

  const origen = new URL(request.url).origin;
  const cookie = request.headers.get("cookie") ?? "";
  if (!cookie) {
    return NextResponse.json({ error: "Falta la sesión en la petición." }, { status: 400 });
  }

  const query = filtros.toString();
  const url = `${origen}/admin/reportes/${tipo}/imprimir${query ? `?${query}` : ""}`;
  const meta = REPORTE_META[tipo];

  try {
    const pdf = await renderizarPdf({
      url,
      cookie,
      encabezado: `${meta.titulo} · Red Salud Casanare E.S.E.`,
    });

    // La bitácora se anota DESPUÉS de generar: si el PDF falla no debe quedar
    // registrado un informe que nadie llegó a recibir. registrarAuditoria no
    // lanza, así que un fallo al anotar tampoco tumba la descarga.
    await registrarAuditoria({
      userId: session.user.id,
      action: "EXPORT",
      entity: "Report",
      entityId: tipo,
      description: `Generó el PDF «${meta.titulo}»${query ? ` con filtros: ${query}` : " sin filtros"}.`,
    });

    const fecha = new Date().toISOString().slice(0, 10);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="reporte-${tipo}-${fecha}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Fallo al generar el PDF:", error);
    if (error instanceof PdfNoDisponibleError) {
      return NextResponse.json(
        {
          error:
            "La generación de PDF no está disponible en este servidor. Mientras tanto puedes abrir la hoja e imprimirla con Ctrl+P.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "No se pudo generar el PDF." }, { status: 500 });
  }
}
