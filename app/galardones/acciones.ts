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
import { estadoConvocatoria } from "@/lib/galardones/consultas";

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

  const votante = await prisma.user.findUniqueOrThrow({ where: { id: sesion.user.id }, select: { fullName: true } });
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
          data: { valor: p.valor, ips, nombreEscrito: p.nombre, motivo: p.motivo, candidatoId: candidato.id, votanteId: sesion.user.id },
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
    description: `Postulación Noche de Galardones · ${ips}`,
  });
  revalidatePath("/galardones");
  revalidatePath("/galardones/resultados");
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
  return { ok: true };
}

export async function configurarConvocatoria(entrada: { abierta: boolean; cierraEl: string | null }): Promise<{ ok: true } | { ok: false; error: string }> {
  const sesion = await requireAdminEscritura();
  const cierraEl = entrada.cierraEl ? new Date(`${entrada.cierraEl}T23:59:59-05:00`) : null;
  if (cierraEl && Number.isNaN(cierraEl.getTime())) return { ok: false, error: "Fecha de cierre inválida." };
  await prisma.galardonConvocatoria.upsert({
    where: { id: "singleton" },
    update: { abierta: entrada.abierta, cierraEl },
    create: { id: "singleton", abierta: entrada.abierta, cierraEl },
  });
  await registrarAuditoria({
    userId: sesion.user.id,
    action: "UPDATE",
    entity: "Galardon",
    description: `Convocatoria Noche de Galardones ${entrada.abierta ? "abierta" : "cerrada"}${entrada.cierraEl ? ` · cierra ${entrada.cierraEl}` : ""}`,
  });
  revalidatePath("/galardones");
  revalidatePath("/galardones/resultados");
  return { ok: true };
}

/** Quién está en sesión, para mostrar su nombre sin otra consulta desde el cliente. */
export async function sesionActual() {
  const s = await auth();
  return s?.user ? { id: s.user.id, nombre: s.user.name ?? "" } : null;
}

export type ValorClave = GalardonValor;
