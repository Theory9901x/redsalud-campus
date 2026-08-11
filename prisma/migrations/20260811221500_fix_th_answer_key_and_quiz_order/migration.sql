-- Corrección de datos, dos frentes:
--
-- A. La "Evaluación · Talento Humano y Salud Mental" se cargó al inicio sin
--    clave de respuestas y quedó aleatoria. Contra el cuestionario fuente,
--    la única desviada es la pregunta 2 (Mapa de Procesos): estaba marcada
--    "Procesos de Apoyo" y la correcta es "Procesos Estratégicos". Las
--    preguntas 1, 3 y 4 ya coincidían y la 5 es abierta (OPEN_TEXT: se
--    guarda para revisión y no puntúa).
--
-- B. Las evaluaciones salían de PRIMERAS en su módulo: cuando se añadió
--    Quiz.sortOrder quedaron en 0 y las lecciones empiezan en 1. Van al
--    final, después de la última lección.

-- A1. Clave correcta de la pregunta 2
UPDATE "QuestionOption" SET "isCorrect" = true  WHERE "id" = 'cmsa2ovdg000ocyl80wys4clx';
UPDATE "QuestionOption" SET "isCorrect" = false WHERE "id" = 'cmsa2ovdg000qcyl86b1vvrxo';

-- A2. Recalificar las respuestas ya dadas a esa pregunta con la clave nueva
UPDATE "QuizAnswer" qa
SET "isCorrect"     = ('cmsa2ovdg000ocyl80wys4clx' = ANY(qa."selectedOptionIds")),
    "scoreObtained" = CASE WHEN 'cmsa2ovdg000ocyl80wys4clx' = ANY(qa."selectedOptionIds") THEN q."score" ELSE 0 END
FROM "Question" q
WHERE q."id" = qa."questionId"
  AND q."id" = (SELECT "questionId" FROM "QuestionOption" WHERE "id" = 'cmsa2ovdg000ocyl80wys4clx');

-- A3. Recalcular nota y aprobación de los intentos terminados de esa
--     evaluación, con la misma fórmula de la app: porcentaje sobre las
--     preguntas auto-calificables (las abiertas no suman al máximo).
WITH puntos AS (
  SELECT qa."attemptId", SUM(qa."scoreObtained")::numeric AS pts
  FROM "QuizAnswer" qa
  JOIN "QuizAttempt" att ON att."id" = qa."attemptId"
  WHERE att."quizId" = 'cmsa2ovc5000hcyl8vynaf88x' AND att."finishedAt" IS NOT NULL
  GROUP BY qa."attemptId"
), maximo AS (
  SELECT COALESCE(SUM("score"), 0)::numeric AS max
  FROM "Question"
  WHERE "quizId" = 'cmsa2ovc5000hcyl8vynaf88x' AND "isActive" AND "type" <> 'OPEN_TEXT'
)
UPDATE "QuizAttempt" a
SET "score"  = ROUND(100 * puntos.pts / maximo.max)::int,
    "passed" = ROUND(100 * puntos.pts / maximo.max) >= (SELECT "passingScore" FROM "Quiz" WHERE "id" = a."quizId")
FROM puntos, maximo
WHERE a."id" = puntos."attemptId" AND maximo.max > 0;

-- B. Cada evaluación única de módulo, al final del módulo. Los módulos con
--    varias evaluaciones intercaladas (Sub. Servicios) ya traen su orden
--    explícito y no se tocan.
UPDATE "Quiz" qz
SET "sortOrder" = ml.maxs + 1
FROM (SELECT "moduleId", MAX("sortOrder") AS maxs FROM "Lesson" GROUP BY "moduleId") ml
WHERE qz."moduleId" = ml."moduleId"
  AND qz."sortOrder" = 0
  AND (SELECT COUNT(*) FROM "Quiz" q2 WHERE q2."moduleId" = qz."moduleId") = 1;
