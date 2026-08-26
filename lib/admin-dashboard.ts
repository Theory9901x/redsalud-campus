import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ORDEN_EMBUDO, esEstadoFormacion } from "@/lib/formacion";
import type { EstadoFormacion } from "@/lib/formacion";
import type { PersonnelType } from "@prisma/client";

/**
 * Consultas del panel de control de Talento Humano.
 *
 * Todas viven aquí y todas reciben el MISMO objeto de filtros, para que no
 * pueda pasar lo que ya pasó una vez: que un widget filtrara por
 * `courseType = 'OBLIGATORIO'` y otro no, y el panel se contradijera a sí
 * mismo sin que nadie lo notara.
 *
 * Regla de honestidad: ninguna función inventa datos de relleno. Si no hay
 * nada que contar devuelve una lista vacía o `null`, y es la vista la que
 * dice "todavía no hay actividad" -no un cero que se lee como fracaso-.
 */

// El tipo y las etiquetas viven en lib/formacion.ts, sin dependencias de
// servidor, para que también los puedan importar los componentes de cliente.
export type { EstadoFormacion } from "@/lib/formacion";
export { ESTADO_FORMACION_LABEL } from "@/lib/formacion";

export type FiltrosPanel = {
  municipioId?: string;
  personnelType?: PersonnelType;
  courseId?: string;
  estado?: EstadoFormacion;
  /** FASE 10: acota a los cursos ligados a capacitaciones de esa modalidad. */
  modalidad?: "VIRTUAL" | "PRESENCIAL" | "MIXTA";
};

/**
 * Lee los filtros de la URL. La URL es la única fuente de verdad: así el
 * panel filtrado se puede compartir por enlace, sobrevive a un F5 y el botón
 * "atrás" del navegador deshace el filtro, que es lo que la gente espera.
 */
export function leerFiltros(params: Record<string, string | string[] | undefined>): FiltrosPanel {
  const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
  const personnelType = uno(params.personal);
  const estado = uno(params.estado);
  const modalidad = uno(params.modalidad);
  return {
    municipioId: uno(params.municipio),
    personnelType:
      personnelType === "ADMINISTRATIVO" || personnelType === "ASISTENCIAL" ? personnelType : undefined,
    courseId: uno(params.curso),
    estado: esEstadoFormacion(estado) ? estado : undefined,
    modalidad:
      modalidad === "VIRTUAL" || modalidad === "PRESENCIAL" || modalidad === "MIXTA" ? modalidad : undefined,
  };
}

export function hayFiltrosActivos(f: FiltrosPanel) {
  return Boolean(f.municipioId || f.personnelType || f.courseId || f.estado || f.modalidad);
}

/**
 * Fragmento SQL con las condiciones sobre la persona. Se compone con
 * Prisma.sql, que parametriza los valores: nunca se interpola texto de la URL
 * dentro de la consulta.
 */
function condicionesPersona(f: FiltrosPanel) {
  const partes: Prisma.Sql[] = [Prisma.sql`u."status" = 'ACTIVE'`];
  if (f.municipioId) partes.push(Prisma.sql`u."municipioId" = ${f.municipioId}`);
  if (f.personnelType) partes.push(Prisma.sql`u."personnelType"::text = ${f.personnelType}`);
  return Prisma.join(partes, " AND ");
}

/**
 * Subconsulta con el estado de formación de cada persona, ya resuelto en SQL.
 *
 * Se calcula UNA vez y la reutilizan el embudo, los KPI y la tabla, porque si
 * cada widget lo dedujera por su cuenta acabarían discrepando en los casos
 * borde (alguien que ingresó y tiene una inscripción al 0 %).
 *
 * El filtro de curso entra aquí: al filtrar por un curso, "completó" significa
 * completó ESE curso, no cualquiera.
 */
function estadoPorPersona(f: FiltrosPanel) {
  const filtroCurso = f.courseId ? Prisma.sql`AND e."courseId" = ${f.courseId}` : Prisma.empty;
  // FASE 10: la modalidad es de la capacitación del PIC; filtrar por ella
  // significa "formación de cursos ligados a capacitaciones así dictadas".
  const filtroModalidad = f.modalidad
    ? Prisma.sql`AND e."courseId" IN (SELECT ta."courseId" FROM "TrainingActivity" ta WHERE ta."modality"::text = ${f.modalidad} AND ta."courseId" IS NOT NULL)`
    : Prisma.empty;
  return Prisma.sql`
    SELECT
      u."id",
      CASE
        WHEN NOT EXISTS (
          SELECT 1 FROM "Enrollment" e WHERE e."userId" = u."id" ${filtroCurso} ${filtroModalidad}
        ) THEN 'SIN_ASIGNAR'
        WHEN u."lastLoginAt" IS NULL THEN 'SIN_INGRESAR'
        WHEN EXISTS (
          SELECT 1 FROM "Enrollment" e
          WHERE e."userId" = u."id" AND e."status" = 'COMPLETED' ${filtroCurso} ${filtroModalidad}
        ) THEN 'COMPLETADO'
        WHEN EXISTS (
          SELECT 1 FROM "Enrollment" e
          WHERE e."userId" = u."id" AND e."progressPercentage" > 0 ${filtroCurso} ${filtroModalidad}
        ) THEN 'EN_CURSO'
        ELSE 'SIN_AVANCE'
      END AS estado
    FROM "User" u
    WHERE ${condicionesPersona(f)}
  `;
}

/** Aplica el filtro de estado sobre la subconsulta anterior, si lo hay. */
function filtroEstado(f: FiltrosPanel) {
  return f.estado ? Prisma.sql`WHERE p.estado = ${f.estado}` : Prisma.empty;
}

// ─── Indicadores de cabecera ─────────────────────────────────────────────

export type Indicadores = {
  personas: number;
  inscripciones: number;
  completadas: number;
  /** null cuando no hay ni una inscripción: no es 0 %, es "sin datos". */
  porcentajeCompletado: number | null;
  sinIngresar: number;
  certificados: number;
  /** null mientras nadie haya aprobado un quiz. Ver lib/lesson-progress.ts. */
  promedioAprobacion: number | null;
};

export async function getIndicadores(f: FiltrosPanel): Promise<Indicadores> {
  const filtroCurso = f.courseId ? Prisma.sql`AND e."courseId" = ${f.courseId}` : Prisma.empty;

  const [fila] = await prisma.$queryRaw<
    {
      personas: number;
      inscripciones: number;
      completadas: number;
      sinIngresar: number;
      certificados: number;
      promedio: number | null;
    }[]
  >`
    WITH p AS (${estadoPorPersona(f)}),
    universo AS (SELECT p."id" FROM p ${filtroEstado(f)})
    SELECT
      (SELECT COUNT(*)::int FROM universo) AS personas,
      (SELECT COUNT(*)::int FROM "Enrollment" e
        WHERE e."userId" IN (SELECT "id" FROM universo) ${filtroCurso}) AS inscripciones,
      (SELECT COUNT(*)::int FROM "Enrollment" e
        WHERE e."userId" IN (SELECT "id" FROM universo) AND e."status" = 'COMPLETED' ${filtroCurso}) AS completadas,
      (SELECT COUNT(*)::int FROM "User" u2
        WHERE u2."id" IN (SELECT "id" FROM universo) AND u2."lastLoginAt" IS NULL) AS "sinIngresar",
      (SELECT COUNT(*)::int FROM "Certificate" c
        WHERE c."userId" IN (SELECT "id" FROM universo) AND c."status" = 'VALID') AS certificados,
      (SELECT AVG(e."finalScore")::float FROM "Enrollment" e
        WHERE e."userId" IN (SELECT "id" FROM universo)
          AND e."finalScore" IS NOT NULL ${filtroCurso}) AS promedio
  `;

  const inscripciones = fila?.inscripciones ?? 0;
  return {
    personas: fila?.personas ?? 0,
    inscripciones,
    completadas: fila?.completadas ?? 0,
    porcentajeCompletado: inscripciones > 0 ? Math.round(((fila?.completadas ?? 0) / inscripciones) * 100) : null,
    sinIngresar: fila?.sinIngresar ?? 0,
    certificados: fila?.certificados ?? 0,
    promedioAprobacion: fila?.promedio != null ? Math.round(fila.promedio) : null,
  };
}

// ─── Embudo de participación ─────────────────────────────────────────────

export type PasoEmbudo = { estado: EstadoFormacion; personas: number };

/**
 * Cuántas personas hay en cada estado. Es la métrica más accionable del panel:
 * dice si el problema es que la gente no entra, entra y no avanza, o avanza y
 * no termina -tres problemas distintos con tres soluciones distintas-.
 */
export async function getEmbudo(f: FiltrosPanel): Promise<PasoEmbudo[]> {
  // El estado propio no se auto-filtra: el embudo siempre muestra los cuatro
  // pasos, si no dejaría de ser un embudo.
  const sinEstado = { ...f, estado: undefined };
  const filas = await prisma.$queryRaw<{ estado: EstadoFormacion; personas: number }[]>`
    WITH p AS (${estadoPorPersona(sinEstado)})
    SELECT p.estado, COUNT(*)::int AS personas FROM p GROUP BY p.estado
  `;
  return ORDEN_EMBUDO.map((estado) => ({
    estado,
    personas: filas.find((x) => x.estado === estado)?.personas ?? 0,
  }));
}

// ─── Cobertura por municipio ─────────────────────────────────────────────

export type CoberturaMunicipio = { municipio: string; personas: number; completaron: number };

/**
 * Mide sobre los cursos que la persona REALMENTE tiene asignados. La versión
 * anterior filtraba por `courseType = 'OBLIGATORIO'`, un tipo que no tiene
 * ningún curso: el panel mostraba 0 % en todos los municipios.
 */
export async function getCoberturaMunicipios(f: FiltrosPanel): Promise<CoberturaMunicipio[]> {
  const filtroCurso = f.courseId ? Prisma.sql`AND e."courseId" = ${f.courseId}` : Prisma.empty;
  return prisma.$queryRaw<CoberturaMunicipio[]>`
    WITH p AS (${estadoPorPersona(f)}),
    universo AS (SELECT p."id" FROM p ${filtroEstado(f)})
    SELECT
      COALESCE(m."nombre", 'Sin municipio') AS municipio,
      COUNT(DISTINCT u."id")::int AS personas,
      COUNT(DISTINCT e."userId") FILTER (WHERE e."status" = 'COMPLETED')::int AS completaron
    FROM "User" u
    LEFT JOIN "Municipio" m ON m."id" = u."municipioId"
    LEFT JOIN "Enrollment" e ON e."userId" = u."id" ${filtroCurso}
    WHERE u."id" IN (SELECT "id" FROM universo)
    GROUP BY municipio
    ORDER BY (COUNT(DISTINCT e."userId") FILTER (WHERE e."status" = 'COMPLETED')::float
              / NULLIF(COUNT(DISTINCT u."id"), 0)) ASC, personas DESC
    LIMIT 10
  `;
}

// ─── Avance por curso ────────────────────────────────────────────────────

export type AvanceCurso = {
  courseId: string;
  titulo: string;
  inscritos: number;
  enCurso: number;
  completados: number;
};

export async function getAvanceCursos(f: FiltrosPanel): Promise<AvanceCurso[]> {
  const filtroCurso = f.courseId ? Prisma.sql`AND c."id" = ${f.courseId}` : Prisma.empty;
  return prisma.$queryRaw<AvanceCurso[]>`
    WITH p AS (${estadoPorPersona(f)}),
    universo AS (SELECT p."id" FROM p ${filtroEstado(f)})
    SELECT
      c."id" AS "courseId",
      c."title" AS titulo,
      COUNT(e."id")::int AS inscritos,
      COUNT(e."id") FILTER (WHERE e."status" <> 'COMPLETED' AND e."progressPercentage" > 0)::int AS "enCurso",
      COUNT(e."id") FILTER (WHERE e."status" = 'COMPLETED')::int AS completados
    FROM "Course" c
    JOIN "Enrollment" e ON e."courseId" = c."id" AND e."userId" IN (SELECT "id" FROM universo)
    WHERE TRUE ${filtroCurso}
    GROUP BY c."id", c."title"
    ORDER BY inscritos DESC
    LIMIT 8
  `;
}

// ─── Tabla de detalle ────────────────────────────────────────────────────

export type FilaPersona = {
  id: string;
  fullName: string;
  documentNumber: string;
  municipio: string | null;
  personnelType: PersonnelType;
  estado: EstadoFormacion;
  avance: number;
  ultimoIngreso: Date | null;
};

export async function getPersonas(f: FiltrosPanel, pagina: number, porPagina = 12) {
  const filtroCurso = f.courseId ? Prisma.sql`AND e."courseId" = ${f.courseId}` : Prisma.empty;

  const filas = await prisma.$queryRaw<FilaPersona[]>`
    WITH p AS (${estadoPorPersona(f)})
    SELECT
      u."id",
      u."fullName",
      u."documentNumber",
      m."nombre" AS municipio,
      u."personnelType",
      p.estado,
      COALESCE(ROUND(AVG(e."progressPercentage")), 0)::int AS avance,
      u."lastLoginAt" AS "ultimoIngreso"
    FROM p
    JOIN "User" u ON u."id" = p."id"
    LEFT JOIN "Municipio" m ON m."id" = u."municipioId"
    LEFT JOIN "Enrollment" e ON e."userId" = u."id" ${filtroCurso}
    ${f.estado ? Prisma.sql`WHERE p.estado = ${f.estado}` : Prisma.empty}
    GROUP BY u."id", u."fullName", u."documentNumber", m."nombre", u."personnelType", p.estado, u."lastLoginAt"
    ORDER BY
      CASE p.estado
        WHEN 'SIN_ASIGNAR' THEN 0 WHEN 'SIN_INGRESAR' THEN 1 WHEN 'SIN_AVANCE' THEN 2
        WHEN 'EN_CURSO' THEN 3 ELSE 4 END ASC,
      u."fullName" ASC
    LIMIT ${porPagina} OFFSET ${(pagina - 1) * porPagina}
  `;

  const [conteo] = await prisma.$queryRaw<{ total: number }[]>`
    WITH p AS (${estadoPorPersona(f)})
    SELECT COUNT(*)::int AS total FROM p ${filtroEstado(f)}
  `;

  return { filas, total: conteo?.total ?? 0, porPagina };
}

/** Detalle de una persona para el panel lateral. */
export async function getDetallePersona(id: string) {
  const persona = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      fullName: true,
      documentType: true,
      documentNumber: true,
      email: true,
      username: true,
      phone: true,
      position: true,
      department: true,
      personnelType: true,
      lastLoginAt: true,
      municipio: { select: { nombre: true } },
      enrollments: {
        select: {
          id: true,
          status: true,
          progressPercentage: true,
          finalScore: true,
          completedAt: true,
          course: { select: { id: true, title: true } },
        },
        orderBy: { enrolledAt: "desc" },
      },
      certificates: {
        where: { status: "VALID" },
        select: { id: true, certificateCode: true, issuedAt: true, course: { select: { title: true } } },
        orderBy: { issuedAt: "desc" },
      },
    },
  });
  return persona;
}

/** Opciones de los desplegables de filtro. */
export async function getOpcionesFiltro() {
  const [municipios, cursos] = await Promise.all([
    prisma.municipio.findMany({ select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
    prisma.course.findMany({ select: { id: true, title: true }, orderBy: { title: "asc" } }),
  ]);
  return { municipios, cursos };
}
