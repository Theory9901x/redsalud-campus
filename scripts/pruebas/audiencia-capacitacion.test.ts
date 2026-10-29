import assert from "node:assert/strict";
import test from "node:test";
import { coincideAudienciaCapacitacion } from "../../lib/audiencia-capacitacion";

test("administrativos y asistenciales reciben únicamente su clasificación", () => {
  assert.equal(coincideAudienciaCapacitacion("ADMINISTRATIVO", "ADMINISTRATIVO"), true);
  assert.equal(coincideAudienciaCapacitacion("ADMINISTRATIVO", "ASISTENCIAL"), false);
  assert.equal(coincideAudienciaCapacitacion("ASISTENCIAL", "ADMINISTRATIVO"), false);
  assert.equal(coincideAudienciaCapacitacion("ASISTENCIAL", "ASISTENCIAL"), true);
});

test("ambos incluye los dos grupos de personal", () => {
  assert.equal(coincideAudienciaCapacitacion("AMBOS", "ADMINISTRATIVO"), true);
  assert.equal(coincideAudienciaCapacitacion("AMBOS", "ASISTENCIAL"), true);
});
