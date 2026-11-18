-- Prórroga de la convocatoria de Galardones por centro IPS: con la
-- convocatoria general cerrada, los centros listados siguen recibiendo
-- postulaciones hasta su propia fecha.
ALTER TABLE "GalardonConvocatoria" ADD COLUMN "prorrogas" JSONB NOT NULL DEFAULT '{}';

-- San Luis de Palenque y Villanueva no alcanzaron a postular antes del cierre
-- (16-nov-2026): votan todo el jueves 19-nov-2026, hasta las 11:59 p. m. (Bogotá).
INSERT INTO "GalardonConvocatoria" ("id", "anio", "abierta", "updatedAt", "prorrogas")
VALUES ('singleton', 2026, true, NOW(), '{"San Luis de Palenque": "2026-11-20T04:59:59.000Z", "Villanueva": "2026-11-20T04:59:59.000Z"}')
ON CONFLICT ("id") DO UPDATE SET "prorrogas" = EXCLUDED."prorrogas";
