import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Capa de datos del centro de reportes (Fase 8.1).
 *
 * Todo se agrega en SQL: cada panel es UNA consulta que devuelve filas ya
 * sumadas. No se traen miles de inscripciones al servidor para contarlas en
 * JavaScript, que es lo que hacía el reporte anterior y no escalaba.
 */

export type FiltrosReporte = {
  desde?: string;
  hasta?: string;
  municipioId?: string;
  grupo?: string; // PersonnelType
  cargoId?: string;
  vinculacion?: string; // TipoVinculacion
  cursoId?: string;
};

/** Condición SQL común a los paneles que miden sobre personas inscritas. */
function condiciones(f: FiltrosReporte) {
  const partes: Prisma.Sql[] = [Prisma.sql`u."role" = 'STUDENT' AND u."status" = 'ACTIVE'`];
  if (f.municipioId) partes.push(Prisma.sql`u."municipioId" = ${f.municipioId}`);
  if (f.grupo) partes.push(Prisma.sql`u."personnelType"::text = ${f.grupo}`);
  if (f.cargoId) partes.push(Prisma.sql`u."cargoId" = ${f.cargoId}`);
  if (f.vinculacion) partes.push(Prisma.sql`u."tipoVinculacion"::text = ${f.vinculacion}`);
  if (f.cursoId) partes.push(Prisma.sql`e."courseId" = ${f.cursoId}`);
  if (f.desde) partes.push(Prisma.sql`e."enrolledAt" >= ${new Date(f.desde)}`);
  if (f.hasta) partes.push(Prisma.sql`e."enrolledAt" <= ${new Date(`${f.hasta}T23:59:59`)}`);
  return Prisma.join(partes, " AND ");
}

export type FilaCumplimiento = { etiqueta: string; personas: number; completaron: number };

/** Cumplimiento de obligatorios agrupado por la dimensión indicada. */
export async function cumplimientoPor(
  dimension: "municipio" | "cargo" | "grupo" | "vinculacion",
  f: FiltrosReporte
): Promise<FilaCumplimiento[]> {
  const etiqueta = {
    municipio: Prisma.sql`COALESCE(m."nombre", 'Sin municipio')`,
    cargo: Prisma.sql`COALESCE(c."nombre", 'Sin cargo')`,
    grupo: Prisma.sql`u."personnelType"::text`,
    vinculacion: Prisma.sql`u."tipoVinculacion"::text`,
  }[dimension];

  return prisma.$queryRaw<FilaCumplimiento[]>`
    SELECT
      ${etiqueta} AS etiqueta,
      COUNT(DISTINCT u."id")::int AS personas,
      COUNT(DISTINCT e."userId") FILTER (WHERE e."status" = 'COMPLETED')::int AS completaron
    FROM "User" u
    LEFT JOIN "Municipio" m ON m."id" = u."municipioId"
    LEFT JOIN "Cargo" c ON c."id" = u."cargoId"
    LEFT JOIN "Enrollment" e ON e."userId" = u."id"
      AND e."courseId" IN (SELECT "id" FROM "Course" WHERE "courseType" = 'OBLIGATORIO')
    WHERE ${condiciones(f)}
    GROUP BY etiqueta
    HAVING COUNT(DISTINCT u."id") > 0
    ORDER BY personas DESC
    LIMIT 25
  `;
}

export type FilaCertificados = { etiqueta: string; certificados: number };

/** Certificados emitidos agrupados por municipio o por curso. */
export async function certificadosPor(
  dimension: "municipio" | "curso",
  f: FiltrosReporte
): Promise<FilaCertificados[]> {
  const etiqueta =
    dimension === "municipio"
      ? Prisma.sql`COALESCE(m."nombre", 'Sin municipio')`
      : Prisma.sql`co."title"`;

  const filtros: Prisma.Sql[] = [Prisma.sql`1 = 1`];
  if (f.municipioId) filtros.push(Prisma.sql`u."municipioId" = ${f.municipioId}`);
  if (f.grupo) filtros.push(Prisma.sql`u."personnelType"::text = ${f.grupo}`);
  if (f.cargoId) filtros.push(Prisma.sql`u."cargoId" = ${f.cargoId}`);
  if (f.vinculacion) filtros.push(Prisma.sql`u."tipoVinculacion"::text = ${f.vinculacion}`);
  if (f.cursoId) filtros.push(Prisma.sql`ce."courseId" = ${f.cursoId}`);
  if (f.desde) filtros.push(Prisma.sql`ce."issuedAt" >= ${new Date(f.desde)}`);
  if (f.hasta) filtros.push(Prisma.sql`ce."issuedAt" <= ${new Date(`${f.hasta}T23:59:59`)}`);

  return prisma.$queryRaw<FilaCertificados[]>`
    SELECT ${etiqueta} AS etiqueta, COUNT(*)::int AS certificados
    FROM "Certificate" ce
    JOIN "User" u ON u."id" = ce."userId"
    JOIN "Course" co ON co."id" = ce."courseId"
    LEFT JOIN "Municipio" m ON m."id" = u."municipioId"
    WHERE ${Prisma.join(filtros, " AND ")}
    GROUP BY etiqueta
    ORDER BY certificados DESC
    LIMIT 25
  `;
}

export type KpisReporte = {
  personas: number;
  inscritos: number;
  completaron: number;
  certificados: number;
  cumplimiento: number;
};

/** KPIs de cabecera, todos en una sola consulta. */
export async function kpis(f: FiltrosReporte): Promise<KpisReporte> {
  const filas = await prisma.$queryRaw<
    { personas: number; inscritos: number; completaron: number; certificados: number }[]
  >`
    SELECT
      COUNT(DISTINCT u."id")::int AS personas,
      COUNT(DISTINCT e."userId")::int AS inscritos,
      COUNT(DISTINCT e."userId") FILTER (WHERE e."status" = 'COMPLETED')::int AS completaron,
      COUNT(DISTINCT ce."id")::int AS certificados
    FROM "User" u
    LEFT JOIN "Enrollment" e ON e."userId" = u."id"
    LEFT JOIN "Certificate" ce ON ce."userId" = u."id"
    WHERE ${condiciones(f)}
  `;
  const r = filas[0] ?? { personas: 0, inscritos: 0, completaron: 0, certificados: 0 };
  return {
    ...r,
    cumplimiento: r.inscritos > 0 ? Math.round((r.completaron / r.inscritos) * 100) : 0,
  };
}

export type FilaPlanta = { grupo: string; personas: number; completaron: number; certificados: number };

/**
 * Métricas exclusivas de personal de planta. "Planta" = cualquier vinculación
 * que no sea contrato de prestación (los contratistas). Devuelve una fila por
 * grupo poblacional más el total, para poder ver asistenciales,
 * administrativos o todos juntos.
 */
export async function metricasPlanta(f: FiltrosReporte): Promise<FilaPlanta[]> {
  const extra: Prisma.Sql[] = [];
  if (f.municipioId) extra.push(Prisma.sql`AND u."municipioId" = ${f.municipioId}`);
  if (f.cargoId) extra.push(Prisma.sql`AND u."cargoId" = ${f.cargoId}`);

  return prisma.$queryRaw<FilaPlanta[]>`
    SELECT
      u."personnelType"::text AS grupo,
      COUNT(DISTINCT u."id")::int AS personas,
      COUNT(DISTINCT e."userId") FILTER (WHERE e."status" = 'COMPLETED')::int AS completaron,
      COUNT(DISTINCT ce."id")::int AS certificados
    FROM "User" u
    LEFT JOIN "Enrollment" e ON e."userId" = u."id"
    LEFT JOIN "Certificate" ce ON ce."userId" = u."id"
    WHERE u."role" = 'STUDENT' AND u."status" = 'ACTIVE'
      AND u."tipoVinculacion" <> 'CONTRATO_PRESTACION'
      ${extra.length > 0 ? Prisma.join(extra, " ") : Prisma.empty}
    GROUP BY grupo
    ORDER BY personas DESC
  `;
}

export type FilaActividad = { fecha: string; inscripciones: number; certificados: number };

/** Actividad diaria en el rango: inscripciones y certificados. */
export async function actividadEnTiempo(f: FiltrosReporte): Promise<FilaActividad[]> {
  const desde = f.desde ? new Date(f.desde) : new Date(Date.now() - 89 * 24 * 60 * 60 * 1000);
  const hasta = f.hasta ? new Date(`${f.hasta}T23:59:59`) : new Date();

  return prisma.$queryRaw<FilaActividad[]>`
    WITH dias AS (
      SELECT generate_series(${desde}::date, ${hasta}::date, '1 day')::date AS d
    )
    SELECT
      to_char(dias.d, 'YYYY-MM-DD') AS fecha,
      (SELECT COUNT(*)::int FROM "Enrollment" e JOIN "User" u ON u."id" = e."userId"
        WHERE e."enrolledAt"::date = dias.d
          AND (${f.municipioId ?? null}::text IS NULL OR u."municipioId" = ${f.municipioId ?? null})) AS inscripciones,
      (SELECT COUNT(*)::int FROM "Certificate" c JOIN "User" u ON u."id" = c."userId"
        WHERE c."issuedAt"::date = dias.d
          AND (${f.municipioId ?? null}::text IS NULL OR u."municipioId" = ${f.municipioId ?? null})) AS certificados
    FROM dias
    ORDER BY dias.d
  `;
}
