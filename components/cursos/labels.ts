import { Compass, RotateCcw, GraduationCap, ShieldAlert, Sparkles } from "lucide-react";
import type {
  CourseType,
  CourseStatus,
  LessonContentType,
  EnrollmentMode,
  EnrollmentStatus,
  QuestionType,
} from "@prisma/client";

export const COURSE_TYPE_LABELS: Record<CourseType, string> = {
  INDUCCION: "Inducción",
  REINDUCCION: "Reinducción",
  CAPACITACION: "Capacitación",
  OBLIGATORIO: "Obligatorio",
  COMPLEMENTARIO: "Complementario",
};

export const COURSE_TYPE_ICONS: Record<CourseType, typeof Compass> = {
  INDUCCION: Compass,
  REINDUCCION: RotateCcw,
  CAPACITACION: GraduationCap,
  OBLIGATORIO: ShieldAlert,
  COMPLEMENTARIO: Sparkles,
};

/** Cada tipo de curso con su propio color de marca, como en la landing. */
export const COURSE_TYPE_COLORS: Record<
  CourseType,
  { iconBox: string; badge: string; gradient: string }
> = {
  INDUCCION: {
    iconBox: "bg-primary",
    badge: "bg-primary/10 text-primary",
    gradient: "from-primary/70 to-primary",
  },
  REINDUCCION: {
    iconBox: "bg-success",
    badge: "bg-success/10 text-success",
    gradient: "from-success/70 to-success",
  },
  CAPACITACION: {
    iconBox: "bg-warning",
    badge: "bg-warning/15 text-warning-foreground",
    gradient: "from-warning/70 to-warning",
  },
  OBLIGATORIO: {
    iconBox: "bg-destructive",
    badge: "bg-destructive/10 text-destructive",
    gradient: "from-destructive/70 to-destructive",
  },
  COMPLEMENTARIO: {
    iconBox: "bg-navy",
    badge: "bg-navy/10 text-navy",
    gradient: "from-navy/70 to-navy",
  },
};

export const COURSE_STATUS_LABELS: Record<CourseStatus, string> = {
  DRAFT: "Borrador",
  PUBLISHED: "Publicado",
  ARCHIVED: "Archivado",
};

export const COURSE_STATUS_CLASSES: Record<CourseStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  PUBLISHED: "bg-success/10 text-success",
  ARCHIVED: "bg-destructive/10 text-destructive",
};

/** Color del punto para el badge flotante blanco sobre las tarjetas póster. */
export const COURSE_STATUS_DOT: Record<CourseStatus, string> = {
  DRAFT: "bg-muted-foreground",
  PUBLISHED: "bg-success",
  ARCHIVED: "bg-destructive",
};

export const ENROLLMENT_MODE_LABELS: Record<EnrollmentMode, string> = {
  ASSIGNED: "Solo asignación",
  OPEN: "Abierto (autoinscripción)",
};

export const ENROLLMENT_STATUS_LABELS: Record<EnrollmentStatus, string> = {
  ACTIVE: "En progreso",
  COMPLETED: "Completado",
  FAILED: "No aprobado",
  CANCELLED: "Cancelado",
};

export const ENROLLMENT_STATUS_CLASSES: Record<EnrollmentStatus, string> = {
  ACTIVE: "bg-warning/15 text-warning-foreground",
  COMPLETED: "bg-success/10 text-success",
  FAILED: "bg-destructive/10 text-destructive",
  CANCELLED: "bg-muted text-muted-foreground",
};

/** Color del punto para el badge flotante blanco sobre las tarjetas póster. */
export const ENROLLMENT_STATUS_DOT: Record<EnrollmentStatus, string> = {
  ACTIVE: "bg-warning",
  COMPLETED: "bg-success",
  FAILED: "bg-destructive",
  CANCELLED: "bg-muted-foreground",
};

export const LESSON_CONTENT_TYPE_LABELS: Record<LessonContentType, string> = {
  TEXT: "Texto",
  YOUTUBE: "Video de YouTube",
  PDF: "Documento PDF",
  IMAGE: "Imagen",
  LINK: "Enlace externo",
  MIXED: "Mixto",
};

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  SINGLE_CHOICE: "Selección única",
  MULTIPLE_CHOICE: "Selección múltiple",
  TRUE_FALSE: "Verdadero / Falso",
};
