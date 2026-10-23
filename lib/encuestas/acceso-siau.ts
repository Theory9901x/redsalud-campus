import { cache } from "react";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { veComoAdmin } from "@/lib/roles";

/**
 * QUIÉN VE LA SIAU.
 *
 * La encuesta SIAU y su Centro de datos son de la oficina de Atención al
 * Usuario, no de las áreas del plan: el tutor de Calidad, Farmacia, etc.
 * solo gestiona la satisfacción de sus capacitaciones y nunca ve la SIAU.
 * Las dos excepciones son el administrador (y Seguimiento, que ve como él)
 * y la CUENTA DEL ÁREA SIAU: el TUTOR que responde por el área «Atención al
 * Usuario» (prisma/crear-tutores-areas.ts), que consulta su encuesta y
 * descarga sus informes.
 *
 * Es CONSULTA y EXPORTACIÓN, no edición: la estructura de la encuesta SIAU
 * la sigue administrando quien la creó o el administrador
 * (puedeGestionarEncuesta en app/encuestas/acciones-constructor.ts).
 *
 * Una sola regla para toda la plataforma: página del Centro de datos, sus
 * tres exportaciones, la ficha de la encuesta SIAU, el listado y el menú.
 */

type SesionMinima = { user: { id: string; role: Role } };

/** Sin acentos ni mayúsculas: "Atención al Usuario" = "ATENCION AL USUARIO". */
function normalizar(texto: string) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export function esAreaSiau(nombre: string) {
  const n = normalizar(nombre);
  return n === "atencion al usuario" || n.includes("siau");
}

/**
 * ¿Este usuario es el tutor del área de Atención al Usuario? Una consulta
 * por el índice de TrainingArea.tutorId (un área tiene pocas filas por
 * tutor); el nombre se compara en memoria para ignorar acentos, que
 * `mode: "insensitive"` de Postgres no ignora. Memoizada por petición: el
 * layout y la página la piden a la vez sin repetir la consulta.
 */
const tutorDeAreaSiau = cache(async (userId: string) => {
  const areas = await prisma.trainingArea.findMany({ where: { tutorId: userId }, select: { name: true } });
  return areas.some((a) => esAreaSiau(a.name));
});

/** La cuenta de área SIAU (TUTOR), sin contar al administrador. */
export async function esCuentaSiau(sesion: SesionMinima | null | undefined): Promise<boolean> {
  if (!sesion?.user || sesion.user.role !== "TUTOR") return false;
  return tutorDeAreaSiau(sesion.user.id);
}

/** Administrador (o Seguimiento) o la cuenta de área SIAU. */
export async function puedeGestionarSiau(sesion: SesionMinima | null | undefined): Promise<boolean> {
  if (!sesion?.user) return false;
  if (veComoAdmin(sesion.user.role)) return true;
  return esCuentaSiau(sesion);
}
