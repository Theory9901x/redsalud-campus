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

const URL_CAMPUS = "https://campusvirtual.redsaludteforma.com";

const escaparHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * Correo de credenciales personales del campus (envío uno a uno). Con `clave`
 * lleva usuario + contraseña; sin ella (la persona ya fijó la suya) lleva el
 * usuario y cómo recuperar la contraseña si la olvidó.
 */
export function plantillaCredenciales({ nombre, usuario, clave }: { nombre: string; usuario: string; clave: string | null }) {
  const login = `${URL_CAMPUS}/login`;
  const asunto = clave ? "Tus credenciales de acceso al Campus Virtual RedSalud Te Forma" : "Tu acceso al Campus Virtual RedSalud Te Forma";

  const texto = `Hola ${nombre},

Red Salud Casanare E.S.E., a través de Talento Humano, te comparte tu acceso personal a RedSalud Te Forma, el campus virtual de capacitación institucional.

Usuario: ${usuario}
${clave ? `Contraseña: ${clave}\n` : "Contraseña: la que tú definiste al ingresar.\n"}
Ingresa aquí: ${login}

${
  clave
    ? "Escribe la contraseña tal como aparece: distingue mayúsculas y minúsculas."
    : "Si no la recuerdas, en la pantalla de ingreso usa «¿Olvidaste tu contraseña?» y te llegará un código a este correo."
}

Tus credenciales son personales e intransferibles: no las compartas.
Si tienes inconvenientes para ingresar, comunícate con Talento Humano.

Red Salud Casanare E.S.E. · Talento Humano
Mensaje automático, por favor no respondas a este correo.`;

  const n = escaparHtml(nombre);
  const u = escaparHtml(usuario);
  const fila = (etiqueta: string, valor: string, destacado = false) => `
      <tr>
        <td style="padding:12px 16px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#6B7C8F;width:110px;border-bottom:1px solid #E3E9EF">${etiqueta}</td>
        <td style="padding:12px 16px;font-family:Consolas,'Courier New',monospace;font-size:${destacado ? "19px" : "15px"};font-weight:700;color:#0F2438;border-bottom:1px solid #E3E9EF;word-break:break-all">${valor}</td>
      </tr>`;

  const html = `<!doctype html>
<html lang="es"><body style="margin:0;background:#EEF2F6;padding:24px 12px">
<div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;color:#2B3A4A">
  <div style="background:#0F2438;border-radius:16px 16px 0 0;padding:24px 28px">
    <table role="presentation" cellspacing="0" cellpadding="0"><tr>
      <td style="padding-right:14px"><img src="${URL_CAMPUS}/icon.png" width="48" height="48" alt="RedSalud" style="display:block;border-radius:10px;background:#fff"></td>
      <td>
        <p style="margin:0;font-size:19px;font-weight:700;color:#fff">RedSalud Te Forma</p>
        <p style="margin:3px 0 0;font-size:13px;color:#B9CCDD">Campus virtual · Red Salud Casanare E.S.E.</p>
      </td>
    </tr></table>
  </div>
  <div style="height:4px;background:#1FA3DB"></div>
  <div style="background:#fff;border-radius:0 0 16px 16px;padding:28px">
    <p style="margin:0 0 6px;font-size:16px">Hola <strong>${n}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.55">Talento Humano te comparte tu acceso personal al campus virtual de capacitación institucional.</p>
    <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="background:#F4F7FA;border-radius:12px;border-collapse:separate;overflow:hidden">
      ${fila("Usuario", u)}
      ${clave ? fila("Contraseña", escaparHtml(clave), true) : fila("Contraseña", '<span style="font-family:system-ui,sans-serif;font-size:14px;font-weight:600;color:#2B3A4A">La que tú definiste al ingresar</span>')}
    </table>
    <div style="text-align:center;margin:26px 0 22px">
      <a href="${login}" style="display:inline-block;background:#1FA3DB;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 32px;border-radius:10px">Ingresar al campus</a>
      <p style="margin:10px 0 0;font-size:12px;color:#6B7C8F">${login}</p>
    </div>
    <p style="margin:0 0 10px;font-size:13.5px;line-height:1.55;color:#2B3A4A">${
      clave
        ? "Escribe la contraseña tal como aparece: <strong>distingue mayúsculas y minúsculas</strong>."
        : "Si no la recuerdas, en la pantalla de ingreso usa <strong>«¿Olvidaste tu contraseña?»</strong> y te llegará un código a este correo."
    }</p>
    <p style="margin:0;font-size:13.5px;line-height:1.55;color:#2B3A4A">Tus credenciales son <strong>personales e intransferibles</strong>: no las compartas. Si tienes inconvenientes para ingresar, comunícate con Talento Humano.</p>
    <p style="margin:24px 0 0;padding-top:14px;border-top:1px solid #DCE3EA;font-size:12px;color:#6B7C8F">Red Salud Casanare E.S.E. · Talento Humano<br>Mensaje automático, por favor no respondas a este correo.</p>
  </div>
</div>
</body></html>`;

  return { asunto, texto, html };
}
