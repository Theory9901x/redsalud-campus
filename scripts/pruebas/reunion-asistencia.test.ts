import assert from "node:assert/strict";
import test from "node:test";
import { consolidarAsistencia, type TramoAsistencia } from "../../lib/reunion-asistencia";

const base = new Date("2026-10-29T13:00:00-05:00");
const time = (s: number) => new Date(+base + s * 1000);
function tramo(event: string, desde: number, hasta: number, externo = false): TramoAsistencia {
  return { userId: externo ? null : "interno", externalParticipantId: externo ? "invitado" : null, displayName: "Nombre en sala", joinedAt: time(desde), leftAt: time(hasta), durationSeconds: hasta - desde, event,
    user: externo ? null : { fullName: "Ana Pérez", position: "Profesional" }, externalParticipant: externo ? { fullName: "Luis Rojas", company: "Coordinador" } : null };
}
test("el ingreso real figura inmediatamente, aunque aún no haya permanencia", () => {
  const [row] = consolidarAsistencia([tramo("JOIN", 0, 0)], time(10));
  assert.equal(row.nombre, "Ana Pérez"); assert.equal(row.cargo, "Profesional"); assert.equal(row.estado, "En sala"); assert.equal(row.minutos, 0);
});
test("una persona con varios cortes aparece una vez y no duplica intervalos", () => {
  const rows = consolidarAsistencia([tramo("JOIN", 0, 0), tramo("HEARTBEAT", 0, 60), tramo("HEARTBEAT", 30, 90), tramo("LEAVE", 90, 120)], time(130));
  assert.equal(rows.length, 1); assert.equal(rows[0].segundos, 120); assert.equal(rows[0].conexiones, 1); assert.equal(rows[0].salidaEl?.getTime(), +time(120));
});
test("el invitado usa el nombre y cargo del registro, con acceso realmente registrado", () => {
  assert.deepEqual(consolidarAsistencia([], time(10)), []);
  const [row] = consolidarAsistencia([tramo("JOIN", 0, 0, true), tramo("LEAVE", 0, 30, true)], time(40));
  assert.equal(row.nombre, "Luis Rojas"); assert.equal(row.cargo, "Coordinador"); assert.equal(row.tipo, "registro");
});
test("no inventa una salida ante una desconexión sin cierre y limita al cierre de la reunión", () => {
  const [row] = consolidarAsistencia([tramo("JOIN", 0, 0), tramo("HEARTBEAT", 0, 300)], time(400), time(120));
  assert.equal(row.segundos, 120); assert.equal(row.salidaEl, null); assert.equal(row.estado, "Sin cierre registrado");
});
