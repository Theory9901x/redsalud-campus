import { prisma } from "@/lib/prisma";
import { requireTrainingPlanAccess, requireTutorOrAdmin } from "@/lib/auth-helpers";
import { contarAudiencia, rangoTrimestre, trimestreActual } from "@/lib/training-plans";
import { veComoAdmin } from "@/lib/roles";
import type { CourseAudience, PlanKind, Prisma } from "@prisma/client";

/**
 * TRAZABILIDAD DE CONEXIÓN A LA SALA (capacitación en vivo), organizada por
 * ÁREA → CAPACITACIÓN → TRIMESTRE, y no solo en totales generales. En la
 * interfaz se habla siempre de «sala» o «capacitación en vivo».
 *
 * Lee únicamente CallConnectionLog (tramos ya escritos al salir de la sala;
 * ver lib/call-connections.ts, que no se toca). Todo se agrega en Postgres con
 * groupBy acotado por las capacitaciones del plan y por las conexiones que de
 * verdad ocurrieron: nunca se recorre el padrón ni se consulta persona a
 * persona. El único dato externo es el tamaño de la audiencia objetivo, que se
 * cuenta UNA vez por combinación de audiencia (no por capacitación).
 */

export type AlcanceTrazabilidad = {
  plan: { id: string; title: string; year: number; kind: PlanKind; targetDepartment: string | null };
  /** null = institucional (administración o responsable del plan). */
  areaIds: string[] | null;
  institucional: boolean;
  /** Quién consulta (para el «generado por» de los exportables). */
  usuario: { nombre: string };
};

/**
 * Mismo alcance que Indicadores: administración y responsable del plan ven
 * lo institucional; un tutor de área ve solo sus áreas. Lo usan la página
 * (admin y tutor) y los exportables (Excel y el CSV heredado), para que
 * nadie exporte lo que no puede ver.
 */
export async function resolverAlcanceTrazabilidad(planId: string): Promise<AlcanceTrazabilidad | null> {
  const sesion = await requireTutorOrAdmin();
  const plan = await prisma.trainingPlan.findUnique({
    where: { id: planId },
    select: { id: true, tutorId: true, title: true, year: true, kind: true, targetDepartment: true },
  });
  if (!plan) return null;

  const institucional = veComoAdmin(sesion.user.role) || plan.tutorId === sesion.user.id;
  if (!institucional) await requireTrainingPlanAccess(planId).catch(() => null);

  const areaIds = institucional
    ? null
    : (await prisma.trainingArea.findMany({ where: { tutorId: sesion.user.id }, select: { id: true } })).map((a) => a.id);

  return {
    plan: { id: plan.id, title: plan.title, year: plan.year, kind: plan.kind, targetDepartment: plan.targetDepartment },
    areaIds,
    institucional,
    usuario: { nombre: sesion.user.name ?? "Usuario de la plataforma" },
  };
}

/** Trimestre pedido por URL: 1–4, o null = todo el año. */
export function parseTrimestre(raw: string | undefined | null): number | null {
  const n = Number(raw);
  return n >= 1 && n <= 4 ? n : null;
}

export type KpisConexion = {
  personas: number;
  /** Personas con cuenta (las externas no cuentan en la audiencia objetivo). */
  personasInternas: number;
  externos: number;
  tramos: number;
  minutos: number;
  /** Permanencia por PERSONA (suma de sus tramos), no por tramo. */
  permanenciaPromedioMin: number;
  permanenciaMedianaMin: number;
};

export type TrimestreConexion = { trimestre: number; tramos: number; personas: number; minutos: number };

export type CapacitacionTrazada = {
  id: string;
  titulo: string;
  areaId: string | null;
  areaNombre: string;
  /** Trimestres programados en el PIC. */
  quarters: number[];
  jornadas: number;
  kpis: KpisConexion;
  /** Tamaño de la audiencia objetivo; null cuando no se pudo determinar. */
  audiencia: number | null;
  /** % de la audiencia objetivo que se conectó al menos una vez (solo personal con cuenta). */
  porcentajeConectados: number | null;
  porTrimestre: TrimestreConexion[];
};

export type AreaTrazada = {
  id: string;
  nombre: string;
  /** Índice estable (orden del catálogo) para asignar color en la interfaz. */
  indice: number;
  kpis: KpisConexion;
  capacitaciones: CapacitacionTrazada[];
};

export type TrazabilidadPlan = {
  trimestre: number | null;
  anio: number;
  trimestreEnCurso: number | null;
  resumen: KpisConexion & { areas: number; capacitaciones: number; jornadas: number };
  /** Siempre del año completo: es la tira que permite elegir trimestre con contexto. */
  porTrimestre: TrimestreConexion[];
  areas: AreaTrazada[];
  /** Momento más reciente registrado en el alcance (ISO), para el sello "actualizado". */
  ultimaConexion: string | null;
};

const SIN_AREA = "Sin área asignada";

function ventana(anio: number, trimestre: number | null): Prisma.DateTimeFilter | undefined {
  if (!trimestre) return undefined;
  const { desde, hasta } = rangoTrimestre(anio, trimestre);
  return { gte: desde, lt: hasta };
}

function mediana(valores: number[]): number {
  if (valores.length === 0) return 0;
  const orden = [...valores].sort((a, b) => a - b);
  const m = Math.floor(orden.length / 2);
  return orden.length % 2 ? orden[m] : (orden[m - 1] + orden[m]) / 2;
}

type PersonaAgregada = { clave: string; externo: boolean; segundos: number };

/** KPIs a partir de las personas (ya sumadas) y los tramos de un nodo. */
function kpisDe(personas: PersonaAgregada[], tramos: number, segundos: number): KpisConexion {
  const porPersona = personas.map((p) => p.segundos / 60);
  const externos = personas.filter((p) => p.externo).length;
  return {
    personas: personas.length,
    personasInternas: personas.length - externos,
    externos,
    tramos,
    minutos: Math.round(segundos / 60),
    permanenciaPromedioMin: personas.length ? Math.round(segundos / personas.length / 60) : 0,
    permanenciaMedianaMin: Math.round(mediana(porPersona)),
  };
}

/** Une personas de varias capacitaciones sin contar dos veces a quien asistió a varias. */
function unirPersonas(grupos: PersonaAgregada[][]): PersonaAgregada[] {
  const porClave = new Map<string, PersonaAgregada>();
  for (const grupo of grupos) {
    for (const p of grupo) {
      const previo = porClave.get(p.clave);
      if (previo) previo.segundos += p.segundos;
      else porClave.set(p.clave, { ...p });
    }
  }
  return [...porClave.values()];
}

/**
 * El árbol completo del plan (o de las áreas del tutor) para un trimestre o
 * el año entero. Consultas: una lista de capacitaciones con conexión, un
 * groupBy por capacitación, un groupBy por capacitación × persona, cuatro
 * groupBy por trimestre (uno por trimestre, siempre del año completo) y un
 * conteo de audiencia por combinación distinta de audiencia.
 */
export async function getTrazabilidadPlan(alcance: AlcanceTrazabilidad, trimestre: number | null): Promise<TrazabilidadPlan> {
  const { plan, areaIds } = alcance;
  const joinedAt = ventana(plan.year, trimestre);
  const whereLogs: Prisma.CallConnectionLogWhereInput = {
    activity: { planId: plan.id, ...(areaIds ? { areaId: { in: areaIds } } : {}) },
    ...(joinedAt ? { joinedAt } : {}),
  };

  const [actividades, porActividad, porPersona, ultima, ...porTrimestreCrudo] = await Promise.all([
    prisma.trainingActivity.findMany({
      where: {
        planId: plan.id,
        ...(areaIds ? { areaId: { in: areaIds } } : {}),
        callConnections: { some: joinedAt ? { joinedAt } : {} },
      },
      select: {
        id: true,
        title: true,
        areaId: true,
        quarters: true,
        targetAudience: true,
        audienceCommitteePlanId: true,
        area: { select: { name: true, sortOrder: true } },
        _count: { select: { sessions: true } },
      },
      orderBy: [{ area: { sortOrder: "asc" } }, { title: "asc" }],
    }),
    prisma.callConnectionLog.groupBy({ by: ["activityId"], where: whereLogs, _count: { _all: true }, _sum: { durationSeconds: true } }),
    prisma.callConnectionLog.groupBy({
      by: ["activityId", "userId", "externalParticipantId"],
      where: whereLogs,
      _sum: { durationSeconds: true },
    }),
    prisma.callConnectionLog.aggregate({ where: whereLogs, _max: { leftAt: true } }),
    ...[1, 2, 3, 4].map((t) =>
      prisma.callConnectionLog.groupBy({
        by: ["activityId", "userId", "externalParticipantId"],
        where: { activity: whereLogs.activity, joinedAt: ventana(plan.year, t) },
        _count: { _all: true },
        _sum: { durationSeconds: true },
      })
    ),
  ]);

  // Personas por capacitación, una sola pasada sobre el groupBy.
  const personasPorActividad = new Map<string, PersonaAgregada[]>();
  for (const g of porPersona) {
    const lista = personasPorActividad.get(g.activityId) ?? [];
    lista.push({ clave: g.userId ?? `ext:${g.externalParticipantId}`, externo: !g.userId, segundos: g._sum.durationSeconds ?? 0 });
    personasPorActividad.set(g.activityId, lista);
  }
  const tramosPorActividad = new Map(porActividad.map((g) => [g.activityId, { tramos: g._count._all, segundos: g._sum.durationSeconds ?? 0 }]));

  // Trimestres: por capacitación y del plan completo (siempre año entero).
  const trimestrePorActividad = new Map<string, TrimestreConexion[]>();
  const porTrimestre: TrimestreConexion[] = porTrimestreCrudo.map((grupos, i) => {
    const t = i + 1;
    const personasPlan = new Set<string>();
    let tramos = 0;
    let segundos = 0;
    const porAct = new Map<string, { tramos: number; segundos: number; personas: Set<string> }>();
    for (const g of grupos) {
      const clave = g.userId ?? `ext:${g.externalParticipantId}`;
      personasPlan.add(clave);
      tramos += g._count._all;
      segundos += g._sum.durationSeconds ?? 0;
      const a = porAct.get(g.activityId) ?? { tramos: 0, segundos: 0, personas: new Set<string>() };
      a.tramos += g._count._all;
      a.segundos += g._sum.durationSeconds ?? 0;
      a.personas.add(clave);
      porAct.set(g.activityId, a);
    }
    for (const [activityId, a] of porAct) {
      const lista = trimestrePorActividad.get(activityId) ?? [];
      lista.push({ trimestre: t, tramos: a.tramos, personas: a.personas.size, minutos: Math.round(a.segundos / 60) });
      trimestrePorActividad.set(activityId, lista);
    }
    return { trimestre: t, tramos, personas: personasPlan.size, minutos: Math.round(segundos / 60) };
  });

  // Audiencia objetivo: un conteo por combinación distinta, no por capacitación.
  const planAudiencia = { id: plan.id, targetDepartment: plan.targetDepartment, kind: plan.kind };
  const claveAudiencia = (a: { targetAudience: CourseAudience; audienceCommitteePlanId: string | null }) =>
    `${a.targetAudience}|${a.audienceCommitteePlanId ?? ""}`;
  const audienciaPorClave = new Map<string, Promise<number | null>>();
  for (const a of actividades) {
    const clave = claveAudiencia(a);
    if (!audienciaPorClave.has(clave)) {
      audienciaPorClave.set(
        clave,
        contarAudiencia({ targetAudience: a.targetAudience, audienceCommitteePlanId: a.audienceCommitteePlanId, plan: planAudiencia }).catch(() => null)
      );
    }
  }
  const audienciaResuelta = new Map<string, number | null>();
  for (const [clave, p] of audienciaPorClave) audienciaResuelta.set(clave, await p);

  // Árbol Área → Capacitación.
  const areasPorId = new Map<string, AreaTrazada & { sortOrder: number }>();
  for (const a of actividades) {
    const personas = personasPorActividad.get(a.id) ?? [];
    const { tramos, segundos } = tramosPorActividad.get(a.id) ?? { tramos: 0, segundos: 0 };
    const kpis = kpisDe(personas, tramos, segundos);
    const audiencia = audienciaResuelta.get(claveAudiencia(a)) ?? null;
    const capacitacion: CapacitacionTrazada = {
      id: a.id,
      titulo: a.title,
      areaId: a.areaId,
      areaNombre: a.area?.name ?? SIN_AREA,
      quarters: a.quarters,
      jornadas: a._count.sessions,
      kpis,
      audiencia,
      porcentajeConectados: audiencia && audiencia > 0 ? Math.min(100, Math.round((kpis.personasInternas / audiencia) * 100)) : null,
      porTrimestre: (trimestrePorActividad.get(a.id) ?? []).sort((x, y) => x.trimestre - y.trimestre),
    };
    const areaId = a.areaId ?? "sin-area";
    const area = areasPorId.get(areaId) ?? {
      id: areaId,
      nombre: a.area?.name ?? SIN_AREA,
      indice: 0,
      sortOrder: a.area?.sortOrder ?? Number.MAX_SAFE_INTEGER,
      kpis: kpisDe([], 0, 0),
      capacitaciones: [],
    };
    area.capacitaciones.push(capacitacion);
    areasPorId.set(areaId, area);
  }

  const areas: AreaTrazada[] = [...areasPorId.values()]
    .sort((x, y) => x.sortOrder - y.sortOrder || x.nombre.localeCompare(y.nombre, "es"))
    .map((area, indice) => {
      const personas = unirPersonas(area.capacitaciones.map((c) => personasPorActividad.get(c.id) ?? []));
      const tramos = area.capacitaciones.reduce((s, c) => s + c.kpis.tramos, 0);
      const segundos = area.capacitaciones.reduce((s, c) => s + (tramosPorActividad.get(c.id)?.segundos ?? 0), 0);
      area.capacitaciones.sort((x, y) => y.kpis.minutos - x.kpis.minutos);
      return { id: area.id, nombre: area.nombre, indice, kpis: kpisDe(personas, tramos, segundos), capacitaciones: area.capacitaciones };
    });

  const todas = unirPersonas([...personasPorActividad.values()]);
  const tramosTotal = porActividad.reduce((s, g) => s + g._count._all, 0);
  const segundosTotal = porActividad.reduce((s, g) => s + (g._sum.durationSeconds ?? 0), 0);
  const ahora = trimestreActual();

  return {
    trimestre,
    anio: plan.year,
    trimestreEnCurso: ahora.anio === plan.year ? ahora.trimestre : null,
    resumen: {
      ...kpisDe(todas, tramosTotal, segundosTotal),
      areas: areas.length,
      capacitaciones: actividades.length,
      jornadas: actividades.reduce((s, a) => s + a._count.sessions, 0),
    },
    porTrimestre,
    areas,
    ultimaConexion: ultima._max.leftAt?.toISOString() ?? null,
  };
}

export type FilaPersona = {
  clave: string;
  nombre: string;
  externo: boolean;
  activityId: string;
  capacitacion: string;
  areaId: string | null;
  area: string;
  conexiones: number;
  minutos: number;
  primeraConexion: Date;
  ultimaConexion: Date;
};

export type FiltroPersonas = {
  trimestre: number | null;
  areaId?: string | null;
  activityId?: string | null;
  buscar?: string | null;
  pagina?: number;
  porPagina?: number;
};

/**
 * Detalle nominal: una fila = una persona en una capacitación, con la suma de
 * sus tramos. Filtrable por área, capacitación, trimestre y nombre; paginado
 * y acotado por conexiones reales. Sin N+1: los títulos de las
 * capacitaciones de la página se traen en una sola consulta.
 */
export async function getPersonasTrazabilidad(
  alcance: AlcanceTrazabilidad,
  filtro: FiltroPersonas
): Promise<{ filas: FilaPersona[]; total: number; pagina: number; porPagina: number; minutosMaximo: number }> {
  const { plan, areaIds } = alcance;
  const porPagina = Math.min(Math.max(filtro.porPagina ?? 50, 10), 500);
  const pagina = Math.max(filtro.pagina ?? 1, 1);
  const buscar = filtro.buscar?.trim();
  const joinedAt = ventana(plan.year, filtro.trimestre);

  // El área pedida debe estar dentro del alcance del tutor: fuera de él no hay nada que mostrar.
  const areaFiltro = filtro.areaId && filtro.areaId !== "sin-area" ? filtro.areaId : null;
  const sinArea = filtro.areaId === "sin-area";
  if ((areaFiltro && areaIds && !areaIds.includes(areaFiltro)) || (sinArea && areaIds)) {
    return { filas: [], total: 0, pagina, porPagina, minutosMaximo: 1 };
  }
  const areaWhere = areaFiltro ? { areaId: areaFiltro } : sinArea ? { areaId: null } : areaIds ? { areaId: { in: areaIds } } : {};

  const where: Prisma.CallConnectionLogWhereInput = {
    activity: { planId: plan.id, ...areaWhere },
    ...(filtro.activityId ? { activityId: filtro.activityId } : {}),
    ...(joinedAt ? { joinedAt } : {}),
    ...(buscar ? { displayName: { contains: buscar, mode: "insensitive" } } : {}),
  };
  const by: Prisma.CallConnectionLogScalarFieldEnum[] = ["activityId", "userId", "externalParticipantId", "displayName"];

  const [grupos, todos, maximo] = await Promise.all([
    prisma.callConnectionLog.groupBy({
      by,
      where,
      _count: { _all: true },
      _sum: { durationSeconds: true },
      _min: { joinedAt: true },
      _max: { leftAt: true },
      orderBy: [{ _sum: { durationSeconds: "desc" } }, { displayName: "asc" }],
      skip: (pagina - 1) * porPagina,
      take: porPagina,
    }),
    prisma.callConnectionLog.groupBy({ by, where }),
    prisma.callConnectionLog.groupBy({ by, where, _sum: { durationSeconds: true }, orderBy: { _sum: { durationSeconds: "desc" } }, take: 1 }),
  ]);

  const activityIds = [...new Set(grupos.map((g) => g.activityId))];
  const actividades = activityIds.length
    ? await prisma.trainingActivity.findMany({
        where: { id: { in: activityIds } },
        select: { id: true, title: true, areaId: true, area: { select: { name: true } } },
      })
    : [];
  const actividadPorId = new Map(actividades.map((a) => [a.id, a]));

  return {
    filas: grupos.map((g) => {
      const a = actividadPorId.get(g.activityId);
      return {
        clave: `${g.activityId}-${g.userId ?? g.externalParticipantId}`,
        nombre: g.displayName,
        externo: !g.userId,
        activityId: g.activityId,
        capacitacion: a?.title ?? "Capacitación",
        areaId: a?.areaId ?? null,
        area: a?.area?.name ?? SIN_AREA,
        conexiones: g._count._all,
        minutos: Math.round((g._sum.durationSeconds ?? 0) / 60),
        primeraConexion: g._min.joinedAt!,
        ultimaConexion: g._max.leftAt!,
      };
    }),
    total: todos.length,
    pagina,
    porPagina,
    minutosMaximo: Math.max(1, Math.round((maximo[0]?._sum.durationSeconds ?? 0) / 60)),
  };
}
