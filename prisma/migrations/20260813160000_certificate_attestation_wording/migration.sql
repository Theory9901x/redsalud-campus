-- La redacción institucional cambió: el certificado ya no dice "Se certifica
-- que" sino "Red Salud Casanare E.S.E. da constancia de que". La frase vive
-- impresa en la imagen de fondo de la plantilla, así que se apunta la
-- plantilla activa al fondo corregido (el archivo se publica junto con este
-- cambio en public/uploads/plantillas/fondo/).
UPDATE "CertificateTemplate"
SET "backgroundImageUrl" = '/uploads/plantillas/fondo/certificado-constancia.png'
WHERE "isDefault" = true;
