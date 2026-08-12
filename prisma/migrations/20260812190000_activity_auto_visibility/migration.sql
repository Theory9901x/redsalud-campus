-- La apertura de una capacitación deja de ser un paso manual.
--
-- Abrir jornada a mano era trabajo administrativo redundante: la ficha ya
-- dice si la capacitación está lista, y el cronograma ya distingue "Sin
-- contenido" de "Programada" sin necesidad de un interruptor. Ahora una ficha
-- completa (área, trimestre, objetivo, modalidad) se publica sola, y esta
-- columna guarda la excepción: retirarla a propósito de la vista.
--
-- El cierre NO cambia: sigue siendo una acción deliberada, porque congela la
-- participación y habilita el informe final.

ALTER TABLE "TrainingActivity" ADD COLUMN "manuallyHidden" BOOLEAN NOT NULL DEFAULT false;
