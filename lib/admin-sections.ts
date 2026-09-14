import type { AdminSection } from "@prisma/client";

/**
 * Secciones del panel /admin (todo lo que no es el módulo transversal de
 * encuestas). Un administrador con TODAS estas restringidas es un "gestor
 * de encuestas": no le sirve el Dashboard de formación, así que no se le
 * muestra y /admin lo lleva directo a /encuestas.
 */
const SECCIONES_PANEL: AdminSection[] = ["USUARIOS", "CURSOS", "PLANES_CAPACITACION", "INSCRIPCIONES", "CERTIFICADOS", "NOTIFICACIONES", "REPORTES", "CONFIGURACION"];

export function soloEncuestas(restringidas: AdminSection[] | undefined | null) {
  const r = restringidas ?? [];
  return !r.includes("ENCUESTAS") && SECCIONES_PANEL.every((s) => r.includes(s));
}
