import { GraduationCap, Presentation } from "lucide-react";
import type { TrainingPlanStatus, TrainingActivityType, TrainingActivityStatus } from "@prisma/client";

export const TRAINING_PLAN_STATUS_LABELS: Record<TrainingPlanStatus, string> = {
  DRAFT: "Borrador",
  ACTIVE: "Activo",
  ARCHIVED: "Archivado",
};

export const TRAINING_PLAN_STATUS_CLASSES: Record<TrainingPlanStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  ACTIVE: "bg-success/10 text-success",
  ARCHIVED: "bg-destructive/10 text-destructive",
};

export const TRAINING_ACTIVITY_TYPE_LABELS: Record<TrainingActivityType, string> = {
  COURSE: "Curso de la plataforma",
  EXTERNAL_EVENT: "Evento externo",
};

export const TRAINING_ACTIVITY_TYPE_ICONS: Record<TrainingActivityType, typeof GraduationCap> = {
  COURSE: GraduationCap,
  EXTERNAL_EVENT: Presentation,
};

/** Ciclo de vida de la jornada (Etapa 6 construye el flujo; el label ya existe desde la Etapa 1). */
export const TRAINING_ACTIVITY_STATUS_LABELS: Record<TrainingActivityStatus, string> = {
  DRAFT: "Borrador",
  OPEN: "Abierta",
  CLOSED: "Cerrada",
};

export const TRAINING_ACTIVITY_STATUS_CLASSES: Record<TrainingActivityStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  OPEN: "bg-success/10 text-success",
  CLOSED: "bg-navy/10 text-navy",
};
