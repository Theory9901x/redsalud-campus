import { prisma } from "@/lib/prisma";
import { leerConfig, type OpcionPregunta, type TonoOpcion, type ValorRespuesta } from "@/lib/encuestas/tipos";
import { nivelSemaforo, type NivelSemaforo } from "@/components/training-plans/labels";

/**
 * MÉTRICAS DE LA ENCUESTA SIAU — única fuente de fórmulas.
 *
 * Modelo numérico. Cada opción de calificación lleva un `tono` semántico y
 * ese tono es el VALOR: la carita y el texto son solo presentación.
 *
 *   exc = 4 · bue = 3 · reg = 2 · mal = 1 · muymal = 0 · na = sin valor
 *
 * Dos indicadores, siempre sobre respuestas VÁLIDAS (se excluyen No aplica /
 * No responde / En blanco, como exige la Resolución 0256 de 2016):
 *
 *   ADHERENCIA (%)  = favorables (exc + bue) / válidas × 100
 *                     Es el criterio institucional ya en uso (y el del
 *                     informe SIHO: % satisfacción = (Bueno + Muy bueno) / total).
 *   PUNTAJE (%)     = promedio del valor / valor máximo de la escala × 100
 *                     Complementario: distingue "Excelente" de "Bueno".
 *
 * Adherencia general = promedio simple de la adherencia de cada pregunta
 * de calificación (P2 consolidada como una sola, P3…P8). Semáforo
 * institucional: verde ≥ 85 %, amarillo 70–84,9 %, rojo < 70 %.
 *
 * Variables de cruce (todas de la propia encuesta): fecha, sede/municipio,
 * servicio (P1), sexo, EPS. La encuesta no pide edad ni tipo de usuario.
 */

export const VALOR_TONO: Record<TonoOpcion, number | null> = { exc: 4, bue: 3, reg: 2, mal: 1, muymal: 0, na: null };
export const ES_FAVORABLE: Record<TonoOpcion, boolean> = { exc: true, bue: true, reg: false, mal: false, muymal: false, na: false };
export const CODIGO_SIAU = "PM-7-SIAU";

// ---------------------------------------------------------------- periodos

export type TipoPeriodo = "mensual" | "trimestral" | "anual";
export type Periodo = { tipo: TipoPeriodo; anio: number; mes?: number; trimestre?: number };

/** Rango [desde, hasta) del periodo, en hora de Bogotá (UTC-5). */
export function rangoDePeriodo(p: Periodo): { desde: Date; hasta: Date; etiqueta: string; clave: string } {
  const bogota = (a: number, m: number, d: number) => new Date(Date.UTC(a, m - 1, d, 5, 0, 0));
  if (p.tipo === "mensual") {
    const m = p.mes ?? 1;
    const sig = m === 12 ? [p.anio + 1, 1] : [p.anio, m + 1];
    return { desde: bogota(p.anio, m, 1), hasta: bogota(sig[0], sig[1], 1), etiqueta: `${NOMBRE_MES[m - 1]} ${p.anio}`, clave: `${p.anio}-${String(m).padStart(2, "0")}` };
  }
  if (p.tipo === "trimestral") {
    const t = p.trimestre ?? 1;
    const m1 = (t - 1) * 3 + 1;
    const fin = t === 4 ? [p.anio + 1, 1] : [p.anio, m1 + 3];
    return { desde: bogota(p.anio, m1, 1), hasta: bogota(fin[0], fin[1], 1), etiqueta: `${t}º trimestre ${p.anio} (${NOMBRE_MES[m1 - 1]}–${NOMBRE_MES[m1 + 1]})`, clave: `${p.anio}-T${t}` };
  }
  return { desde: bogota(p.anio, 1, 1), hasta: bogota(p.anio + 1, 1, 1), etiqueta: `Año ${p.anio}`, clave: String(p.anio) };
}

/** El periodo inmediatamente anterior, para comparativos. */
export function periodoAnterior(p: Periodo): Periodo {
  if (p.tipo === "mensual") return (p.mes ?? 1) === 1 ? { tipo: "mensual", anio: p.anio - 1, mes: 12 } : { tipo: "mensual", anio: p.anio, mes: (p.mes ?? 1) - 1 };
  if (p.tipo === "trimestral") return (p.trimestre ?? 1) === 1 ? { tipo: "trimestral", anio: p.anio - 1, trimestre: 4 } : { tipo: "trimestral", anio: p.anio, trimestre: (p.trimestre ?? 1) - 1 };
  return { tipo: "anual", anio: p.anio - 1 };
}

export const NOMBRE_MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// ---------------------------------------------------------------- filtros

export type FiltrosSiau = {
  desde?: Date;
  hasta?: Date;
  /** Texto literal de la opción de Municipio (la "sede"/IPS del informe SIHO). */
  sede?: string;
  servicio?: string;
  sexo?: string;
  eps?: string;
};

// ---------------------------------------------------------------- lectura normalizada

export type RespuestaCalificacion = { opcionId: string; texto: string; tono: TonoOpcion | null; valor: number | null };

export type FilaSiau = {
  responseId: string;
  fecha: Date;
  canal: string | null;
  sexo: string | null;
  eps: string | null;
  sede: string | null;
  /** Servicios utilizados (P1 admite varios). */
  servicios: string[];
  servicio: string | null;
  servicioOtro: string | null;
  /** p3, p4, p5, p6, p7, p8 y p2:<perfil>. */
  calificaciones: Record<string, RespuestaCalificacion>;
  sugerencia: string | null;
};

export type PreguntaSiau = {
  clave: string;
  numero: number | null;
  prompt: string;
  /** Enunciado sin el "N:" del formato. */
  enunciado: string;
  estilo: string | null;
  opciones: OpcionPregunta[];
  /** Valor máximo de la escala de esta pregunta (para el puntaje). */
  maximo: number;
  /** Para P2: nombre del perfil. */
  perfil?: string;
};

function claveDePregunta(q: { prompt: string; config: unknown; page: { description: string | null } }): { clave: string; numero: number | null; perfil?: string } | null {
  const c = leerConfig(q.config);
  if (c.estilo === "matriz") return { clave: `p2:${q.prompt}`, numero: 2, perfil: q.prompt };
  const n = /^(\d+):/.exec(q.prompt)?.[1];
  if (n) return { clave: `p${n}`, numero: Number(n) };
  return null;
}

/** Estructura de la encuesta SIAU (preguntas medibles, con su escala). */
export async function getEstructuraSiau() {
  const encuesta = await prisma.survey.findFirst({
    where: { code: { startsWith: CODIGO_SIAU } },
    include: { pages: { orderBy: { sortOrder: "asc" }, include: { questions: { orderBy: { sortOrder: "asc" } } } } },
  });
  if (!encuesta) return null;
  const preguntas: PreguntaSiau[] = [];
  const porId = new Map<string, PreguntaSiau & { rol?: string; estiloRaw?: string }>();
  for (const p of encuesta.pages) {
    for (const q of p.questions) {
      const c = leerConfig(q.config);
      const info = claveDePregunta({ ...q, page: p });
      const opciones = c.opciones ?? [];
      const valores = opciones.map((o) => (o.tono ? VALOR_TONO[o.tono] : null)).filter((v): v is number => v !== null);
      const item: PreguntaSiau & { rol?: string; estiloRaw?: string } = {
        clave: info?.clave ?? `q:${q.id}`,
        numero: info?.numero ?? null,
        prompt: q.prompt,
        enunciado: q.prompt.replace(/^\d+:\s*/, ""),
        estilo: c.estilo ?? null,
        opciones,
        maximo: valores.length ? Math.max(...valores) : 0,
        perfil: info?.perfil,
        rol: c.rol,
        estiloRaw: c.estilo,
      };
      porId.set(q.id, item);
      if (info) preguntas.push(item);
    }
  }
  return { encuesta, preguntas, porId };
}

/** Todas las respuestas completas de la SIAU, normalizadas y filtradas. */
export async function getFilasSiau(filtros: FiltrosSiau = {}): Promise<{ filas: FilaSiau[]; preguntas: PreguntaSiau[] } | null> {
  const estructura = await getEstructuraSiau();
  if (!estructura) return null;
  const { encuesta, preguntas, porId } = estructura;

  const respuestas = await prisma.surveyResponse.findMany({
    where: {
      surveyId: encuesta.id,
      completed: true,
      ...(filtros.desde || filtros.hasta ? { submittedAt: { ...(filtros.desde ? { gte: filtros.desde } : {}), ...(filtros.hasta ? { lt: filtros.hasta } : {}) } } : {}),
    },
    orderBy: { submittedAt: "asc" },
    select: { id: true, submittedAt: true, startedAt: true, channel: true, answers: { select: { questionId: true, value: true, textValue: true } } },
  });

  const filas: FilaSiau[] = [];
  for (const r of respuestas) {
    const fila: FilaSiau = { responseId: r.id, fecha: r.submittedAt ?? r.startedAt, canal: r.channel, sexo: null, eps: null, sede: null, servicios: [], servicio: null, servicioOtro: null, calificaciones: {}, sugerencia: null };
    for (const a of r.answers) {
      const q = porId.get(a.questionId);
      if (!q) continue;
      const v = a.value as ValorRespuesta | null;
      const opcion = v?.tipo === "opcion" ? q.opciones.find((o) => o.id === v.opcionId) : undefined;
      if (q.estiloRaw === "sexo") fila.sexo = opcion?.texto === "M" ? "Masculino" : opcion?.texto === "F" ? "Femenino" : (opcion?.texto ?? null);
      else if (q.rol === "eps") fila.eps = opcion?.texto ?? a.textValue ?? null;
      else if (q.rol === "municipio") fila.sede = opcion?.texto ?? null;
      else if (q.estiloRaw === "servicios") {
        const ids = v?.tipo === "opciones" ? v.opcionIds : v?.tipo === "opcion" ? [v.opcionId] : [];
        fila.servicios = ids.map((id) => q.opciones.find((o) => o.id === id)?.texto).filter((t): t is string => Boolean(t));
        fila.servicio = fila.servicios[0] ?? null;
      }
      else if (q.rol === "otro") fila.servicioOtro = a.textValue ?? null;
      else if (q.clave === "p9") fila.sugerencia = a.textValue?.trim() || null;
      else if (opcion && (q.clave.startsWith("p2:") || /^p[3-8]$/.test(q.clave))) {
        const tono = opcion.tono ?? null;
        fila.calificaciones[q.clave] = { opcionId: opcion.id, texto: opcion.texto, tono, valor: tono ? VALOR_TONO[tono] : null };
      }
    }
    if (filtros.sede && fila.sede !== filtros.sede) continue;
    if (filtros.servicio && !fila.servicios.includes(filtros.servicio)) continue;
    if (filtros.sexo && fila.sexo !== filtros.sexo) continue;
    if (filtros.eps && fila.eps !== filtros.eps) continue;
    filas.push(fila);
  }
  return { filas, preguntas };
}

// ---------------------------------------------------------------- cálculo

export type Distribucion = { opcionId: string; texto: string; tono: TonoOpcion | null; n: number; pct: number };

export type MetricaPregunta = {
  clave: string;
  numero: number | null;
  enunciado: string;
  perfil?: string;
  n: number;
  validas: number;
  favorables: number;
  adherencia: number | null;
  puntaje: number | null;
  promedio: number | null;
  maximo: number;
  semaforo: NivelSemaforo;
  distribucion: Distribucion[];
};

export type MetricasSiau = {
  total: number;
  adherenciaGeneral: number | null;
  puntajeGeneral: number | null;
  semaforo: NivelSemaforo;
  /** P3…P8 y la matriz P2 consolidada, en orden. */
  porPregunta: MetricaPregunta[];
  /** P2 desagregada por perfil. */
  porPerfil: MetricaPregunta[];
  mejores: MetricaPregunta[];
  peores: MetricaPregunta[];
  sugerencias: { fecha: Date; sede: string | null; servicio: string | null; texto: string }[];
  minutosPromedio: null;
};

function medir(clave: string, numero: number | null, enunciado: string, opciones: OpcionPregunta[], valores: RespuestaCalificacion[], perfil?: string): MetricaPregunta {
  const validas = valores.filter((v) => v.tono && v.tono !== "na");
  const favorables = validas.filter((v) => v.tono && ES_FAVORABLE[v.tono]).length;
  const maximo = Math.max(0, ...opciones.map((o) => (o.tono ? VALOR_TONO[o.tono] ?? 0 : 0)));
  const suma = validas.reduce((s, v) => s + (v.valor ?? 0), 0);
  const promedio = validas.length ? suma / validas.length : null;
  const adherencia = validas.length ? Math.round((favorables / validas.length) * 1000) / 10 : null;
  const puntaje = promedio !== null && maximo > 0 ? Math.round((promedio / maximo) * 1000) / 10 : null;
  const conteo = new Map<string, number>();
  for (const v of valores) conteo.set(v.opcionId, (conteo.get(v.opcionId) ?? 0) + 1);
  const distribucion: Distribucion[] = opciones.map((o) => ({ opcionId: o.id, texto: o.texto, tono: o.tono ?? null, n: conteo.get(o.id) ?? 0, pct: valores.length ? Math.round(((conteo.get(o.id) ?? 0) / valores.length) * 1000) / 10 : 0 }));
  return { clave, numero, enunciado, perfil, n: valores.length, validas: validas.length, favorables, adherencia, puntaje, promedio: promedio !== null ? Math.round(promedio * 100) / 100 : null, maximo, semaforo: nivelSemaforo(adherencia), distribucion };
}

export function calcularMetricas(filas: FilaSiau[], preguntas: PreguntaSiau[]): MetricasSiau {
  const porPerfil: MetricaPregunta[] = [];
  const porPregunta: MetricaPregunta[] = [];
  const perfiles = preguntas.filter((p) => p.clave.startsWith("p2:"));
  const escalaP2 = perfiles[0]?.opciones ?? [];
  const valoresP2: RespuestaCalificacion[] = [];
  for (const p of perfiles) {
    const valores = filas.map((f) => f.calificaciones[p.clave]).filter((v): v is RespuestaCalificacion => Boolean(v));
    valoresP2.push(...valores);
    porPerfil.push(medir(p.clave, 2, p.enunciado, p.opciones, valores, p.perfil));
  }
  if (perfiles.length) porPregunta.push(medir("p2", 2, "Amabilidad, trato digno y respeto del personal", escalaP2, valoresP2));
  for (const p of preguntas.filter((p) => /^p[3-8]$/.test(p.clave))) {
    const valores = filas.map((f) => f.calificaciones[p.clave]).filter((v): v is RespuestaCalificacion => Boolean(v));
    porPregunta.push(medir(p.clave, p.numero, p.enunciado, p.opciones, valores));
  }
  const conDatos = porPregunta.filter((p) => p.adherencia !== null);
  const adherenciaGeneral = conDatos.length ? Math.round((conDatos.reduce((s, p) => s + p.adherencia!, 0) / conDatos.length) * 10) / 10 : null;
  const conPuntaje = porPregunta.filter((p) => p.puntaje !== null);
  const puntajeGeneral = conPuntaje.length ? Math.round((conPuntaje.reduce((s, p) => s + p.puntaje!, 0) / conPuntaje.length) * 10) / 10 : null;
  const ordenadas = [...conDatos].sort((a, b) => b.adherencia! - a.adherencia!);
  return {
    total: filas.length,
    adherenciaGeneral,
    puntajeGeneral,
    semaforo: nivelSemaforo(adherenciaGeneral),
    porPregunta,
    porPerfil,
    mejores: ordenadas.slice(0, 3),
    peores: ordenadas.slice(-3).reverse(),
    sugerencias: filas.filter((f) => f.sugerencia).map((f) => ({ fecha: f.fecha, sede: f.sede, servicio: f.servicio, texto: f.sugerencia! })),
    minutosPromedio: null,
  };
}

// ---------------------------------------------------------------- cruces y tendencias

export type Cruce = { valor: string; total: number; adherencia: number | null; puntaje: number | null; semaforo: NivelSemaforo; porPregunta: Record<string, number | null> };

/** Adherencia × variable (sede, servicio, sexo, eps): una fila por valor. */
export function cruzar(filas: FilaSiau[], preguntas: PreguntaSiau[], variable: "sede" | "servicio" | "sexo" | "eps"): Cruce[] {
  const grupos = new Map<string, FilaSiau[]>();
  for (const f of filas) {
    const valores = variable === "servicio" ? (f.servicios.length ? f.servicios : ["Sin dato"]) : [f[variable] ?? "Sin dato"];
    for (const v of valores) grupos.set(v, [...(grupos.get(v) ?? []), f]);
  }
  return [...grupos.entries()]
    .map(([valor, lista]) => {
      const m = calcularMetricas(lista, preguntas);
      return { valor, total: lista.length, adherencia: m.adherenciaGeneral, puntaje: m.puntajeGeneral, semaforo: m.semaforo, porPregunta: Object.fromEntries(m.porPregunta.map((p) => [p.clave, p.adherencia])) };
    })
    .sort((a, b) => (b.adherencia ?? -1) - (a.adherencia ?? -1));
}

export type PuntoTendencia = { clave: string; etiqueta: string; total: number; adherencia: number | null; puntaje: number | null };

/** Serie mensual (o por sede dentro del rango) para gráficas de tendencia. */
export function tendenciaMensual(filas: FilaSiau[], preguntas: PreguntaSiau[]): PuntoTendencia[] {
  const grupos = new Map<string, FilaSiau[]>();
  for (const f of filas) {
    const d = new Date(f.fecha.getTime() - 5 * 3600e3); // Bogotá
    const clave = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    grupos.set(clave, [...(grupos.get(clave) ?? []), f]);
  }
  return [...grupos.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([clave, lista]) => {
      const m = calcularMetricas(lista, preguntas);
      const [a, mes] = clave.split("-");
      return { clave, etiqueta: `${NOMBRE_MES[Number(mes) - 1].slice(0, 3)} ${a}`, total: lista.length, adherencia: m.adherenciaGeneral, puntaje: m.puntajeGeneral };
    });
}

/** Variación en puntos porcentuales entre dos valores (null si falta alguno). */
export function variacion(actual: number | null, anterior: number | null): number | null {
  if (actual === null || anterior === null) return null;
  return Math.round((actual - anterior) * 10) / 10;
}

/** Conjunto completo para un periodo: métricas, cruces, tendencia y comparativo con el periodo anterior. */
export async function getInformeSiau(periodo: Periodo, filtros: Omit<FiltrosSiau, "desde" | "hasta"> = {}) {
  const rango = rangoDePeriodo(periodo);
  const rangoPrevio = rangoDePeriodo(periodoAnterior(periodo));
  const [actual, previo] = await Promise.all([
    getFilasSiau({ ...filtros, desde: rango.desde, hasta: rango.hasta }),
    getFilasSiau({ ...filtros, desde: rangoPrevio.desde, hasta: rangoPrevio.hasta }),
  ]);
  if (!actual) return null;
  const metricas = calcularMetricas(actual.filas, actual.preguntas);
  const metricasPrevias = previo ? calcularMetricas(previo.filas, previo.preguntas) : null;
  return {
    periodo,
    rango,
    rangoPrevio,
    filtros,
    preguntas: actual.preguntas,
    filas: actual.filas,
    metricas,
    metricasPrevias,
    variacionGeneral: variacion(metricas.adherenciaGeneral, metricasPrevias?.adherenciaGeneral ?? null),
    variacionPorPregunta: Object.fromEntries(metricas.porPregunta.map((p) => [p.clave, variacion(p.adherencia, metricasPrevias?.porPregunta.find((x) => x.clave === p.clave)?.adherencia ?? null)])),
    porSede: cruzar(actual.filas, actual.preguntas, "sede"),
    porServicio: cruzar(actual.filas, actual.preguntas, "servicio"),
    porSexo: cruzar(actual.filas, actual.preguntas, "sexo"),
    porEps: cruzar(actual.filas, actual.preguntas, "eps"),
    tendencia: tendenciaMensual(actual.filas, actual.preguntas),
  };
}

export type InformeSiau = NonNullable<Awaited<ReturnType<typeof getInformeSiau>>>;
