import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { configSinClave, leerConfig, type ValorRespuesta } from "@/lib/encuestas/tipos";
import { agregarPuntajes, tienePreguntasCalificadas, type BloquePuntuable } from "@/lib/encuestas/puntaje";
import type { Prisma, SurveyStatus, SurveyAudience } from "@prisma/client";

/**
 * Consultas del módulo de encuestas.
 *
 * Dos reglas que atraviesan todo el archivo:
 *
 *  - Lo que va al navegador de quien RESPONDE pasa siempre por
 *    `configSinClave`: la clave de respuesta no puede viajar en el HTML.
 *  - Los listados y los conteos no traen el padrón de nadie: se cuentan en
 *    Postgres, igual que en el resto del módulo de planes.
 */

/** Consecutivo legible para citar la encuesta en un acta: ENC-2026-0001. */
export async function generarCodigoEncuesta(): Promise<string> {
  const anio = new Date().getFullYear();
  const ultima = await prisma.survey.findFirst({
    where: { code: { startsWith: `ENC-${anio}-` } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  const consecutivo = ultima ? Number(ultima.code.split("-")[2]) + 1 : 1;
  return `ENC-${anio}-${String(consecutivo).padStart(4, "0")}`;
}

/** Identificador del enlace público: corto para un QR, impredecible para que no se adivine. */
export function generarSlug(): string {
  return randomBytes(5).toString("hex");
}

// ---------------------------------------------------------------- listado

export type FiltrosEncuestas = {
  buscar?: string;
  estado?: SurveyStatus;
  audiencia?: SurveyAudience;
  planId?: string;
  plantillas?: boolean;
};

export type EncuestaDeLista = {
  id: string;
  code: string;
  slug: string;
  title: string;
  description: string | null;
  status: SurveyStatus;
  audience: SurveyAudience;
  themeColor: string | null;
  isTemplate: boolean;
  respuestas: number;
  completadas: number;
  preguntas: number;
  capacitacion: string | null;
  plan: string | null;
  actualizada: Date;
};

/**
 * ALCANCE POR ROL. El módulo lo ven los tres, pero no ven lo mismo:
 *
 *  - `todas`      administrador: todo lo creado en la plataforma.
 *  - `emitidas`   tutor: las que él emite, más las de las jornadas de sus áreas.
 *  - `respondidas` estudiante: únicamente aquellas en las que participó, con
 *                  su propio resultado. Nunca ve la encuesta de otra persona.
 */
export type AlcanceEncuestas =
  | { tipo: "todas" }
  | { tipo: "emitidas"; userId: string; areaIds: string[] }
  | { tipo: "respondidas"; userId: string };

function whereDeAlcance(alcance: AlcanceEncuestas): Prisma.SurveyWhereInput {
  switch (alcance.tipo) {
    case "todas":
      return {};
    case "emitidas":
      return {
        OR: [
          { createdBy: alcance.userId },
          ...(alcance.areaIds.length > 0 ? [{ trainingActivity: { areaId: { in: alcance.areaIds } } }] : []),
        ],
      };
    case "respondidas":
      return { responses: { some: { userId: alcance.userId, completed: true } } };
  }
}

export async function listarEncuestas(
  filtros: FiltrosEncuestas,
  alcance: AlcanceEncuestas
): Promise<EncuestaDeLista[]> {
  const where: Prisma.SurveyWhereInput = {
    isTemplate: filtros.plantillas ?? false,
    ...(filtros.estado ? { status: filtros.estado } : {}),
    ...(filtros.audiencia ? { audience: filtros.audiencia } : {}),
    ...(filtros.planId ? { trainingPlanId: filtros.planId } : {}),
    ...(filtros.buscar?.trim()
      ? {
          OR: [
            { title: { contains: filtros.buscar.trim(), mode: "insensitive" } },
            { code: { contains: filtros.buscar.trim(), mode: "insensitive" } },
          ],
        }
      : {}),
    ...whereDeAlcance(alcance),
  };

  const encuestas = await prisma.survey.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      code: true,
      slug: true,
      title: true,
      description: true,
      status: true,
      audience: true,
      themeColor: true,
      isTemplate: true,
      updatedAt: true,
      trainingPlan: { select: { title: true } },
      trainingActivity: { select: { title: true } },
      _count: { select: { responses: true } },
      pages: { select: { _count: { select: { questions: true } } } },
    },
  });

  // Completadas por encuesta, en UNA consulta agrupada en vez de una por
  // tarjeta: el listado es la vista que más se abre del módulo.
  const completadasPorEncuesta = new Map(
    (
      await prisma.surveyResponse.groupBy({
        by: ["surveyId"],
        where: { surveyId: { in: encuestas.map((e) => e.id) }, completed: true },
        _count: { _all: true },
      })
    ).map((r) => [r.surveyId, r._count._all])
  );

  return encuestas.map((e) => ({
    id: e.id,
    code: e.code,
    slug: e.slug,
    title: e.title,
    description: e.description,
    status: e.status,
    audience: e.audience,
    themeColor: e.themeColor,
    isTemplate: e.isTemplate,
    respuestas: e._count.responses,
    completadas: completadasPorEncuesta.get(e.id) ?? 0,
    preguntas: e.pages.reduce((s, p) => s + p._count.questions, 0),
    capacitacion: e.trainingActivity?.title ?? null,
    plan: e.trainingPlan?.title ?? null,
    actualizada: e.updatedAt,
  }));
}

// ---------------------------------------------------------------- detalle

/** La encuesta completa, CON clave: solo para quien la construye. */
export async function getEncuestaParaConstructor(id: string) {
  return prisma.survey.findUnique({
    where: { id },
    include: {
      trainingPlan: { select: { id: true, title: true } },
      trainingActivity: { select: { id: true, title: true } },
      pages: {
        orderBy: { sortOrder: "asc" },
        include: { questions: { orderBy: { sortOrder: "asc" } } },
      },
      _count: { select: { responses: true } },
    },
  });
}

/**
 * La encuesta como la ve quien la RESPONDE: sin clave de respuesta y sin
 * nada que no necesite para contestar.
 */
export async function getEncuestaPublica(slug: string) {
  const encuesta = await prisma.survey.findUnique({
    where: { slug },
    include: {
      pages: {
        orderBy: { sortOrder: "asc" },
        include: { questions: { orderBy: { sortOrder: "asc" } } },
      },
      trainingActivity: { select: { title: true } },
    },
  });
  if (!encuesta) return null;

  return {
    ...encuesta,
    pages: encuesta.pages.map((p) => ({
      ...p,
      questions: p.questions.map((q) => ({ ...q, config: configSinClave(q.config) })),
    })),
  };
}

/** ¿Está admitiendo respuestas AHORA? Estado y ventana de vigencia. */
export function estaAbierta(encuesta: {
  status: SurveyStatus;
  opensAt: Date | null;
  closesAt: Date | null;
}): { abierta: boolean; motivo?: string } {
  if (encuesta.status === "DRAFT") return { abierta: false, motivo: "Esta encuesta todavía no se ha publicado." };
  if (encuesta.status === "CLOSED") return { abierta: false, motivo: "Esta encuesta ya cerró. Gracias por tu interés." };
  const ahora = Date.now();
  if (encuesta.opensAt && ahora < encuesta.opensAt.getTime()) {
    return { abierta: false, motivo: "Esta encuesta aún no está abierta." };
  }
  if (encuesta.closesAt && ahora > encuesta.closesAt.getTime()) {
    return { abierta: false, motivo: "El plazo para responder esta encuesta ya terminó." };
  }
  return { abierta: true };
}

// ------------------------------------------------------------- resultados

export type ResultadoPregunta = {
  id: string;
  prompt: string;
  type: string;
  respuestas: number;
  /** Opciones con su conteo, para los tipos de opción. */
  opciones?: { id: string; texto: string; conteo: number; esCorrecta: boolean }[];
  /** % de acierto, solo si la pregunta tiene clave. */
  aciertos?: number | null;
  /** Promedio y distribución, para escala y número. */
  promedio?: number | null;
  distribucion?: { valor: number; conteo: number }[];
  /** Textos, para las abiertas. */
  textos?: string[];
};

export type ResultadosEncuesta = {
  encuesta: NonNullable<Awaited<ReturnType<typeof getEncuestaParaConstructor>>>;
  totales: { respuestas: number; completadas: number; parciales: number; tasaFinalizacion: number };
  /** Minutos promedio entre abrir y enviar, solo de las completadas. */
  minutosPromedio: number | null;
  puntaje: ReturnType<typeof agregarPuntajes> | null;
  /** Cumplimiento general: el puntaje si califica; si no, la tasa de finalización. */
  cumplimiento: { porcentaje: number; base: "puntaje" | "finalizacion" };
  evolucion: { fecha: string; conteo: number }[];
  porPregunta: ResultadoPregunta[];
};

export async function getResultadosEncuesta(id: string): Promise<ResultadosEncuesta | null> {
  const encuesta = await getEncuestaParaConstructor(id);
  if (!encuesta) return null;

  const respuestas = await prisma.surveyResponse.findMany({
    where: { surveyId: id },
    select: {
      id: true,
      completed: true,
      startedAt: true,
      submittedAt: true,
      answers: { select: { questionId: true, value: true, textValue: true } },
    },
    orderBy: { startedAt: "asc" },
  });

  const completadas = respuestas.filter((r) => r.completed);
  const totales = {
    respuestas: respuestas.length,
    completadas: completadas.length,
    parciales: respuestas.length - completadas.length,
    tasaFinalizacion: respuestas.length > 0 ? Math.round((completadas.length / respuestas.length) * 100) : 0,
  };

  const duraciones = completadas
    .filter((r) => r.submittedAt)
    .map((r) => (r.submittedAt!.getTime() - r.startedAt.getTime()) / 60000)
    .filter((m) => m >= 0 && m < 24 * 60);
  const minutosPromedio =
    duraciones.length > 0 ? Math.round(duraciones.reduce((a, b) => a + b, 0) / duraciones.length) : null;

  // ---- puntaje agregado (solo si la encuesta califica) ----
  const bloques: BloquePuntuable[] = encuesta.pages.map((p) => ({
    id: p.id,
    title: p.title,
    questions: p.questions.map((q) => ({ id: q.id, config: q.config })),
  }));
  const califica = tienePreguntasCalificadas(bloques);
  const puntaje = califica
    ? agregarPuntajes(
        bloques,
        new Map(
          completadas.map((r) => [
            r.id,
            new Map(r.answers.map((a) => [a.questionId, a.value as unknown as ValorRespuesta])),
          ])
        )
      )
    : null;

  const cumplimiento =
    puntaje?.porcentaje != null
      ? { porcentaje: puntaje.porcentaje, base: "puntaje" as const }
      : { porcentaje: totales.tasaFinalizacion, base: "finalizacion" as const };

  // ---- evolución por día ----
  const porDia = new Map<string, number>();
  for (const r of respuestas) {
    const clave = r.startedAt.toISOString().slice(0, 10);
    porDia.set(clave, (porDia.get(clave) ?? 0) + 1);
  }
  const evolucion = [...porDia.entries()].sort().map(([fecha, conteo]) => ({ fecha, conteo }));

  // ---- por pregunta ----
  const respuestasPorPregunta = new Map<string, { value: unknown; textValue: string | null }[]>();
  for (const r of completadas) {
    for (const a of r.answers) {
      const lista = respuestasPorPregunta.get(a.questionId) ?? [];
      lista.push({ value: a.value, textValue: a.textValue });
      respuestasPorPregunta.set(a.questionId, lista);
    }
  }

  const porPregunta: ResultadoPregunta[] = [];
  for (const pagina of encuesta.pages) {
    for (const q of pagina.questions) {
      const dadas = respuestasPorPregunta.get(q.id) ?? [];
      const config = leerConfig(q.config);
      const base: ResultadoPregunta = {
        id: q.id,
        prompt: q.prompt,
        type: q.type,
        respuestas: dadas.length,
      };

      // Sí/No sin opciones explícitas usa el par por defecto del formulario.
      const opcionesEfectivas =
        config.opciones?.length
          ? config.opciones
          : q.type === "YES_NO"
            ? [
                { id: "si", texto: "Sí" },
                { id: "no", texto: "No" },
              ]
            : undefined;

      if (q.type === "MATCHING" && config.grupos?.length) {
        // Relacionar se tabula como "elemento → grupo elegido": cada
        // combinación cuenta, y la correcta no aplica (no hay clave aquí).
        const conteo = new Map<string, number>();
        for (const d of dadas) {
          const v = d.value as ValorRespuesta | null;
          if (v?.tipo === "relacion") {
            for (const par of v.pares) conteo.set(`${par.elementoId}::${par.grupoId}`, (conteo.get(`${par.elementoId}::${par.grupoId}`) ?? 0) + 1);
          }
        }
        base.opciones = (config.opciones ?? []).flatMap((el) =>
          (config.grupos ?? []).map((g) => ({
            id: `${el.id}::${g.id}`,
            texto: `${el.texto} → ${g.titulo}`,
            conteo: conteo.get(`${el.id}::${g.id}`) ?? 0,
            esCorrecta: false,
          }))
        ).filter((o) => o.conteo > 0);
      } else if (opcionesEfectivas?.length) {
        const conteo = new Map<string, number>();
        for (const d of dadas) {
          const v = d.value as ValorRespuesta | null;
          if (v?.tipo === "opcion") conteo.set(v.opcionId, (conteo.get(v.opcionId) ?? 0) + 1);
          if (v?.tipo === "opciones") for (const o of v.opcionIds) conteo.set(o, (conteo.get(o) ?? 0) + 1);
        }
        base.opciones = opcionesEfectivas.map((o) => ({
          id: o.id,
          texto: o.texto,
          conteo: conteo.get(o.id) ?? 0,
          esCorrecta: config.opcionCorrectaId === o.id,
        }));
        if (config.opcionCorrectaId) {
          const aciertos = conteo.get(config.opcionCorrectaId) ?? 0;
          base.aciertos = dadas.length > 0 ? Math.round((aciertos / dadas.length) * 100) : null;
        }
      } else if (q.type === "SCALE" || q.type === "NUMBER") {
        const valores = dadas
          .map((d) => {
            const v = d.value as ValorRespuesta | null;
            return v?.tipo === "escala" || v?.tipo === "numero" ? v.valor : null;
          })
          .filter((n): n is number => n !== null);
        base.promedio =
          valores.length > 0 ? Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 10) / 10 : null;
        const dist = new Map<number, number>();
        for (const v of valores) dist.set(v, (dist.get(v) ?? 0) + 1);
        base.distribucion = [...dist.entries()].sort((a, b) => a[0] - b[0]).map(([valor, conteo]) => ({ valor, conteo }));
      } else {
        base.textos = dadas.map((d) => d.textValue ?? "").filter(Boolean);
      }

      porPregunta.push(base);
    }
  }

  return { encuesta, totales, minutosPromedio, puntaje, cumplimiento, evolucion, porPregunta };
}
