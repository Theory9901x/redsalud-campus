-- Un estudiante no puede tener DOS intentos abiertos del mismo cuestionario.
--
-- El borrador crea el intento con la primera respuesta. Si dos guardados
-- llegan a la vez, ambos cuentan "cero intentos usados" y crean uno cada uno:
-- las respuestas quedan repartidas entre dos intentos y se gastan dos de los
-- diez disponibles. El cliente ya encola los guardados, pero eso solo protege
-- dentro de una pestaña; esto lo garantiza en la base de datos.
--
-- Índice PARCIAL: solo aplica a los intentos sin terminar. Los ya cerrados
-- pueden repetirse cuantas veces permita maxAttempts, que es justo la idea.
CREATE UNIQUE INDEX "QuizAttempt_un_intento_abierto"
  ON "QuizAttempt" ("userId", "quizId")
  WHERE "finishedAt" IS NULL;
