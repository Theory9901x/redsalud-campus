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
  // Cuenta cualquier persona activa inscrita en formación, sin importar su rol:
  // administradores y tutores también hacen los cursos y deben aparecer en el
  // cumplimiento. Antes se filtraba por role = STUDENT y quedaban fuera.
  const partes: Prisma.Sql[] = [Prisma.sql`u."status" = 'ACTIVE'`];
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
    -- Se mide sobre los cursos en los que la persona está inscrita, no solo
    -- sobre los de tipo OBLIGATORIO: la inducción institucional es de tipo
    -- INDUCCION y es la formación que todo el personal debe cursar, así que
    -- restringir por courseType dejaba el cumplimiento en cero para todos.
    JOIN "Enrollment" e ON e."userId" = u."id"
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
    WHERE u."status" = 'ACTIVE'
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

export type FilaDetalle = {
  enrollmentId: string;
  persona: string;
  documento: string;
  municipio: string | null;
  cargo: string | null;
  grupo: string;
  vinculacion: string;
  esPlanta: boolean;
  curso: string;
  estado: string;
  avance: number;
};

/**
 * Tabla de detalle (persona × curso) con TODAS las dimensiones pobladas y
 * paginada en el servidor. La versión anterior mostraba "los primeros 15"
 * pero consultaba sin límite por detrás, y dejaba en "—" las columnas que
 * ahora sí existen.
 */
export async function detalleInscripciones(
  f: FiltrosReporte,
  opciones: { busqueda?: string; pagina: number; porPagina: number }
): Promise<{ filas: FilaDetalle[]; total: number }> {
  const cond: Prisma.Sql[] = [Prisma.sql`1 = 1`];
  if (f.municipioId) cond.push(Prisma.sql`u."municipioId" = ${f.municipioId}`);
  if (f.grupo) cond.push(Prisma.sql`u."personnelType"::text = ${f.grupo}`);
  if (f.cargoId) cond.push(Prisma.sql`u."cargoId" = ${f.cargoId}`);
  if (f.vinculacion) cond.push(Prisma.sql`u."tipoVinculacion"::text = ${f.vinculacion}`);
  if (f.cursoId) cond.push(Prisma.sql`e."courseId" = ${f.cursoId}`);
  if (f.desde) cond.push(Prisma.sql`e."enrolledAt" >= ${new Date(f.desde)}`);
  if (f.hasta) cond.push(Prisma.sql`e."enrolledAt" <= ${new Date(`${f.hasta}T23:59:59`)}`);
  if (opciones.busqueda) {
    const patron = `%${opciones.busqueda}%`;
    cond.push(
      Prisma.sql`(u."fullName" ILIKE ${patron} OR u."documentNumber" ILIKE ${patron} OR co."title" ILIKE ${patron})`
    );
  }
  const donde = Prisma.join(cond, " AND ");

  const [filas, totales] = await Promise.all([
    prisma.$queryRaw<FilaDetalle[]>`
      SELECT
        e."id" AS "enrollmentId",
        u."fullName" AS persona,
        u."documentNumber" AS documento,
        m."nombre" AS municipio,
        c."nombre" AS cargo,
        u."personnelType"::text AS grupo,
        u."tipoVinculacion"::text AS vinculacion,
        (u."tipoVinculacion" <> 'CONTRATO_PRESTACION') AS "esPlanta",
        co."title" AS curso,
        e."status"::text AS estado,
        e."progressPercentage"::int AS avance
      FROM "Enrollment" e
      JOIN "User" u ON u."id" = e."userId"
      JOIN "Course" co ON co."id" = e."courseId"
      LEFT JOIN "Municipio" m ON m."id" = u."municipioId"
      LEFT JOIN "Cargo" c ON c."id" = u."cargoId"
      WHERE ${donde}
      ORDER BY u."fullName" ASC
      LIMIT ${opciones.porPagina} OFFSET ${(opciones.pagina - 1) * opciones.porPagina}
    `,
    prisma.$queryRaw<{ total: number }[]>`
      SELECT COUNT(*)::int AS total
      FROM "Enrollment" e
      JOIN "User" u ON u."id" = e."userId"
      JOIN "Course" co ON co."id" = e."courseId"
      WHERE ${donde}
    `,
  ]);

  return { filas, total: totales[0]?.total ?? 0 };
}
