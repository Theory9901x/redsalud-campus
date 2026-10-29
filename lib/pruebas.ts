import type { Role } from "@prisma/client";

/**
 * Contenido de PRUEBA: todo lo que se llame "prueba"/"pruebas" o vaya marcado
 * [PRUEBA]/[DEMO]. Existe para revisar pantallas y solo lo ve el rol ADMIN;
 * ni tutores, ni seguimiento, ni estudiantes.
 */
export const esPrueba = (...textos: (string | null | undefined)[]) =>
  textos.some((t) => !!t && /\[(PRUEBA|DEMO)\]|(^|[^a-záéíóúñ])pruebas?([^a-záéíóúñ]|$)/i.test(t));

export const veePruebas = (role: Role | null | undefined) => role === "ADMIN";

/** Filtro Prisma equivalente sobre `title` (por subcadena: la base no tiene límite de palabra). */
export const SIN_PRUEBAS = { NOT: [{ title: { contains: "prueba", mode: "insensitive" as const } }, { title: { contains: "[DEMO]", mode: "insensitive" as const } }] };
