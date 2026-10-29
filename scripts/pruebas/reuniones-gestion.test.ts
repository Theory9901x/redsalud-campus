import assert from "node:assert/strict";
import test from "node:test";
import { alcanceReuniones, alcanceSesionReunion, reunionCerrada } from "../../lib/reuniones-policy";
import { edicionSesionReunion } from "../../lib/reuniones-edicion";

test("la hora vencida no cierra una reunión abierta", () => {
  const jornada = { startsAt: new Date("2026-10-28T15:00:00-05:00"), endsAt: new Date("2026-10-28T16:30:00-05:00"), status: "OPEN", fase: "CAPACITACION" };
  assert.equal(reunionCerrada("OPEN", jornada), false);
  assert.equal(reunionCerrada("CLOSED", jornada), true);
  assert.equal(reunionCerrada("OPEN", { ...jornada, fase: "CERRADA" }), true);
});

test("delegar una sesión no concede el listado de reuniones de otras áreas", () => {
  const user = { id: "sistemas", role: "TUTOR" as const, canManageAllMeetings: false };
  assert.deepEqual(alcanceReuniones(user), { kind: "REUNION", createdById: user.id });
  assert.deepEqual(alcanceSesionReunion(user), { plan: { kind: "REUNION" }, OR: [{ plan: { createdById: user.id } }, { responsibleUserId: user.id }, { responsibleUserId: null, plan: { tutorId: user.id } }] });
});

const datos = { reunion: "Reunión de prueba", titulo: "Sesión de prueba", objetivo: "Objetivo", ordenDelDia: "Punto uno", responsable: "Sistemas", dirigidoA: "Ambos", anfitrionAreaId: "sistemas", fecha: "2026-10-29", inicio: "15:00", fin: "16:30", audience: "BOTH", modalidad: "VIRTUAL", lugar: "Sala virtual" };
test("edición de horario valida el calendario y la secuencia de horas", () => {
  assert.equal(edicionSesionReunion.safeParse(datos).success, true);
  assert.equal(edicionSesionReunion.safeParse({ ...datos, fecha: "2026-02-31" }).success, false);
  assert.equal(edicionSesionReunion.safeParse({ ...datos, fin: "14:59" }).success, false);
  assert.equal(edicionSesionReunion.safeParse({ ...datos, inicio: "26:00" }).success, false);
  assert.equal(edicionSesionReunion.safeParse({ ...datos, fin: "" }).success, true);
});
