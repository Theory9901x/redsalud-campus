import { NextResponse } from "next/server";
import { gestorVideoteca } from "@/lib/videoteca/acceso";
import { agregarParte, iniciarCarga, leerCarga, TAMANO_MAXIMO, TAMANO_PARTE, terminarCarga } from "@/lib/videoteca/almacen";
import { registrarAuditoria } from "@/lib/audit";

/**
 * CARGA EN PARTES de un video de la Videoteca (ver lib/videoteca/almacen.ts).
 *   POST ?op=iniciar   JSON { nombre, tipo, tamano, titulo, descripcion?, categoria?, duracionSeg? }
 *   POST ?op=parte&id=…&desde=N   cuerpo binario (≤ 8 MB)
 *   POST ?op=terminar&id=…
 */
export async function POST(request: Request) {
  const sesion = await gestorVideoteca();
  if (!sesion) return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  const usuarioId = sesion.user.id;
  const url = new URL(request.url);
  const op = url.searchParams.get("op");

  try {
    if (op === "iniciar") {
      const b = (await request.json()) as Record<string, unknown>;
      const texto = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
      const tamano = Number(b.tamano);
      const tipo = texto(b.tipo, 60) ?? "video/mp4";
      const titulo = texto(b.titulo, 160);
      if (!titulo) return NextResponse.json({ error: "Escribe un título." }, { status: 400 });
      if (!tipo.startsWith("video/")) return NextResponse.json({ error: "Solo se aceptan videos." }, { status: 415 });
      if (!Number.isFinite(tamano) || tamano <= 0) return NextResponse.json({ error: "Archivo vacío." }, { status: 400 });
      if (tamano > TAMANO_MAXIMO) return NextResponse.json({ error: "El video supera 2 GB." }, { status: 413 });
      const dur = Number(b.duracionSeg);
      const carga = await iniciarCarga({
        nombre: texto(b.nombre, 200) ?? "video.mp4",
        tipo,
        tamano,
        titulo,
        descripcion: texto(b.descripcion, 2000),
        categoria: texto(b.categoria, 60),
        duracionSeg: Number.isFinite(dur) && dur > 0 ? Math.round(dur) : null,
        usuarioId,
      });
      return NextResponse.json({ id: carga.id, tamanoParte: TAMANO_PARTE });
    }

    const id = url.searchParams.get("id") ?? "";
    const carga = await leerCarga(id, usuarioId);
    if (!carga) return NextResponse.json({ error: "Carga no encontrada." }, { status: 404 });

    if (op === "parte") {
      const desde = Number(url.searchParams.get("desde"));
      const datos = Buffer.from(await request.arrayBuffer());
      if (!Number.isFinite(desde) || desde < 0 || datos.length === 0 || datos.length > TAMANO_PARTE) {
        return NextResponse.json({ error: "Parte inválida." }, { status: 400 });
      }
      const recibidos = await agregarParte(carga, desde, datos);
      return NextResponse.json({ recibidos });
    }

    if (op === "terminar") {
      const video = await terminarCarga(carga);
      await registrarAuditoria({ userId: usuarioId, action: "CREATE", entity: "Video", entityId: video.id, description: `Video de capacitación subido: «${carga.titulo}»` });
      return NextResponse.json({ ok: true, id: video.id });
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo guardar." }, { status: 409 });
  }
  return NextResponse.json({ error: "Operación desconocida." }, { status: 400 });
}
