import { z } from "zod";
import { CERTIFICATE_FONT_FAMILIES } from "@/lib/certificate-template";

const fieldKeySchema = z.enum([
  "nombreCompleto",
  "tipoDocumento",
  "numeroDocumento",
  "curso",
  "tipoCurso",
  "intensidadHoraria",
  "ciudad",
  "fecha",
  "codigo",
  "institucion",
  "firmante",
  "cargoFirmante",
  "textoAdicional",
]);

const fontFamilySchema = z.enum(CERTIFICATE_FONT_FAMILIES);
const alignSchema = z.enum(["left", "center", "right"]);
// Coordenadas y tamaños se expresan en % de la página; se acota un rango generoso
// para tolerar elementos parcialmente fuera del lienzo sin permitir valores absurdos.
const pctSchema = z.number().finite().min(-50).max(150);

const textElementSchema = z.object({
  id: z.string().min(1),
  type: z.literal("text"),
  fieldKey: fieldKeySchema,
  x: pctSchema,
  y: pctSchema,
  fontSize: z.number().finite().min(1).max(200),
  fontFamily: fontFamilySchema,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  align: alignSchema,
  widthPct: pctSchema,
});

const imageElementSchema = z.object({
  id: z.string().min(1),
  type: z.literal("image"),
  kind: z.enum(["logo", "firma", "custom"]),
  src: z.string().nullable(),
  x: pctSchema,
  y: pctSchema,
  widthPct: pctSchema,
  heightPct: pctSchema,
});

const qrElementSchema = z.object({
  id: z.string().min(1),
  type: z.literal("qr"),
  x: pctSchema,
  y: pctSchema,
  sizePct: pctSchema,
});

const staticTextElementSchema = z.object({
  id: z.string().min(1),
  type: z.literal("static"),
  text: z.string(),
  x: pctSchema,
  y: pctSchema,
  fontSize: z.number().finite().min(1).max(200),
  fontFamily: fontFamilySchema,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  align: alignSchema,
  widthPct: pctSchema,
});

const elementSchema = z.discriminatedUnion("type", [
  textElementSchema,
  imageElementSchema,
  qrElementSchema,
  staticTextElementSchema,
]);

export const certificateLayoutSchema = z.object({
  elements: z.array(elementSchema),
});
