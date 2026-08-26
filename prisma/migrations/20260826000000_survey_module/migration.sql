-- MÓDULO DE ENCUESTAS: reemplaza el modelo plano de la Etapa 4.
--
-- El modelo anterior (cuatro tipos de pregunta, sin páginas, solo con sesión
-- iniciada) NUNCA llegó a usarse: cero filas tanto en producción como en
-- desarrollo al momento de esta migración. Por eso se sustituye de raíz en
-- vez de arrastrarlo con columnas añadidas: no hay dato que preservar y sí
-- una estructura que corregir (páginas, configuración por pregunta, enlace
-- público, estados y clave de respuesta).

-- ---- Fuera el modelo viejo ------------------------------------------
DROP TABLE IF EXISTS "SurveyAnswerOption" CASCADE;
DROP TABLE IF EXISTS "SurveyAnswer" CASCADE;
DROP TABLE IF EXISTS "SurveyResponse" CASCADE;
DROP TABLE IF EXISTS "SurveyQuestionOption" CASCADE;
DROP TABLE IF EXISTS "SurveyQuestion" CASCADE;
DROP TABLE IF EXISTS "Survey" CASCADE;
DROP TYPE IF EXISTS "SurveyQuestionType";

-- ---- Enums ----------------------------------------------------------
CREATE TYPE "SurveyStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');
CREATE TYPE "SurveyAudience" AS ENUM ('INTERNO', 'EXTERNO', 'MIXTA');
CREATE TYPE "SurveyQuestionType" AS ENUM (
  'SHORT_TEXT', 'LONG_TEXT', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE',
  'YES_NO', 'SCALE', 'NUMBER', 'DATE', 'IMAGE_CHOICE', 'MATCHING'
);

-- ---- Encuesta -------------------------------------------------------
CREATE TABLE "Survey" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "coverImageUrl" TEXT,
    "themeColor" TEXT,
    "estimatedMinutes" INTEGER,
    "audience" "SurveyAudience" NOT NULL DEFAULT 'INTERNO',
    "status" "SurveyStatus" NOT NULL DEFAULT 'DRAFT',
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "trainingPlanId" TEXT,
    "trainingActivityId" TEXT,
    "targetDepartment" TEXT,
    "targetAudience" "CourseAudience" NOT NULL DEFAULT 'AMBOS',
    "requireLogin" BOOLEAN NOT NULL DEFAULT false,
    "allowMultipleResponses" BOOLEAN NOT NULL DEFAULT false,
    "showScoreToRespondent" BOOLEAN NOT NULL DEFAULT false,
    "thankYouMessage" TEXT,
    "opensAt" TIMESTAMP(3),
    "closesAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Survey_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Survey_code_key" ON "Survey"("code");
CREATE UNIQUE INDEX "Survey_slug_key" ON "Survey"("slug");
CREATE INDEX "Survey_trainingPlanId_idx" ON "Survey"("trainingPlanId");
CREATE INDEX "Survey_trainingActivityId_idx" ON "Survey"("trainingActivityId");
CREATE INDEX "Survey_status_idx" ON "Survey"("status");

-- ---- Página (bloque) ------------------------------------------------
CREATE TABLE "SurveyPage" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "attachmentUrl" TEXT,
    "attachmentName" TEXT,
    CONSTRAINT "SurveyPage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SurveyPage_surveyId_sortOrder_key" ON "SurveyPage"("surveyId", "sortOrder");

-- ---- Pregunta -------------------------------------------------------
CREATE TABLE "SurveyQuestion" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "type" "SurveyQuestionType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    CONSTRAINT "SurveyQuestion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SurveyQuestion_pageId_sortOrder_key" ON "SurveyQuestion"("pageId", "sortOrder");

-- ---- Respuesta ------------------------------------------------------
CREATE TABLE "SurveyResponse" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "userId" TEXT,
    "respondentName" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "scorePercent" INTEGER,
    "scoreEarned" INTEGER,
    "scorePossible" INTEGER,
    "channel" TEXT,
    CONSTRAINT "SurveyResponse_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SurveyResponse_surveyId_idx" ON "SurveyResponse"("surveyId");
CREATE INDEX "SurveyResponse_userId_idx" ON "SurveyResponse"("userId");

CREATE TABLE "SurveyAnswer" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "value" JSONB,
    "textValue" TEXT,
    CONSTRAINT "SurveyAnswer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SurveyAnswer_responseId_questionId_key" ON "SurveyAnswer"("responseId", "questionId");

-- ---- Llaves foráneas ------------------------------------------------
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_trainingPlanId_fkey" FOREIGN KEY ("trainingPlanId") REFERENCES "TrainingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_trainingActivityId_fkey" FOREIGN KEY ("trainingActivityId") REFERENCES "TrainingActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SurveyPage" ADD CONSTRAINT "SurveyPage_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SurveyQuestion" ADD CONSTRAINT "SurveyQuestion_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "SurveyPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- El usuario se pone en null y la respuesta sobrevive: si alguien se retira
-- de la entidad, su valoración sigue contando en el resultado de la jornada.
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SurveyAnswer" ADD CONSTRAINT "SurveyAnswer_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "SurveyResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SurveyAnswer" ADD CONSTRAINT "SurveyAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "SurveyQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
