-- Fondo nuevo entregado por la entidad (frase "REDSALUD E.S.E DA CONSTANCIA
-- DE QUE" y el "CC" ya impresos, "Código de constancia" en vez de "Código de
-- certificado") y el layout reubicado sobre sus líneas: sin tipo de documento
-- (el CC va impreso) y el QR de validación en la esquina inferior izquierda,
-- que es el único espacio libre del nuevo diseño. La imagen se publica junto
-- con este cambio en public/uploads/plantillas/fondo/ (ruta fuera de git),
-- estirada a proporción A4 exacta para que object-fit cover no la recorte.
UPDATE "CertificateTemplate"
SET
  "backgroundImageUrl" = '/uploads/plantillas/fondo/certificado-constancia-v2.png',
  "layoutJson" = '{"elements":[
    {"id":"nombre","type":"text","fieldKey":"nombreCompleto","x":21.8,"y":40.2,"fontSize":16,"fontFamily":"Helvetica-Bold","color":"#233E8F","align":"center","widthPct":57.3},
    {"id":"numero-documento","type":"text","fieldKey":"numeroDocumento","x":47.9,"y":47.9,"fontSize":12,"fontFamily":"Helvetica","color":"#233E8F","align":"center","widthPct":20.8},
    {"id":"curso","type":"text","fieldKey":"curso","x":19.5,"y":61.8,"fontSize":15,"fontFamily":"Helvetica-Bold","color":"#233E8F","align":"center","widthPct":60.3},
    {"id":"intensidad","type":"text","fieldKey":"intensidadHoraria","x":31.6,"y":73.2,"fontSize":10,"fontFamily":"Helvetica","color":"#233E8F","align":"center","widthPct":13.8},
    {"id":"fecha","type":"text","fieldKey":"fecha","x":71.8,"y":73.2,"fontSize":10,"fontFamily":"Helvetica","color":"#233E8F","align":"center","widthPct":17.4},
    {"id":"firma","type":"image","kind":"firma","src":null,"x":40,"y":76.8,"widthPct":19,"heightPct":7},
    {"id":"codigo","type":"text","fieldKey":"codigo","x":81.4,"y":86.2,"fontSize":10,"fontFamily":"Helvetica-Bold","color":"#233E8F","align":"center","widthPct":13.4},
    {"id":"qr","type":"qr","x":10,"y":79.5,"sizePct":8}
  ]}'::jsonb
WHERE "isDefault" = true;
