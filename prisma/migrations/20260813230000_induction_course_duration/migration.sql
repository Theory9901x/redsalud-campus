-- Intensidad horaria oficial del curso de Inducción y Reinducción: 120 horas.
-- Es el valor que se imprime en la constancia; estaba en 0 porque nunca se
-- fijó al crear el curso. Título exacto para no rozar otros cursos de
-- inducción (p. ej. "Inducción a procesos administrativos").
UPDATE "Course"
SET "durationHours" = 120
WHERE lower(title) = lower('Inducción y reinducción');
