import assert from "node:assert/strict";
import test from "node:test";
import { alcanceReuniones, puedeEliminarReuniones, puedeEscribirReuniones, type UsuarioReuniones } from "../../lib/reuniones-policy";

const area: UsuarioReuniones = { id: "area-a", role: "ADMIN", canManageAllMeetings: false };

test("una cuenta administradora de área solo consulta sus creaciones", () => {
  assert.deepEqual(alcanceReuniones(area), { kind: "REUNION", createdById: "area-a" });
  assert.deepEqual(alcanceReuniones({ ...area, id: "area-b" }), { kind: "REUNION", createdById: "area-b" });
});

test("el anfitrión o responsable no amplía el alcance del creador", () => {
  const filtro = alcanceReuniones({ ...area, role: "TUTOR" });
  assert.equal(filtro.createdById, area.id);
  assert.equal("tutorId" in filtro, false);
  assert.equal("OR" in filtro, false);
});

test("la vista global requiere el permiso explícito y rol de administrador", () => {
  assert.deepEqual(alcanceReuniones({ ...area, canManageAllMeetings: true }), { kind: "REUNION" });
  assert.deepEqual(alcanceReuniones({ ...area, role: "TUTOR", canManageAllMeetings: true }), { kind: "REUNION", createdById: area.id });
});

test("seguimiento conserva consulta global sin permiso de escritura", () => {
  const observador = { ...area, role: "SEGUIMIENTO" as const };
  assert.deepEqual(alcanceReuniones(observador), { kind: "REUNION" });
  assert.equal(puedeEscribirReuniones(observador), false);
  assert.equal(puedeEscribirReuniones(area), true);
  assert.equal(puedeEscribirReuniones({ ...area, role: "STUDENT" }), false);
});

test("solo el superadministrador elimina reuniones", () => {
  assert.equal(puedeEliminarReuniones({ role: "ADMIN", isSuperAdmin: true }), true);
  // Talento Humano: ADMIN con vista global, pero sin eliminar.
  assert.equal(puedeEliminarReuniones({ role: "ADMIN", isSuperAdmin: false }), false);
  assert.equal(puedeEliminarReuniones({ role: "TUTOR", isSuperAdmin: true }), false);
  assert.equal(puedeEliminarReuniones({ role: "SEGUIMIENTO", isSuperAdmin: false }), false);
});
