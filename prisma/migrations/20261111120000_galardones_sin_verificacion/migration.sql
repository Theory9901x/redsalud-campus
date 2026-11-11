-- Se quita la verificación de cuentas nuevas en Galardones: las postulaciones
-- retenidas "por verificar" pasan a sumar. Las ANULADAS (decisión explícita
-- de Talento Humano) se dejan como están.
UPDATE "GalardonPostulacion" SET "estado" = 'VALIDA' WHERE "estado" = 'POR_VERIFICAR';
