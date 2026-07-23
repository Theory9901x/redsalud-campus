import nodemailer from "nodemailer";

/**
 * Envío de correo de la plataforma.
 *
 * La configuración va por variables de entorno para no atar el código a un
 * proveedor: sirve un servidor institucional o uno externo. Si faltan las
 * variables, en vez de romper el flujo se registra el mensaje en consola y se
 * devuelve `false`, para que quien llama pueda avisar al usuario en vez de
 * dejarlo esperando un correo que nunca saldrá.
 */
const CONFIG = {
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASSWORD,
  from: process.env.SMTP_FROM ?? "RedSalud Te Forma <no-responder@redsaludcasanare.gov.co>",
};

export function correoConfigurado() {
  return Boolean(CONFIG.host && CONFIG.user && CONFIG.pass);
}

export async function enviarCorreo({
  para,
  asunto,
  html,
  texto,
}: {
  para: string;
  asunto: string;
  html: string;
  texto: string;
}): Promise<boolean> {
  if (!correoConfigurado()) {
    console.warn(
      `[correo] SMTP sin configurar. No se envió "${asunto}" a ${para}.\n` +
        `Define SMTP_HOST, SMTP_USER y SMTP_PASSWORD para activarlo.\n---\n${texto}\n---`
    );
    return false;
  }

  try {
    const transporte = nodemailer.createTransport({
      host: CONFIG.host,
      port: CONFIG.port,
      // 465 es SMTPS (TLS desde el saludo); el resto negocia STARTTLS.
      secure: CONFIG.port === 465,
      auth: { user: CONFIG.user, pass: CONFIG.pass },
    });
    await transporte.sendMail({ from: CONFIG.from, to: para, subject: asunto, text: texto, html });
    return true;
  } catch (error) {
    console.error("[correo] Falló el envío:", error);
    return false;
  }
}

/** Plantilla del código de recuperación, con la identidad de la institución. */
export function plantillaCodigoRecuperacion(nombre: string, codigo: string, minutos: number) {
  const texto = `Hola ${nombre},

Tu código para restablecer la contraseña en RedSalud Te Forma es: ${codigo}

Vence en ${minutos} minutos y solo se puede usar una vez.
Si tú no lo solicitaste, ignora este mensaje: tu contraseña no ha cambiado.

Red Salud Casanare E.S.E. · Talento Humano`;

  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#2B3A4A">
  <div style="background:#1B2A3D;border-radius:12px;padding:20px 24px;color:#fff">
    <p style="margin:0;font-size:18px;font-weight:700">RedSalud Te Forma</p>
    <p style="margin:4px 0 0;font-size:13px;color:#C9D6E2">Red Salud Casanare E.S.E.</p>
  </div>
  <p style="margin-top:24px;font-size:15px">Hola <strong>${nombre}</strong>,</p>
  <p style="font-size:15px">Usa este código para restablecer tu contraseña:</p>
  <div style="background:#F4F7FA;border-radius:12px;padding:20px;text-align:center;margin:20px 0">
    <span style="font-size:34px;font-weight:700;letter-spacing:9px;color:#1B2A3D">${codigo}</span>
  </div>
  <p style="font-size:13px;color:#6B7C8F">
    Vence en ${minutos} minutos y solo se puede usar una vez.<br>
    Si tú no lo solicitaste, ignora este mensaje: tu contraseña no ha cambiado.
  </p>
  <p style="margin-top:24px;font-size:12px;color:#6B7C8F;border-top:1px solid #DCE3EA;padding-top:12px">
    Red Salud Casanare E.S.E. · Talento Humano
  </p>
</div>`;

  return { texto, html };
}
