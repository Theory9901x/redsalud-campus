import { CircleDot, ListChecks, Gauge, TextCursorInput } from "lucide-react";
import type { SurveyQuestionType } from "@prisma/client";

export const SURVEY_QUESTION_TYPE_LABELS: Record<SurveyQuestionType, string> = {
  SINGLE_CHOICE: "Selección única",
  MULTIPLE_CHOICE: "Selección múltiple",
  SCALE: "Escala",
  TEXT: "Texto libre",
};

export const SURVEY_QUESTION_TYPE_ICONS: Record<SurveyQuestionType, typeof CircleDot> = {
  SINGLE_CHOICE: CircleDot,
  MULTIPLE_CHOICE: ListChecks,
  SCALE: Gauge,
  TEXT: TextCursorInput,
};
