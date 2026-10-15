import type { CourseType } from "@prisma/client";

/**
 * REGLA DE LA ENTIDAD: la única formación que emite constancia es la de
 * INDUCCIÓN Y REINDUCCIÓN. Las capacitaciones del PIC, los comités y el
 * resto de cursos se miden por asistencia, presaber/postsaber y adherencia,
 * pero no generan constancia. Un solo lugar para la regla: emisión,
 * catálogo, aula y los registros la consultan aquí.
 */
export const TIPOS_CON_CONSTANCIA: readonly CourseType[] = ["INDUCCION", "REINDUCCION"];

export function cursoEmiteConstancia(courseType: CourseType): boolean {
  return TIPOS_CON_CONSTANCIA.includes(courseType);
}

/** Filtro Prisma para "cursos que emiten constancia". */
export const CURSOS_CON_CONSTANCIA: { courseType: { in: CourseType[] } } = { courseType: { in: [...TIPOS_CON_CONSTANCIA] } };

export const AVISO_CONSTANCIA = "Solo el curso de Inducción y reinducción genera constancia. Las demás capacitaciones no emiten constancia ni certificado.";
