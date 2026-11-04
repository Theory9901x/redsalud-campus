"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { GalardonValor } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireAdmin, requireSession } from "@/lib/auth-helpers";
import { esSoloLectura } from "@/lib/roles";
import { registrarAuditoria } from "@/lib/audit";
import { nombrePropio } from "@/lib/nombre-propio";
import { esIpsValida } from "@/lib/galardones/ips";
import { ORDEN_VALORES, valorInfo } from "@/lib/galardones/valores";
import { claveNombre, mismaPersona, tokensNombre } from "@/lib/galardones/nombres";
import { estadoConvocatoria, estadoInicialPostulacion } from "@/lib/galardones/consultas";

export type PersonaDirectorio = { id: string; nombre: string; cargo: string | null; municipio: string | null };

/**
 * Autocompletar del directorio del campus. Quien postula puede elegir a un
 * compañero registrado -entonces la postulación queda amarrada a su cuenta y
 * no depende de cómo se escribió el nombre- o escribir el nombre libre.
 */
export async function buscarPersonas(q: string): Promise<PersonaDirectorio[]> {
  await requireSession("/galardones");
  const texto = q.trim();
  if (texto.length < 3) return [];
  const tokens = tokensNombre(texto).slice(0, 4);
  if (!tokens.length) return [];
  const personas = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      excludeFromAttendance: false,
      AND: tokens.map((t) => ({ fullName: { contains: t, mode: "insensitive" as const } })),
    },
    select: { id: true, fullName: true, position: true, cargo: { select: { nombre: true } }, municipio: { select: { nombre: true } } },
    orderBy: { fullName: "asc" },
    take: 8,
  });
  return personas.map((p) => ({
    id: p.id,
    nombre: nombrePropio(p.fullName),
    cargo: p.cargo?.nombre ?? p.position ?? null,
    municipio: p.municipio?.nombre ?? null,
  }));
}

const postulacionSchema = z.object({
  ips: z.string().refine(esIpsValida, "Elige el centro IPS."),
  postulaciones: z
    .array(
      z.object({
        valor: z.enum(["INTEGRIDAD", "HUMANIZACION", "LIDERAZGO"]),
        nombre: z.string().trim().min(3, "Escribe el nombre completo.").max(120),
        userId: z.string().nullable().optional(),
        motivo: z.string().trim().min(15, "Describe el comportamiento o aporte observable (mínimo 15 caracteres).").max(600),
      }),
    )
    .length(3, "Debes postular a una persona por cada valor."),
});

export type EnvioPostulacion = z.input<typeof postulacionSchema>;

/**
 * Registra las tres postulaciones de la persona en sesión. Idempotente por
 * la restricción única (votante, valor): si ya postuló, no se duplica.
 *
 * Por cada nombre se busca en la misma IPS un candidato que sea la misma
 * persona -por cuenta si se eligió del directorio, por nombre si no- y se le
 * suma. Si no hay, se crea el candidato.
 */
export async function enviarPostulacion(entrada: EnvioPostulacion): Promise<{ ok: true } | { ok: false; error: string }> {
  const sesion = await requireSession("/galardones");
  if (esSoloLectura(sesion.user.role)) return { ok: false, error: "El perfil de seguimiento es de solo lectura." };
  const parsed = postulacionSchema.safeParse(entrada);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  const { ips, postulaciones } = parsed.data;

  const valores = new Set(postulaciones.map((p) => p.valor));
  if (valores.size !== 3 || !ORDEN_VALORES.every((v) => valores.has(v))) {
    return { ok: false, error: "Debes postular a una persona por cada valor." };
  }

  const convocatoria = await estadoConvocatoria();
  if (!convocatoria.abierta) return { ok: false, error: "La convocatoria ya cerró." };

  const yaPostulo = await prisma.galardonPostulacion.count({ where: { votanteId: sesion.user.id } });
  if (yaPostulo) return { ok: false, error: "Ya registraste tu postulación: solo se puede diligenciar una vez." };

  const votante = await prisma.user.findUniqueOrThrow({
    where: { id: sesion.user.id },
    select: { fullName: true, status: true, origenRegistro: true, role: true, createdAt: true },
  });
  if (votante.status !== "ACTIVE") return { ok: false, error: "Tu cuenta no está activa." };
  const estado = estadoInicialPostulacion(votante, convocatoria.cuentasNuevasDesde);
  for (const p of postulaciones) {
    if (p.userId === sesion.user.id || mismaPersona(p.nombre, votante.fullName)) {
      return { ok: false, error: `En ${valorInfo(p.valor).nombre} escribiste tu propio nombre: la postulación es a otra persona.` };
    }
  }

  const ids = [...new Set(postulaciones.map((p) => p.userId).filter((x): x is string => !!x))];
  const registrados = ids.length
    ? await prisma.user.findMany({ where: { id: { in: ids }, status: "ACTIVE" }, select: { id: true, fullName: true } })
    : [];
  const registradoPorId = new Map(registrados.map((u) => [u.id, u]));

  try {
    await prisma.$transaction(async (tx) => {
      const candidatos = await tx.galardonCandidato.findMany({
        where: { ips, fusionadoEnId: null },
        include: { postulaciones: { select: { nombreEscrito: true } } },
      });

      for (const p of postulaciones) {
        const registrado = p.userId ? registradoPorId.get(p.userId) ?? null : null;
        const nombreMostrar = registrado ? nombrePropio(registrado.fullName) : nombrePropio(p.nombre);

        let candidato =
          (registrado && candidatos.find((c) => c.userId === registrado.id)) ||
          candidatos.find(
            (c) =>
              mismaPersona(p.nombre, c.nombre) ||
              (registrado && mismaPersona(registrado.fullName, c.nombre)) ||
              c.postulaciones.some((x) => mismaPersona(p.nombre, x.nombreEscrito)),
          ) ||
          null;

        if (!candidato) {
          candidato = {
            ...(await tx.galardonCandidato.create({
              data: { ips, nombre: nombreMostrar, nombreClave: claveNombre(nombreMostrar), userId: registrado?.id ?? null },
            })),
            postulaciones: [],
          };
          candidatos.push(candidato);
        } else if (registrado && !candidato.userId) {
          // Se conoció la cuenta: el candidato pasa a tener identidad fija y su nombre oficial.
          await tx.galardonCandidato.update({
            where: { id: candidato.id },
            data: { userId: registrado.id, nombre: nombreMostrar, nombreClave: claveNombre(nombreMostrar) },
          });
          candidato.userId = registrado.id;
          candidato.nombre = nombreMostrar;
        }

        await tx.galardonPostulacion.create({
          data: { valor: p.valor, ips, nombreEscrito: p.nombre, motivo: p.motivo, candidatoId: candidato.id, votanteId: sesion.user.id, estado },
        });
        candidato.postulaciones.push({ nombreEscrito: p.nombre });
      }
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "P2002") {
      return { ok: false, error: "Ya registraste tu postulación: solo se puede diligenciar una vez." };
    }
    throw error;
  }

  await registrarAuditoria({
    userId: sesion.user.id,
    action: "CREATE",
    entity: "Galardon",
    description: `Postulación Galardones · ${ips}${estado === "POR_VERIFICAR" ? " · por verificar (cuenta nueva)" : ""}`,
  });
  revalidatePath("/galardones");
  revalidatePath("/galardones/resultados");
  revalidatePath("/admin/galardones");
  return { ok: true };
}

// ---------------------------------------------------------------------
// Administración de resultados
// ---------------------------------------------------------------------

async function requireAdminEscritura() {
  const sesion = await requireAdmin();
  if (esSoloLectura(sesion.user.role)) throw new Error("Perfil de solo lectura.");
  return sesion;
}

/** Mueve las postulaciones de `origenId` a `destinoId`: son la misma persona. */
export async function fusionarCandidatos(origenId: string, destinoId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const sesion = await requireAdminEscritura();
  if (origenId === destinoId) return { ok: false, error: "Elige dos candidatos distintos." };
  const [origen, destino] = await Promise.all([
    prisma.galardonCandidato.findUnique({ where: { id: origenId } }),
    prisma.galardonCandidato.findUnique({ where: { id: destinoId } }),
  ]);
  if (!origen || !destino) return { ok: false, error: "Candidato no encontrado." };
  if (origen.ips !== destino.ips) return { ok: false, error: "Solo se fusionan candidatos del mismo centro IPS." };

  await prisma.$transaction(async (tx) => {
    // Si un mismo votante postuló a ambos en el mismo valor, al fusionar le
    // quedaría doble voto: se conserva una sola postulación por (votante, valor).
    const delDestino = await tx.galardonPostulacion.findMany({ where: { candidatoId: destinoId }, select: { votanteId: true, valor: true } });
    const llaves = new Set(delDestino.map((p) => `${p.votanteId}|${p.valor}`));
    const delOrigen = await tx.galardonPostulacion.findMany({ where: { candidatoId: origenId }, select: { id: true, votanteId: true, valor: true } });
    const duplicadas = delOrigen.filter((p) => llaves.has(`${p.votanteId}|${p.valor}`)).map((p) => p.id);
    if (duplicadas.length) await tx.galardonPostulacion.deleteMany({ where: { id: { in: duplicadas } } });
    await tx.galardonPostulacion.updateMany({ where: { candidatoId: origenId }, data: { candidatoId: destinoId } });
    await tx.galardonCandidato.update({ where: { id: origenId }, data: { fusionadoEnId: destinoId } });
    // Una decisión de Talento Humano sobre el origen pasa al destino, salvo que choque con otra del destino.
    const decisionesDestino = await tx.galardonDecision.findMany({ where: { candidatoId: destinoId }, select: { valor: true } });
    await tx.galardonDecision.deleteMany({ where: { candidatoId: origenId, valor: { in: decisionesDestino.map((d) => d.valor) } } });
    await tx.galardonDecision.updateMany({ where: { candidatoId: origenId }, data: { candidatoId: destinoId } });
    if (!destino.userId && origen.userId) {
      await tx.galardonCandidato.update({ where: { id: destinoId }, data: { userId: origen.userId } });
    }
  });

  await registrarAuditoria({
    userId: sesion.user.id,
    action: "UPDATE",
    entity: "Galardon",
    entityId: destinoId,
    description: `Fusión de candidatos: «${origen.nombre}» → «${destino.nombre}» (${destino.ips})`,
  });
  revalidatePath("/galardones/resultados");
  revalidatePath("/admin/galardones");
  return { ok: true };
}

/** Saca a un candidato nuevo las postulaciones escritas exactamente con `nombreEscrito`: no eran la misma persona. */
export async function separarVariante(candidatoId: string, nombreEscrito: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const sesion = await requireAdminEscritura();
  const candidato = await prisma.galardonCandidato.findUnique({ where: { id: candidatoId } });
  if (!candidato) return { ok: false, error: "Candidato no encontrado." };
  const filas = await prisma.galardonPostulacion.findMany({ where: { candidatoId, nombreEscrito: nombreEscrito.trim() }, select: { id: true } });
  const total = await prisma.galardonPostulacion.count({ where: { candidatoId } });
  if (!filas.length) return { ok: false, error: "No hay postulaciones con ese nombre." };
  if (filas.length === total) return { ok: false, error: "Son todas las postulaciones del candidato: no hay nada que separar." };

  const nombre = nombrePropio(nombreEscrito);
  const nuevo = await prisma.$transaction(async (tx) => {
    const n = await tx.galardonCandidato.create({ data: { ips: candidato.ips, nombre, nombreClave: claveNombre(nombre) } });
    await tx.galardonPostulacion.updateMany({ where: { id: { in: filas.map((f) => f.id) } }, data: { candidatoId: n.id } });
    return n;
  });

  await registrarAuditoria({
    userId: sesion.user.id,
    action: "UPDATE",
    entity: "Galardon",
    entityId: nuevo.id,
    description: `Separación de candidato: «${nombreEscrito}» deja de contar para «${candidato.nombre}» (${candidato.ips})`,
  });
  revalidatePath("/galardones/resultados");
  revalidatePath("/admin/galardones");
  return { ok: true };
}

export async function configurarConvocatoria(entrada: { abierta: boolean; cierraEl: string | null; anio?: number; cuentasNuevasDesde?: string | null }): Promise<{ ok: true } | { ok: false; error: string }> {
  const sesion = await requireAdminEscritura();
  const cierraEl = entrada.cierraEl ? new Date(`${entrada.cierraEl}T23:59:59-05:00`) : null;
  if (cierraEl && Number.isNaN(cierraEl.getTime())) return { ok: false, error: "Fecha de cierre inválida." };
  const corte = entrada.cuentasNuevasDesde ? new Date(`${entrada.cuentasNuevasDesde}T00:00:00-05:00`) : undefined;
  if (corte && Number.isNaN(corte.getTime())) return { ok: false, error: "Fecha de corte inválida." };
  const anio = entrada.anio !== undefined ? Math.round(entrada.anio) : undefined;
  if (anio !== undefined && (anio < 2020 || anio > 2100)) return { ok: false, error: "Año inválido." };
  await prisma.galardonConvocatoria.upsert({
    where: { id: "singleton" },
    update: { abierta: entrada.abierta, cierraEl, ...(anio !== undefined ? { anio } : {}), ...(corte ? { cuentasNuevasDesde: corte } : {}) },
    create: { id: "singleton", abierta: entrada.abierta, cierraEl, anio: anio ?? 2026, ...(corte ? { cuentasNuevasDesde: corte } : {}) },
  });
  await registrarAuditoria({
    userId: sesion.user.id,
    action: "UPDATE",
    entity: "Galardon",
    description: `Convocatoria Galardones ${entrada.abierta ? "abierta" : "cerrada"}${entrada.cierraEl ? ` · cierra ${entrada.cierraEl}` : ""}`,
  });
  revalidatePath("/galardones");
  revalidatePath("/galardones/resultados");
  revalidatePath("/admin/galardones");
  return { ok: true };
}

// ---------------------------------------------------------------------
// Gestión de la base de datos desde el panel admin (/admin/galardones)
// ---------------------------------------------------------------------

const RUTAS_GESTION = ["/galardones", "/galardones/resultados", "/admin/galardones"];
function revalidarGestion() {
  for (const r of RUTAS_GESTION) revalidatePath(r);
}

/** Borra una postulación concreta (p. ej. duplicada o hecha por error). Si el candidato queda sin postulaciones ni fusiones, se borra también. */
export async function eliminarPostulacion(id: string): Promise<{ error: string | null }> {
  try {
    const sesion = await requireAdminEscritura();
    const p = await prisma.galardonPostulacion.findUnique({ where: { id }, include: { candidato: { select: { nombre: true, ips: true } }, votante: { select: { fullName: true } } } });
    if (!p) return { error: "La postulación ya no existe." };
    await prisma.$transaction(async (tx) => {
      await tx.galardonPostulacion.delete({ where: { id } });
      const restantes = await tx.galardonPostulacion.count({ where: { candidatoId: p.candidatoId } });
      const fusiones = await tx.galardonCandidato.count({ where: { fusionadoEnId: p.candidatoId } });
      if (restantes === 0 && fusiones === 0) await tx.galardonCandidato.delete({ where: { id: p.candidatoId } });
    });
    await registrarAuditoria({
      userId: sesion.user.id,
      action: "DELETE",
      entity: "Galardon",
      entityId: id,
      description: `Postulación eliminada: ${valorInfo(p.valor).nombre} · «${p.candidato.nombre}» (${p.candidato.ips}) postulado por ${p.votante.fullName}`,
    });
    revalidarGestion();
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo eliminar." };
  }
}

/** Cambia el nombre con el que se muestra un candidato (corrige ortografía o el orden de apellidos). */
export async function renombrarCandidato(id: string, nombre: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const sesion = await requireAdminEscritura();
  const limpio = nombrePropio(nombre.trim());
  if (limpio.length < 3) return { ok: false, error: "Escribe un nombre válido." };
  const c = await prisma.galardonCandidato.findUnique({ where: { id } });
  if (!c) return { ok: false, error: "Candidato no encontrado." };
  await prisma.galardonCandidato.update({ where: { id }, data: { nombre: limpio, nombreClave: claveNombre(limpio) } });
  await registrarAuditoria({ userId: sesion.user.id, action: "UPDATE", entity: "Galardon", entityId: id, description: `Candidato renombrado: «${c.nombre}» → «${limpio}» (${c.ips})` });
  revalidarGestion();
  return { ok: true };
}

/** Borra un candidato que ya no tiene postulaciones (sobrante de una fusión o separación). */
export async function eliminarCandidato(id: string): Promise<{ error: string | null }> {
  try {
    const sesion = await requireAdminEscritura();
    const c = await prisma.galardonCandidato.findUnique({ where: { id }, include: { _count: { select: { postulaciones: true, fusionados: true } } } });
    if (!c) return { error: "El candidato ya no existe." };
    if (c._count.postulaciones > 0) return { error: `Tiene ${c._count.postulaciones} postulación(es): elimínalas o fusiónalo antes.` };
    await prisma.$transaction(async (tx) => {
      await tx.galardonCandidato.updateMany({ where: { fusionadoEnId: id }, data: { fusionadoEnId: null } });
      await tx.galardonCandidato.delete({ where: { id } });
    });
    await registrarAuditoria({ userId: sesion.user.id, action: "DELETE", entity: "Galardon", entityId: id, description: `Candidato eliminado: «${c.nombre}» (${c.ips})` });
    revalidarGestion();
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo eliminar." };
  }
}

/**
 * Validar o anular TODAS las postulaciones de una cuenta por verificar. Anular
 * no borra: deja el registro (no suma) para que esa cuenta no pueda volver a
 * postular y para que quede la huella en la auditoría.
 */
export async function revisarVotante(votanteId: string, decision: "VALIDA" | "ANULADA"): Promise<{ ok: true } | { ok: false; error: string }> {
  const sesion = await requireAdminEscritura();
  const votante = await prisma.user.findUnique({ where: { id: votanteId }, select: { fullName: true, documentNumber: true } });
  if (!votante) return { ok: false, error: "Cuenta no encontrada." };
  const r = await prisma.galardonPostulacion.updateMany({
    where: { votanteId, estado: "POR_VERIFICAR" },
    data: { estado: decision, revisadaPor: sesion.user.id, revisadaEl: new Date() },
  });
  if (!r.count) return { ok: false, error: "Esta cuenta ya no tiene postulaciones por verificar." };
  await registrarAuditoria({
    userId: sesion.user.id,
    action: "UPDATE",
    entity: "Galardon",
    entityId: votanteId,
    description: `Postulación ${decision === "VALIDA" ? "validada" : "anulada"}: ${votante.fullName} (${votante.documentNumber})`,
  });
  revalidarGestion();
  return { ok: true };
}

/**
 * Talento Humano define el ganador de un centro en un valor: desempates o
 * cuando todos los postulados ya ganaron otro valor. La persona debe tener
 * postulaciones válidas en ese centro y ese valor.
 */
export async function definirGanador(ips: string, valor: GalardonValor, candidatoId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const sesion = await requireAdminEscritura();
  if (!esIpsValida(ips) || !ORDEN_VALORES.includes(valor)) return { ok: false, error: "Centro o valor inválido." };
  const c = await prisma.galardonCandidato.findUnique({ where: { id: candidatoId }, select: { nombre: true, ips: true } });
  if (!c || c.ips !== ips) return { ok: false, error: "Esa persona no está postulada en este centro." };
  const votos = await prisma.galardonPostulacion.count({ where: { candidatoId, valor, estado: "VALIDA" } });
  if (!votos) return { ok: false, error: `${c.nombre} no tiene postulaciones válidas en ${valorInfo(valor).nombre}.` };
  // Nadie gana dos valores: si esa persona tenía una decisión en otro valor del centro, se retira.
  await prisma.$transaction([
    prisma.galardonDecision.deleteMany({ where: { ips, candidatoId, valor: { not: valor } } }),
    prisma.galardonDecision.upsert({
      where: { ips_valor: { ips, valor } },
      update: { candidatoId, decididoPor: sesion.user.id },
      create: { ips, valor, candidatoId, decididoPor: sesion.user.id },
    }),
  ]);
  await registrarAuditoria({ userId: sesion.user.id, action: "UPDATE", entity: "Galardon", entityId: candidatoId, description: `Ganador definido: ${valorInfo(valor).nombre} en ${ips} → «${c.nombre}»` });
  revalidarGestion();
  revalidatePath("/galardones/ceremonia");
  return { ok: true };
}

/** Quita la decisión de Talento Humano: vuelve a mandar el conteo. */
export async function quitarDecision(ips: string, valor: GalardonValor): Promise<{ ok: true } | { ok: false; error: string }> {
  const sesion = await requireAdminEscritura();
  const r = await prisma.galardonDecision.deleteMany({ where: { ips, valor } });
  if (!r.count) return { ok: false, error: "No había una decisión para ese valor." };
  await registrarAuditoria({ userId: sesion.user.id, action: "UPDATE", entity: "Galardon", description: `Decisión retirada: ${valorInfo(valor).nombre} en ${ips} vuelve al conteo` });
  revalidarGestion();
  revalidatePath("/galardones/ceremonia");
  return { ok: true };
}

/** Quién está en sesión, para mostrar su nombre sin otra consulta desde el cliente. */
export async function sesionActual() {
  const s = await auth();
  return s?.user ? { id: s.user.id, nombre: s.user.name ?? "" } : null;
}

export type ValorClave = GalardonValor;
