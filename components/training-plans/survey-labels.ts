import {
  CircleDot,
  ListChecks,
  Gauge,
  TextCursorInput,
  AlignLeft,
  ToggleLeft,
  Hash,
  CalendarDays,
  Images,
  Shuffle,
} from "lucide-react";
import type { SurveyQuestionType } from "@prisma/client";
import { ETIQUETA_TIPO } from "@/lib/encuestas/tipos";

/** Se reexporta desde el módulo para no tener dos listas de nombres que mantener. */
export const SURVEY_QUESTION_TYPE_LABELS = ETIQUETA_TIPO;

export const SURVEY_QUESTION_TYPE_ICONS: Record<SurveyQuestionType, typeof CircleDot> = {
  SHORT_TEXT: TextCursorInput,
  LONG_TEXT: AlignLeft,
  SINGLE_CHOICE: CircleDot,
  MULTIPLE_CHOICE: ListChecks,
  YES_NO: ToggleLeft,
  SCALE: Gauge,
  NUMBER: Hash,
  DATE: CalendarDays,
  IMAGE_CHOICE: Images,
  MATCHING: Shuffle,
};
