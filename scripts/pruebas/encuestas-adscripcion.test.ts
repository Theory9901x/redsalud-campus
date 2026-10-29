import assert from "node:assert/strict";
import test from "node:test";
import { capacitacionesParaEncuesta, encuestaSoloDeArea } from "../../lib/encuestas/adscripcion-policy";

test("el tutor sin capacitaciones no obtiene acceso al resto del plan", () => {
  assert.equal(encuestaSoloDeArea("TUTOR", false), true);
  assert.deepEqual(capacitacionesParaEncuesta("sistemas", true), {
    plan: { kind: "CAPACITACION" }, area: { tutorId: "sistemas", isActive: true },
  });
});

test("ser administrador de área tampoco concede todas las capacitaciones", () => {
  assert.equal(encuestaSoloDeArea("ADMIN", true), true);
  const scope = capacitacionesParaEncuesta("talento", true);
  assert.equal("OR" in scope, false);
  assert.deepEqual(scope.area, { tutorId: "talento", isActive: true });
});

test("las áreas distintas mantienen fronteras independientes", () => {
  assert.notDeepEqual(capacitacionesParaEncuesta("calidad", true), capacitacionesParaEncuesta("farmacia", true));
});

test("la administración institucional conserva las encuestas institucionales", () => {
  assert.equal(encuestaSoloDeArea("ADMIN", false), false);
  assert.deepEqual(capacitacionesParaEncuesta("general", false), {});
});
