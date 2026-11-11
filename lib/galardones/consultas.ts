import type { GalardonEstado, GalardonValor, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { IPS_GALARDONES } from "@/lib/galardones/ips";
import { ORDEN_VALORES } from "@/lib/galardones/valores";
import { calcularGanadores, type Ganador } from "@/lib/galardones/ganadores";

/** La convocatoria está abierta si no hay fila, o si está marcada abierta y no pasó la fecha de cierre. */
export async function estadoConvocatoria() {
  const c = await prisma.galardonConvocatoria.findUnique({ where: { id: "singleton" } });
  const vencida = !!c?.cierraEl && c.cierraEl.getTime() < Date.now();
  return {
    abierta: (c?.abierta ?? true) && !vencida,
    cierraEl: c?.cierraEl ?? null,
    anio: c?.anio ?? 2026,
  };
}

/** Las postulaciones ya hechas por una persona, en el orden de los valores. */
export async function postulacionDe(votanteId: string) {
  const filas = await prisma.galardonPostulacion.findMany({
    where: { votanteId },
    include: { candidato: { select: { nombre: true } } },
  });
  if (!filas.length) return null;
  const porValor = new Map(filas.map((f) => [f.valor, f]));
  return {
    ips: filas[0].ips,
    enviadaEl: filas[0].createdAt,
    estado: filas.some((f) => f.estado === "ANULADA") ? ("ANULADA" as const) : ("VALIDA" as const),
    valores: ORDEN_VALORES.map((v) => {
      const f = porValor.get(v);
      return f ? { valor: v, nombre: f.candidato.nombre, nombreEscrito: f.nombreEscrito, motivo: f.motivo } : null;
    }).filter((x): x is NonNullable<typeof x> => x !== null),
  };
}

export type CandidatoResultado = {
  id: string;
  nombre: string;
  registrado: boolean;
  votos: number;
  porcentaje: number;
  /** Nombres tal como los escribieron quienes postularon, con cuántas veces cada uno. */
  variantes: { texto: string; veces: number }[];
  motivos: string[];
};

export type ResultadoValor = {
  valor: GalardonValor;
  total: number;
  candidatos: CandidatoResultado[];
  /** Más de un candidato con el máximo de votos. */
  empate: boolean;
};

export type ResultadoIps = {
  ips: string;
  total: number;
  votantes: number;
  valores: ResultadoValor[];
};

export type ResultadosGalardones = {
  totalPostulaciones: number;
  totalVotantes: number;
  totalCandidatos: number;
  ipsConParticipacion: number;
  porIps: ResultadoIps[];
};

/**
 * Resultados: por cada centro IPS y cada valor, los candidatos ordenados por
 * número de postulaciones. Todo se calcula a partir de las postulaciones
 * vigentes, así que una fusión o separación de candidatos se refleja al
 * instante.
 */
export async function resultadosGalardones(): Promise<ResultadosGalardones> {
  const postulaciones = await prisma.galardonPostulacion.findMany({
    where: { estado: "VALIDA" },
    include: { candidato: { select: { id: true, nombre: true, userId: true } } },
    orderBy: { createdAt: "asc" },
  });

  const votantes = new Set(postulaciones.map((p) => p.votanteId));
  const candidatos = new Set(postulaciones.map((p) => p.candidatoId));

  const porIps: ResultadoIps[] = IPS_GALARDONES.map((ips) => {
    const deIps = postulaciones.filter((p) => p.ips === ips);
    const valores: ResultadoValor[] = ORDEN_VALORES.map((valor) => {
      const deValor = deIps.filter((p) => p.valor === valor);
      const grupos = new Map<string, CandidatoResultado & { variantesMapa: Map<string, number> }>();
      for (const p of deValor) {
        let g = grupos.get(p.candidatoId);
        if (!g) {
          g = { id: p.candidatoId, nombre: p.candidato.nombre, registrado: !!p.candidato.userId, votos: 0, porcentaje: 0, variantes: [], motivos: [], variantesMapa: new Map() };
          grupos.set(p.candidatoId, g);
        }
        g.votos++;
        g.variantesMapa.set(p.nombreEscrito.trim(), (g.variantesMapa.get(p.nombreEscrito.trim()) ?? 0) + 1);
        if (p.motivo.trim()) g.motivos.push(p.motivo.trim());
      }
      const lista = [...grupos.values()]
        .map(({ variantesMapa, ...g }) => ({
          ...g,
          porcentaje: deValor.length ? Math.round((g.votos / deValor.length) * 100) : 0,
          variantes: [...variantesMapa.entries()].map(([texto, veces]) => ({ texto, veces })).sort((a, b) => b.veces - a.veces),
        }))
        .sort((a, b) => b.votos - a.votos || a.nombre.localeCompare(b.nombre, "es"));
      const empate = lista.length > 1 && lista[0].votos === lista[1].votos;
      return { valor, total: deValor.length, candidatos: lista, empate };
    });
    return { ips, total: deIps.length, votantes: new Set(deIps.map((p) => p.votanteId)).size, valores };
  });

  return {
    totalPostulaciones: postulaciones.length,
    totalVotantes: votantes.size,
    totalCandidatos: candidatos.size,
    ipsConParticipacion: porIps.filter((i) => i.total > 0).length,
    porIps,
  };
}

/** Listado plano de postulaciones (para el Excel). */
export async function listadoPostulaciones() {
  return prisma.galardonPostulacion.findMany({
    include: {
      candidato: { select: { nombre: true, userId: true } },
      votante: { select: { fullName: true, documentNumber: true, position: true, department: true } },
    },
    orderBy: [{ ips: "asc" }, { valor: "asc" }, { createdAt: "asc" }],
  });
}

export type FiltroPostulaciones = { q?: string; ips?: string; valor?: GalardonValor; estado?: GalardonEstado; page: number; pageSize: number };

/** Postulaciones una a una, para la tabla de gestión: con quién postuló, a quién y por qué. */
export async function postulacionesPaginadas(f: FiltroPostulaciones) {
  const q = f.q?.trim();
  const where: Prisma.GalardonPostulacionWhereInput = {
    ...(f.ips ? { ips: f.ips } : {}),
    ...(f.valor ? { valor: f.valor } : {}),
    ...(f.estado ? { estado: f.estado } : {}),
    ...(q
      ? {
          OR: [
            { nombreEscrito: { contains: q, mode: "insensitive" as const } },
            { motivo: { contains: q, mode: "insensitive" as const } },
            { candidato: { nombre: { contains: q, mode: "insensitive" as const } } },
            { votante: { fullName: { contains: q, mode: "insensitive" as const } } },
            { votante: { documentNumber: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };
  const [total, filas] = await Promise.all([
    prisma.galardonPostulacion.count({ where }),
    prisma.galardonPostulacion.findMany({
      where,
      include: {
        candidato: { select: { id: true, nombre: true, userId: true } },
        votante: { select: { fullName: true, documentNumber: true, position: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
    }),
  ]);
  return { total, filas };
}

/** Candidatos (las personas postuladas), con cuántas postulaciones suman y si fueron fusionados en otro. */
export async function listadoCandidatos(filtro: { q?: string; ips?: string }) {
  const q = filtro.q?.trim();
  return prisma.galardonCandidato.findMany({
    where: {
      ...(filtro.ips ? { ips: filtro.ips } : {}),
      ...(q ? { nombre: { contains: q, mode: "insensitive" as const } } : {}),
    },
    include: {
      _count: { select: { postulaciones: true, fusionados: true } },
      fusionadoEn: { select: { id: true, nombre: true } },
      user: { select: { fullName: true, position: true } },
    },
    orderBy: [{ ips: "asc" }, { nombre: "asc" }],
  });
}

export type { Ganador, Persona, OrigenGanador } from "@/lib/galardones/ganadores";

export type GanadoresIps = { ips: string; total: number; votantes: number; ganadores: Ganador[] };

/**
 * Los ganadores para la ceremonia y la pestaña Ganadores: tres personas
 * distintas por centro, una por valor (regla en lib/galardones/ganadores.ts),
 * con las decisiones de Talento Humano aplicadas.
 */
export async function ganadoresGalardones(): Promise<GanadoresIps[]> {
  const [r, decisiones] = await Promise.all([
    resultadosGalardones(),
    prisma.galardonDecision.findMany({ select: { ips: true, valor: true, candidatoId: true } }),
  ]);
  return r.porIps.map((i) => ({ ips: i.ips, total: i.total, votantes: i.votantes, ganadores: calcularGanadores(i, decisiones) }));
}
