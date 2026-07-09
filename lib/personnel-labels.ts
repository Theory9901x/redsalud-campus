import type { PersonnelType } from "@prisma/client";

export const PERSONNEL_TYPE_LABELS: Record<PersonnelType, string> = {
  ADMINISTRATIVO: "Administrativo",
  ASISTENCIAL: "Asistencial",
};
