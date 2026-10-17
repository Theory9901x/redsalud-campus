import type { PlanMejoraEstado } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPlanIndicators, type Indicadores, type MedicionActividad, type PlanIndicadores } from "@/lib/plan-indicadores";
import { semaforo, type Semaforo } from "@/lib/semaforo-indicadores";
import { trimestreActual } from "@/lib/training-plans";
import { CATALOGO, CODIGOS, MESES_TRIMESTRE, ROMANO, type CodigoIndicador, type EstadoMejoraVisible } from "@/components/indicadores/catalogo";

/**
 * GESTIÓN DE INDICADORES: lo que hace falta para tratar cada indicador POR
 * SEPARADO -como una ficha de Almera, pero alimentada sola-.
 *
 * No duplica ninguna fórmula: las mediciones salen de getPlanIndicators
 * (lib/plan-indicadores.ts) y aquí solo se reorganizan por indicador, POR
 * CAPACITACIÓN (la unidad de medida), por periodo y por área, y se les pega
 * lo que la plataforma no puede calcular: el análisis cualitativo que
 * escribe el responsable y los planes de mejora con su trazabilidad.
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

/** Valor de un indicador en UNA capacitación, en un corte. */
export type ValorCapacitacion = {
  valor: number | null;
  sem: Semaforo;
  /** Numerador y denominador de la fórmula en esa capacitación. */
  numerador: number;
  denominador: number;
  /** Las variables en palabras: "Pre 62,5 → Post 81 · 12 personas", "34 de 120 convocados"… */
  detalle: string;
};

/**
 * UNA CAPACITACIÓN medida con el indicador: la fila principal de toda
 * ficha. Lo institucional y lo de área son el consolidado de estas.
 */
export type CapacitacionMedida = ValorCapacitacion & {
  activityId: string;
  titulo: string;
  areaId: string;
  areaNombre: string;
  programa: string | null;
  trimestres: number[];
  /** Trimestre con el que se abre la capacitación (?t=): el vigente si está programado, si no el último ya pasado. */
  trimestreEnlace: number;
  jornada: string | null;
  estado: "borrador" | "abierta" | "cerrada";
  cerradaEl: string | null;
  /** Solo adherencia: la jornada sigue abierta y el dato se mueve con cada intento. */
  preliminar: boolean;
  /** La misma medición acotada a cada trimestre. */
  porTrimestre: Record<number, ValorCapacitacion>;
  planesAbiertos: number;
};

export type IndicadorArea = {
  areaId: string;
  areaNombre: string;
  anual: Medicion;
  trimestres: Medicion[];
  planesAbiertos: number;
  /** Capacitaciones con dato / programadas en el área. */
  medidas: number;
  programadas: number;
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
  /** Todas las capacitaciones del alcance, cada una con su medición: la unidad del indicador. Lo peor primero. */
  capacitaciones: CapacitacionMedida[];
};

export type ResumenIndicador = {
  codigo: CodigoIndicador;
  anual: Medicion;
  actual: Medicion;
  trimestres: Medicion[];
  planesAbiertos: number;
  planesVencidos: number;
  /** Capacitaciones con dato / programadas en el alcance. */
  medidas: number;
  programadas: number;
};

/** Una capacitación dentro de la fila de su área en la matriz: su semáforo en los tres indicadores. */
export type CapacitacionMatriz = {
  activityId: string;
  titulo: string;
  programa: string | null;
  trimestres: number[];
  trimestreEnlace: number;
  estado: "borrador" | "abierta" | "cerrada";
  preliminar: boolean;
  celdas: Record<CodigoIndicador, ValorCapacitacion>;
};

export type FilaMatriz = {
  areaId: string;
  areaNombre: string;
  celdas: Record<CodigoIndicador, Medicion>;
  planesAbiertos: number;
  programadas: number;
  medidas: Record<CodigoIndicador, number>;
  capacitaciones: CapacitacionMatriz[];
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
  return t === null ? `Consolidado ${anio}` : `Trimestre ${ROMANO[t - 1]} · ${MESES_TRIMESTRE[t - 1]}`;
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
      variables = [ind.adherencia.actividadesMedidas, ind.adherencia.personas];
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

// ---------------------------------------------------------------- por capacitación

const nota = (x: number) => String(Math.round(x * 10) / 10).replace(".", ",");
const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;

/**
 * El indicador aplicado a UNA capacitación, en el año (`t` null) o en un
 * trimestre. Adherencia: (promedio post − promedio pre) ÷ promedio pre × 100
 * sobre quienes tienen ambos intentos en ESA capacitación. Cobertura: tiene
 * curso (1/1) o no (0/1). Asistencia: personas con asistencia ÷ audiencia.
 */
export function medirCapacitacion(codigo: CodigoIndicador, m: MedicionActividad, t: number | null): ValorCapacitacion {
  switch (codigo) {
    case "PIC-ADH-01": {
      const c = t ? m.cicloPorTrimestre[t] : m.ciclo;
      if (!c || c.personas === 0) {
        const detalle = !m.conContenido ? "Sin evaluación presaber / postsaber configurada" : m.estado === "borrador" ? "Jornada sin abrir" : "Nadie ha completado presaber y postsaber";
        return { valor: null, sem: "sin-datos", numerador: 0, denominador: 0, detalle };
      }
      const valor = Math.round(((c.promedioPost - c.promedioPre) / c.promedioPre) * 100);
      return {
        valor,
        sem: semaforo(valor),
        numerador: Math.round((c.promedioPost - c.promedioPre) * 10) / 10,
        denominador: Math.round(c.promedioPre * 10) / 10,
        detalle: `Pre ${nota(c.promedioPre)} → Post ${nota(c.promedioPost)} · ${plural(c.personas, "persona", "personas")}`,
      };
    }
    case "PIC-COB-02":
      return m.conContenido
        ? { valor: 100, sem: "verde", numerador: 1, denominador: 1, detalle: "Con evaluación" }
        : { valor: 0, sem: "rojo", numerador: 0, denominador: 1, detalle: "Sin evaluación" };
    case "PIC-ASI-03": {
      const asistentes = t ? (m.asistentesPorTrimestre[t] ?? 0) : m.asistentes;
      if (m.audiencia === 0) return { valor: null, sem: "sin-datos", numerador: asistentes, denominador: 0, detalle: "Sin audiencia objetivo definida" };
      const valor = Math.round((asistentes / m.audiencia) * 100);
      return { valor, sem: semaforo(valor), numerador: asistentes, denominador: m.audiencia, detalle: `${asistentes} de ${m.audiencia} convocados` };
    }
  }
}

/** Trimestre con el que se abre la capacitación: el vigente si está programado; si no, el último ya pasado; si no, el primero. */
function trimestreEnlace(quarters: number[], vigente: number) {
  const q = [...quarters].filter((x) => x >= 1 && x <= 4).sort((a, b) => a - b);
  if (q.length === 0) return vigente;
  if (q.includes(vigente)) return vigente;
  return [...q].reverse().find((x) => x < vigente) ?? q[0];
}

function aCapacitacion(codigo: CodigoIndicador, m: MedicionActividad, vigente: number, planesAbiertos: number): CapacitacionMedida {
  const anual = medirCapacitacion(codigo, m, null);
  const porTrimestre = Object.fromEntries([1, 2, 3, 4].map((t) => [t, medirCapacitacion(codigo, m, t)])) as Record<number, ValorCapacitacion>;
  return {
    ...anual,
    activityId: m.activityId,
    titulo: m.titulo,
    areaId: m.areaId,
    areaNombre: m.areaNombre,
    programa: m.programa,
    trimestres: m.quarters,
    trimestreEnlace: trimestreEnlace(m.quarters, vigente),
    jornada: m.jornada ? fechaCorta(m.jornada) : null,
    estado: m.estado,
    cerradaEl: m.cerradaEl ? fechaCorta(m.cerradaEl) : null,
    preliminar: codigo === "PIC-ADH-01" && anual.valor !== null && m.preliminar,
    porTrimestre,
    planesAbiertos,
  };
}

/** Orden de gestión: lo peor primero (rojo, amarillo, verde) y lo que no tiene dato al final. */
const PESO_SEM: Record<Semaforo, number> = { rojo: 0, amarillo: 1, verde: 2, "sin-datos": 3 };
export function ordenarPeorPrimero<T extends { sem: Semaforo; valor: number | null; titulo: string }>(xs: T[]) {
  return [...xs].sort((a, b) => PESO_SEM[a.sem] - PESO_SEM[b.sem] || (a.valor ?? 0) - (b.valor ?? 0) || a.titulo.localeCompare(b.titulo, "es"));
}

const conDato = (codigo: CodigoIndicador, xs: MedicionActividad[]) => xs.filter((m) => medirCapacitacion(codigo, m, null).valor !== null).length;

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
      medidas: conDato(codigo, datos.actividades),
      programadas: datos.actividades.length,
    };
  });

  const matriz: FilaMatriz[] = datos.porArea.map((a) => {
    const suyas = datos.actividades.filter((m) => m.areaId === a.areaId);
    const capacitaciones: CapacitacionMatriz[] = suyas.map((m) => ({
      activityId: m.activityId,
      titulo: m.titulo,
      programa: m.programa,
      trimestres: m.quarters,
      trimestreEnlace: trimestreEnlace(m.quarters, tv),
      estado: m.estado,
      preliminar: m.preliminar && m.ciclo !== null,
      celdas: Object.fromEntries(CODIGOS.map((c) => [c, medirCapacitacion(c, m, null)])) as Record<CodigoIndicador, ValorCapacitacion>,
    }));
    return {
      areaId: a.areaId,
      areaNombre: a.areaNombre,
      celdas: Object.fromEntries(CODIGOS.map((c) => [c, medir(c, a, null, anio)])) as Record<CodigoIndicador, Medicion>,
      planesAbiertos: planes.filter((p) => p.areaId === a.areaId && sinCerrar(p)).length,
      programadas: suyas.length,
      medidas: Object.fromEntries(CODIGOS.map((c) => [c, conDato(c, suyas)])) as Record<CodigoIndicador, number>,
      // Lo peor primero (por la adherencia, el principal): la fila se despliega para ver qué capacitación arrastra el área.
      capacitaciones: capacitaciones.sort((x, y) => PESO_SEM[x.celdas["PIC-ADH-01"].sem] - PESO_SEM[y.celdas["PIC-ADH-01"].sem] || x.titulo.localeCompare(y.titulo, "es")),
    };
  });

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

  const porArea: IndicadorArea[] = datos.porArea.map((a) => {
    const suyas = datos.actividades.filter((m) => m.areaId === a.areaId);
    return {
      areaId: a.areaId,
      areaNombre: a.areaNombre,
      anual: medir(codigo, a, null, anio),
      trimestres: medirSerie(codigo, a.porTrimestre, anio),
      planesAbiertos: planes.filter((p) => p.areaId === a.areaId && sinCerrar(p)).length,
      medidas: conDato(codigo, suyas),
      programadas: suyas.length,
    };
  });

  const tv = trimestreVigente(anio);
  const universo = areaId ? datos.actividades.filter((m) => m.areaId === areaId) : datos.actividades;
  const capacitaciones = ordenarPeorPrimero(
    universo.map((m) => aCapacitacion(codigo, m, tv, planes.filter((p) => p.activityId === m.activityId && sinCerrar(p)).length))
  );

  return {
    codigo,
    planId,
    planTitulo: datos.planTitulo,
    anio,
    trimestreActual: tv,
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
    capacitaciones,
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
