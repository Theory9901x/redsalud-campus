import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { veComoAdmin } from "@/lib/roles";
import { hojaInformacion, hojaTabla, nuevoLibro, respuestaExcel, horaColombia } from "@/lib/excel-tabla";
import { listadoPostulaciones, resultadosGalardones } from "@/lib/galardones/consultas";
import { NOMBRE_EVENTO, NOMBRE_RECONOCIMIENTO, valorInfo } from "@/lib/galardones/valores";
import { nombrePropio } from "@/lib/nombre-propio";

/** Excel de la Noche de Galardones: ganadores por IPS, ranking completo y el detalle de cada postulación. */
export async function GET() {
  const session = await auth();
  if (!session?.user || !veComoAdmin(session.user.role)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }
  if (session.user.role === "ADMIN" && (session.user.restrictedAdminSections ?? []).includes("USUARIOS")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const [resultados, postulaciones] = await Promise.all([resultadosGalardones(), listadoPostulaciones()]);
  const wb = nuevoLibro();

  hojaTabla(
    wb,
    "Ganadores por IPS",
    [
      { titulo: "Centro IPS", ancho: 22 },
      { titulo: "Valor", ancho: 16 },
      { titulo: "Persona con más postulaciones", ancho: 36 },
      { titulo: "Postulaciones", ancho: 14 },
      { titulo: "% del valor en la IPS", ancho: 18 },
      { titulo: "Empate", ancho: 10 },
      { titulo: "Total del valor en la IPS", ancho: 20 },
    ],
    resultados.porIps.flatMap((i) =>
      i.valores.map((v) => {
        const lider = v.candidatos[0];
        return [i.ips, valorInfo(v.valor).nombre, lider?.nombre ?? "", lider?.votos ?? 0, lider ? lider.porcentaje / 100 : 0, v.empate ? "Sí" : "", v.total];
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
    ]),
  );

  hojaInformacion(wb, [
    ["Archivo", `${NOMBRE_EVENTO} · ${NOMBRE_RECONOCIMIENTO}`],
    ["Postulaciones", String(resultados.totalPostulaciones)],
    ["Colaboradores que postularon", String(resultados.totalVotantes)],
    ["Personas postuladas (agrupadas)", String(resultados.totalCandidatos)],
    ["Centros con participación", `${resultados.ipsConParticipacion} de ${resultados.porIps.length}`],
    ["Agrupación", "Una misma persona cuenta como una sola aunque su nombre se haya escrito distinto; la hoja Ranking muestra las variantes."],
  ]);

  return respuestaExcel(wb, `noche-de-galardones-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
