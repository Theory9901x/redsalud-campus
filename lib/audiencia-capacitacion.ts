import type { CourseAudience, PersonnelType } from "@prisma/client";

export function coincideAudienciaCapacitacion(audiencia: CourseAudience, personal: PersonnelType) {
  return audiencia === "AMBOS" || audiencia === personal;
}
