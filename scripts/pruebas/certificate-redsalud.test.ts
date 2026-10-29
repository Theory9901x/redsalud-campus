import assert from "node:assert/strict";
import test from "node:test";
import { fitCertificateLayout } from "../../lib/certificate-pdf";
import { REDSALUD_CERTIFICATE_LAYOUT } from "../../lib/certificate-redsalud-design";
import { SAMPLE_FIELD_VALUES, type CertificateTextElement } from "../../lib/certificate-template";
import { certificateLayoutSchema } from "../../lib/validations/certificate-template";

test("un nombre largo con tildes cabe completo sin modificar la plantilla", async () => {
  const original = structuredClone(REDSALUD_CERTIFICATE_LAYOUT);
  const layout = await fitCertificateLayout(original, {
    ...SAMPLE_FIELD_VALUES,
    nombreCompleto: "MARÍA FERNANDA RODRÍGUEZ HERNÁNDEZ DE LOS ÁNGELES CASTELLANOS GONZÁLEZ",
  });
  const nombre = layout.elements.find((e) => e.id === "nombre") as CertificateTextElement;
  assert.ok(nombre.fontSize < 25 && nombre.fontSize > 10);
  assert.deepEqual(original, REDSALUD_CERTIFICATE_LAYOUT);
  assert.equal(nombre.fieldKey, "nombreCompleto");
});

test("un nombre corto mantiene el tamaño principal del diseño", async () => {
  const layout = await fitCertificateLayout(REDSALUD_CERTIFICATE_LAYOUT, { ...SAMPLE_FIELD_VALUES, nombreCompleto: "Ana Torres" });
  assert.equal((layout.elements.find((e) => e.id === "nombre") as CertificateTextElement).fontSize, 25);
});

test("el nombre extenso del curso se adapta independientemente del participante", async () => {
  const layout = await fitCertificateLayout(REDSALUD_CERTIFICATE_LAYOUT, {
    ...SAMPLE_FIELD_VALUES, nombreCompleto: "Ana Torres",
    curso: "Programa de inducción y reinducción institucional para el personal administrativo y asistencial de Red Salud Casanare E.S.E.",
  });
  assert.ok((layout.elements.find((e) => e.id === "curso") as CertificateTextElement).fontSize < 20);
  assert.equal((layout.elements.find((e) => e.id === "nombre") as CertificateTextElement).fontSize, 25);
});

test("las plantillas anteriores conservan su tipografía y la nueva opción se guarda", async () => {
  const layout = { elements: [{ id: "legacy", type: "text" as const, fieldKey: "nombreCompleto" as const, x: 0, y: 0, widthPct: 5, fontSize: 16, fontFamily: "Helvetica" as const, color: "#000000", align: "left" as const }] };
  assert.deepEqual(await fitCertificateLayout(layout, SAMPLE_FIELD_VALUES), layout);
  const saved = certificateLayoutSchema.parse(REDSALUD_CERTIFICATE_LAYOUT);
  assert.equal((saved.elements.find((e) => e.id === "nombre") as CertificateTextElement).fitToWidth, true);
});
