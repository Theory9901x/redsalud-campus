-- El contenido de los cursos nace desbloqueado.
--
-- El desbloqueo secuencial venía activado por defecto, así que todos los
-- cursos publicados encadenaban sus lecciones: una evaluación sin aprobar
-- dejaba bloqueado el resto del curso. En Inducción y reinducción eso dejaba
-- 17 de 24 lecciones inaccesibles para el personal.
--
-- El orden pedagógico se sigue viendo en la lista; lo que se quita es la
-- barrera. Quien quiera encadenar un curso puede volver a activarlo desde el
-- interruptor "Módulos secuenciales" de la ficha del curso.

ALTER TABLE "Course" ALTER COLUMN "isSequential" SET DEFAULT false;

UPDATE "Course" SET "isSequential" = false WHERE "isSequential" = true;
