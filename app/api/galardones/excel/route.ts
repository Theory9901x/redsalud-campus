import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { veComoAdmin } from "@/lib/roles";
import { hojaInformacion, hojaTabla, nuevoLibro, respuestaExcel, horaColombia } from "@/lib/excel-tabla";
import { ganadoresGalardones, listadoPostulaciones, resultadosGalardones } from "@/lib/galardones/consultas";
import { NOMBRE_EVENTO, NOMBRE_RECONOCIMIENTO, valorInfo } from "@/lib/galardones/valores";
import { nombrePropio } from "@/lib/nombre-propio";

/** Excel de la Galardones: ganadores por IPS, ranking completo y el detalle de cada postulación. */
export async function GET() {
  const session = await auth();
  if (!session?.user || !veComoAdmin(session.user.role)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }
  if ((session.user.restrictedAdminSections ?? []).includes("USUARIOS")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const [resultados, postulaciones, ganadores] = await Promise.all([resultadosGalardones(), listadoPostulaciones(), ganadoresGalardones()]);
  const ORIGEN: Record<string, string> = { MAYORIA: "Más postulado", REASIGNADO: "Siguiente más postulado", DECISION: "Definido por Talento Humano", EMPATE: "Empate por definir", SIN_POSTULACIONES: "Sin ganador" };
  const wb = nuevoLibro();

  hojaTabla(
    wb,
    "Ganadores por IPS",
    [
      { titulo: "Centro IPS", ancho: 22 },
      { titulo: "Valor", ancho: 16 },
      { titulo: "Ganador", ancho: 36 },
      { titulo: "Postulaciones", ancho: 14 },
      { titulo: "% del valor en la IPS", ancho: 18 },
      { titulo: "Cómo se definió", ancho: 26 },
      { titulo: "Nota", ancho: 50 },
      { titulo: "Total del valor en la IPS", ancho: 20 },
    ],
    ganadores.flatMap((i) =>
      i.ganadores.map((g) => {
        const p = g.personas[0];
        return [i.ips, valorInfo(g.valor).nombre, g.personas.map((x) => x.nombre).join(" · "), p?.votos ?? 0, p ? p.porcentaje / 100 : 0, ORIGEN[g.origen], g.nota ?? "", g.total];
      }),
    ),
  ).getColumn(5).numFmt = "0%";

  hojaTabla(
    wb,
    "Ranking completo",
    [
      { titulo: "Centro IPS", ancho: 22 },
      { titulo: "Valor", ancho: 16 },
      { titulo: "Puesto", ancho: 8 },
      { titulo: "Persona", ancho: 36 },
      { titulo: "Registrada en el campus", ancho: 20 },
      { titulo: "Postulaciones", ancho: 14 },
      { titulo: "%", ancho: 8 },
      { titulo: "Nombres tal como se escribieron", ancho: 60 },
    ],
    resultados.porIps.flatMap((i) =>
      i.valores.flatMap((v) =>
        v.candidatos.map((c, idx) => [
          i.ips,
          valorInfo(v.valor).nombre,
          idx + 1,
          c.nombre,
          c.registrado ? "Sí" : "No",
          c.votos,
          c.porcentaje / 100,
          c.variantes.map((x) => `${x.texto} (×${x.veces})`).join(" · "),
        ]),
      ),
    ),
  ).getColumn(7).numFmt = "0%";

  hojaTabla(
    wb,
    "Postulaciones",
    [
      { titulo: "Fecha", ancho: 18, formato: "dd/mm/yyyy hh:mm" },
      { titulo: "Centro IPS", ancho: 22 },
      { titulo: "Valor", ancho: 16 },
      { titulo: "Nombre escrito", ancho: 32 },
      { titulo: "Cuenta como", ancho: 32 },
      { titulo: "Comportamiento o aporte observado", ancho: 70 },
      { titulo: "Quien postula", ancho: 32 },
      { titulo: "Documento", ancho: 14 },
      { titulo: "Cargo", ancho: 26 },
      { titulo: "Dependencia", ancho: 26 },
      { titulo: "Estado", ancho: 16 },
    ],
    postulaciones.map((p) => [
      horaColombia(p.createdAt),
      p.ips,
      valorInfo(p.valor).nombre,
      p.nombreEscrito,
      p.candidato.nombre,
      p.motivo,
      nombrePropio(p.votante.fullName),
      p.votante.documentNumber,
      p.votante.position ?? "",
      p.votante.department ?? "",
      p.estado === "VALIDA" ? "Válida" : p.estado === "POR_VERIFICAR" ? "Por verificar" : "Anulada",
    ]),
  );

  hojaInformacion(wb, [
    ["Archivo", `${NOMBRE_EVENTO} · ${NOMBRE_RECONOCIMIENTO}`],
    ["Postulaciones válidas", String(resultados.totalPostulaciones)],
    ["Regla", "Una postulación por cuenta; todas suman salvo las que Talento Humano haya anulado."],
    ["Colaboradores que postularon", String(resultados.totalVotantes)],
    ["Personas postuladas (agrupadas)", String(resultados.totalCandidatos)],
    ["Centros con participación", `${resultados.ipsConParticipacion} de ${resultados.porIps.length}`],
    ["Agrupación", "Una misma persona cuenta como una sola aunque su nombre se haya escrito distinto; la hoja Ranking muestra las variantes."],
  ]);

  return respuestaExcel(wb, `galardones-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
