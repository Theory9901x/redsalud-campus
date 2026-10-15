import type { PlanMejoraEstado } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPlanIndicators, type Indicadores, type PlanIndicadores } from "@/lib/plan-indicadores";
import { semaforo, type Semaforo } from "@/lib/semaforo-indicadores";
import { trimestreActual } from "@/lib/training-plans";
import { CATALOGO, CODIGOS, MESES_TRIMESTRE, ROMANO, type CodigoIndicador, type EstadoMejoraVisible } from "@/components/indicadores/catalogo";

/**
 * GESTIÓN DE INDICADORES: lo que hace falta para tratar cada indicador POR
 * SEPARADO -como una ficha de Almera, pero alimentada sola-.
 *
 * No duplica ninguna fórmula: las mediciones salen de getPlanIndicators
 * (lib/plan-indicadores.ts) y aquí solo se reorganizan por indicador, por
 * periodo y por área, y se les pega lo que la plataforma no puede calcular:
 * el análisis cualitativo que escribe el responsable y los planes de mejora
 * con su trazabilidad.
 *
 * Todas las fechas salen ya formateadas (es-CO, hora de Colombia): el
 * cliente no vuelve a formatear nada y la hidratación no se desajusta.
 */

export type EstadoPeriodo = "cerrado" | "en-curso" | "futuro";

export type Medicion = {
  /** 1–4, o null para el acumulado del año. */
  trimestre: number | null;
  etiqueta: string;
  valor: number | null;
  sem: Semaforo;
  /** Las dos variables de la ficha, en el orden de `FichaTecnica.columnas`. */
  variables: [number, number];
  periodo: EstadoPeriodo;
  /** Quién produjo el dato: siempre la plataforma, en tiempo real. */
  generado: string;
};

export type AlcanceIndicador =
  | { tipo: "institucional" }
  | { tipo: "area"; areaId: string; areaNombre: string }
  | { tipo: "mis-areas"; areaIds: string[]; nombres: string[] };

export type AnalisisPeriodo = {
  id: string;
  trimestre: number;
  texto: string;
  autor: string | null;
  areaId: string | null;
  areaNombre: string | null;
  actualizado: string;
  actualizadoISO: string;
};

export type SeguimientoVista = { id: string; texto: string; avance: number; autor: string | null; fecha: string };

export type PlanMejoraVista = {
  id: string;
  codigo: CodigoIndicador;
  titulo: string;
  hallazgo: string;
  acciones: string;
  estado: EstadoMejoraVisible;
  estadoGuardado: PlanMejoraEstado;
  anio: number;
  trimestre: number | null;
  areaId: string | null;
  areaNombre: string | null;
  activityId: string | null;
  activityTitulo: string | null;
  responsable: string;
  fechaCompromiso: string;
  fechaCompromisoISO: string;
  avance: number;
  cierreTexto: string | null;
  cerradoEl: string | null;
  creadoPor: string | null;
  creadoEl: string;
  seguimientos: SeguimientoVista[];
};

export type ConteosMejora = { abiertos: number; enCurso: number; vencidos: number; cerrados: number };

export type IndicadorArea = {
  areaId: string;
  areaNombre: string;
  anual: Medicion;
  trimestres: Medicion[];
  planesAbiertos: number;
};

export type IndicadorGestion = {
  codigo: CodigoIndicador;
  planId: string;
  planTitulo: string;
  anio: number;
  trimestreActual: number;
  alcance: AlcanceIndicador;
  anual: Medicion;
  trimestres: Medicion[];
  analisis: AnalisisPeriodo[];
  planesMejora: PlanMejoraVista[];
  conteos: ConteosMejora;
  porArea: IndicadorArea[];
};

export type ResumenIndicador = {
  codigo: CodigoIndicador;
  anual: Medicion;
  actual: Medicion;
  trimestres: Medicion[];
  planesAbiertos: number;
  planesVencidos: number;
};

export type FilaMatriz = {
  areaId: string;
  areaNombre: string;
  celdas: Record<CodigoIndicador, Medicion>;
  planesAbiertos: number;
};

export type ResumenIndicadores = {
  planId: string;
  planTitulo: string;
  anio: number;
  trimestreActual: number;
  alcance: AlcanceIndicador;
  indicadores: ResumenIndicador[];
  matriz: FilaMatriz[];
};

/** Catálogos para el formulario de plan de mejora: a qué se puede asignar. */
export type ContextoFormulario = {
  anio: number;
  areas: { id: string; nombre: string }[];
  actividades: { id: string; titulo: string; areaId: string | null }[];
  responsables: { id: string; nombre: string }[];
};

// ---------------------------------------------------------------- formato

const FECHA = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Bogota" });
const FECHA_HORA = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Bogota",
});
const limpiar = (s: string) => s.replace(/\s/g, " ").replace(/\.$/, "");
export const fechaCorta = (d: Date) => limpiar(FECHA.format(d));
export const fechaHora = (d: Date) => limpiar(FECHA_HORA.format(d));

export function etiquetaTrimestre(t: number | null, anio: number) {
  return t === null ? `Acumulado ${anio}` : `Trimestre ${ROMANO[t - 1]} · ${MESES_TRIMESTRE[t - 1]}`;
}

/**
 * Trimestre "vigente" del plan: el que está corriendo si el plan es de este
 * año; el IV si la vigencia ya pasó; el I si todavía no empieza.
 */
export function trimestreVigente(anioPlan: number) {
  const hoy = trimestreActual();
  if (hoy.anio === anioPlan) return hoy.trimestre;
  return hoy.anio > anioPlan ? 4 : 1;
}

function estadoPeriodo(t: number | null, anioPlan: number): EstadoPeriodo {
  if (t === null) return "en-curso";
  const hoy = trimestreActual();
  if (hoy.anio > anioPlan) return "cerrado";
  if (hoy.anio < anioPlan) return "futuro";
  return t < hoy.trimestre ? "cerrado" : t === hoy.trimestre ? "en-curso" : "futuro";
}

/** Una medición de `ind` para el indicador `codigo`: valor, semáforo y sus dos variables. */
function medir(codigo: CodigoIndicador, ind: Indicadores, t: number | null, anio: number): Medicion {
  let valor: number | null;
  let variables: [number, number];
  switch (codigo) {
    case "PIC-ADH-01":
      valor = ind.adherencia.valor;
      variables = [ind.adherencia.actividadesCerradas, ind.adherencia.personas];
      break;
    case "PIC-COB-02":
      valor = ind.cobertura.total > 0 ? ind.cobertura.valor : null;
      variables = [ind.cobertura.total, ind.cobertura.conContenido];
      break;
    case "PIC-ASI-03":
      valor = ind.asistencia.audiencia > 0 ? ind.asistencia.valor : null;
      variables = [ind.asistencia.audiencia, ind.asistencia.asistentes];
      break;
  }
  const periodo = estadoPeriodo(t, anio);
  return {
    trimestre: t,
    etiqueta: etiquetaTrimestre(t, anio),
    valor,
    sem: semaforo(valor),
    variables,
    periodo,
    generado: periodo === "futuro" ? "Plataforma · sin iniciar" : "Plataforma · tiempo real",
  };
}

function medirSerie(codigo: CodigoIndicador, serie: { trimestre: number; indicadores: Indicadores }[], anio: number) {
  return serie.map((s) => medir(codigo, s.indicadores, s.trimestre, anio));
}

// ---------------------------------------------------------------- planes de mejora

type PlanMejoraCrudo = Awaited<ReturnType<typeof leerPlanesMejora>>[number];

function leerPlanesMejora(where: { planId: string; codigo?: string; areaId?: string | { in: string[] } | null }) {
  return prisma.planMejora.findMany({
    where,
    orderBy: [{ estado: "asc" }, { fechaCompromiso: "asc" }],
    include: {
      area: { select: { name: true } },
      activity: { select: { title: true } },
      responsable: { select: { fullName: true } },
      creadoPor: { select: { fullName: true } },
      seguimientos: { orderBy: { createdAt: "desc" }, include: { autor: { select: { fullName: true } } } },
    },
  });
}

/** "Vencido" se deduce al leer: abierto o en curso con la fecha de compromiso pasada. */
export function estadoVisible(p: { estado: PlanMejoraEstado; fechaCompromiso: Date }, hoy = new Date()): EstadoMejoraVisible {
  if (p.estado === "CERRADO") return "CERRADO";
  return p.fechaCompromiso < hoy ? "VENCIDO" : p.estado;
}

function aVista(p: PlanMejoraCrudo): PlanMejoraVista {
  const estado = estadoVisible(p);
  const ultimo = p.seguimientos[0];
  return {
    id: p.id,
    codigo: p.codigo as CodigoIndicador,
    titulo: p.titulo,
    hallazgo: p.hallazgo,
    acciones: p.acciones,
    estado,
    estadoGuardado: p.estado,
    anio: p.anio,
    trimestre: p.trimestre,
    areaId: p.areaId,
    areaNombre: p.area?.name ?? null,
    activityId: p.activityId,
    activityTitulo: p.activity?.title ?? null,
    responsable: p.responsable?.fullName ?? p.responsableLabel ?? "Sin asignar",
    fechaCompromiso: fechaCorta(p.fechaCompromiso),
    fechaCompromisoISO: p.fechaCompromiso.toISOString().slice(0, 10),
    avance: p.estado === "CERRADO" ? 100 : (ultimo?.avance ?? 0),
    cierreTexto: p.cierreTexto,
    cerradoEl: p.cerradoAt ? fechaCorta(p.cerradoAt) : null,
    creadoPor: p.creadoPor?.fullName ?? null,
    creadoEl: fechaCorta(p.createdAt),
    seguimientos: p.seguimientos.map((s) => ({
      id: s.id,
      texto: s.texto,
      avance: s.avance,
      autor: s.autor?.fullName ?? null,
      fecha: fechaHora(s.createdAt),
    })),
  };
}

function contar(planes: PlanMejoraVista[]): ConteosMejora {
  return {
    abiertos: planes.filter((p) => p.estado === "ABIERTO").length,
    enCurso: planes.filter((p) => p.estado === "EN_CURSO").length,
    vencidos: planes.filter((p) => p.estado === "VENCIDO").length,
    cerrados: planes.filter((p) => p.estado === "CERRADO").length,
  };
}

const sinCerrar = (p: PlanMejoraVista) => p.estado !== "CERRADO";

// ---------------------------------------------------------------- lecturas

function describirAlcance(datos: PlanIndicadores, areaIds: string[] | null, areaId: string | null): AlcanceIndicador {
  if (areaId) {
    const a = datos.porArea.find((x) => x.areaId === areaId);
    return { tipo: "area", areaId, areaNombre: a?.areaNombre ?? "Área" };
  }
  if (areaIds) {
    const mias = datos.porArea.filter((a) => areaIds.includes(a.areaId));
    return { tipo: "mis-areas", areaIds, nombres: mias.map((a) => a.areaNombre) };
  }
  return { tipo: "institucional" };
}

/**
 * VISTA GENERAL: una tarjeta por indicador (acumulado, trimestre vigente,
 * tendencia, planes de mejora abiertos) y la matriz área × indicador.
 * `areaIds` null = institucional; con lista, solo esas áreas (tutor).
 */
export async function getResumenIndicadores(planId: string, areaIds: string[] | null): Promise<ResumenIndicadores | null> {
  const plan = await prisma.trainingPlan.findUnique({ where: { id: planId }, select: { year: true } });
  if (!plan) return null;
  const datos = await getPlanIndicators(planId, areaIds);
  if (!datos) return null;

  const anio = plan.year;
  const tv = trimestreVigente(anio);
  const planes = (await leerPlanesMejora({ planId, ...(areaIds ? { areaId: { in: areaIds } } : {}) })).map(aVista);

  const indicadores: ResumenIndicador[] = CODIGOS.map((codigo) => {
    const trimestres = medirSerie(codigo, datos.porTrimestre, anio);
    const suyos = planes.filter((p) => p.codigo === codigo);
    return {
      codigo,
      anual: medir(codigo, datos.anual, null, anio),
      actual: trimestres[tv - 1],
      trimestres,
      planesAbiertos: suyos.filter(sinCerrar).length,
      planesVencidos: suyos.filter((p) => p.estado === "VENCIDO").length,
    };
  });

  const matriz: FilaMatriz[] = datos.porArea.map((a) => ({
    areaId: a.areaId,
    areaNombre: a.areaNombre,
    celdas: Object.fromEntries(CODIGOS.map((c) => [c, medir(c, a, null, anio)])) as Record<CodigoIndicador, Medicion>,
    planesAbiertos: planes.filter((p) => p.areaId === a.areaId && sinCerrar(p)).length,
  }));

  return {
    planId,
    planTitulo: datos.planTitulo,
    anio,
    trimestreActual: tv,
    alcance: describirAlcance(datos, areaIds, null),
    indicadores,
    matriz,
  };
}

/**
 * FICHA DE UN INDICADOR: mediciones por trimestre y acumulado, análisis por
 * periodo, planes de mejora y desagregación por área.
 *
 * `areaId` acota la ficha a un área (el "?area=" de la URL). Sin él, el
 * universo es el de `areaIds` (institucional si es null).
 */
export async function getIndicadorGestion(
  planId: string,
  areaIds: string[] | null,
  codigo: CodigoIndicador,
  areaId: string | null
): Promise<IndicadorGestion | null> {
  const plan = await prisma.trainingPlan.findUnique({ where: { id: planId }, select: { year: true } });
  if (!plan) return null;
  const datos = await getPlanIndicators(planId, areaIds);
  if (!datos) return null;
  const anio = plan.year;

  const area = areaId ? datos.porArea.find((a) => a.areaId === areaId) : undefined;
  if (areaId && !area) return null;

  const base: Indicadores = area ?? datos.anual;
  const serie = area ? area.porTrimestre : datos.porTrimestre;

  // El análisis es del alcance exacto: institucional (areaId null) o de UN
  // área. Un tutor con varias áreas y sin área elegida ve los de todas las suyas.
  const filtroArea = areaId ? areaId : areaIds ? { in: areaIds } : null;
  const [analisis, planesCrudos] = await Promise.all([
    prisma.indicadorAnalisis.findMany({
      where: { planId, codigo, anio, areaId: filtroArea },
      orderBy: [{ trimestre: "desc" }, { updatedAt: "desc" }],
      include: { autor: { select: { fullName: true } }, area: { select: { name: true } } },
    }),
    // Los planes de mejora institucionales ven TODO: la trazabilidad por área
    // es precisamente lo que se consulta desde arriba.
    leerPlanesMejora({ planId, codigo, ...(filtroArea ? { areaId: filtroArea } : {}) }),
  ]);
  const planes = planesCrudos.map(aVista);

  const porArea: IndicadorArea[] = datos.porArea.map((a) => ({
    areaId: a.areaId,
    areaNombre: a.areaNombre,
    anual: medir(codigo, a, null, anio),
    trimestres: medirSerie(codigo, a.porTrimestre, anio),
    planesAbiertos: planes.filter((p) => p.areaId === a.areaId && sinCerrar(p)).length,
  }));

  return {
    codigo,
    planId,
    planTitulo: datos.planTitulo,
    anio,
    trimestreActual: trimestreVigente(anio),
    alcance: describirAlcance(datos, areaIds, areaId),
    anual: medir(codigo, base, null, anio),
    trimestres: medirSerie(codigo, serie, anio),
    analisis: analisis.map((x) => ({
      id: x.id,
      trimestre: x.trimestre,
      texto: x.texto,
      autor: x.autor?.fullName ?? null,
      areaId: x.areaId,
      areaNombre: x.area?.name ?? null,
      actualizado: fechaHora(x.updatedAt),
      actualizadoISO: x.updatedAt.toISOString(),
    })),
    planesMejora: planes,
    conteos: contar(planes),
    porArea,
  };
}

/** A qué se puede asignar un plan de mejora dentro del plan: áreas, capacitaciones y responsables. */
export async function getContextoFormulario(planId: string, areaIds: string[] | null): Promise<ContextoFormulario | null> {
  const plan = await prisma.trainingPlan.findUnique({
    where: { id: planId },
    select: {
      year: true,
      activities: {
        where: areaIds ? { areaId: { in: areaIds } } : {},
        select: { id: true, title: true, areaId: true, area: { select: { id: true, name: true } } },
        orderBy: { title: "asc" },
      },
    },
  });
  if (!plan) return null;

  const areas = [...new Map(plan.activities.filter((a) => a.area).map((a) => [a.area!.id, a.area!.name])).entries()]
    .map(([id, nombre]) => ({ id, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  const responsables = await prisma.user.findMany({
    where: { role: { in: ["TUTOR", "ADMIN"] }, status: "ACTIVE" },
    select: { id: true, fullName: true },
    orderBy: { fullName: "asc" },
  });

  return {
    anio: plan.year,
    areas,
    actividades: plan.activities.map((a) => ({ id: a.id, titulo: a.title, areaId: a.areaId })),
    responsables: responsables.map((r) => ({ id: r.id, nombre: r.fullName })),
  };
}

/** Nombre legible de la ficha: para títulos y auditoría. */
export function nombreIndicador(codigo: CodigoIndicador) {
  return CATALOGO[codigo].nombre;
}
