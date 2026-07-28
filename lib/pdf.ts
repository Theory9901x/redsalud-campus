import type { Browser } from "playwright";

/**
 * Generación de PDF renderizando la propia hoja imprimible en un Chromium
 * headless.
 *
 * Por qué así y no con una librería de composición de PDF (@react-pdf/renderer
 * y parecidas): esas obligan a mantener un SEGUNDO árbol de componentes con su
 * propio sistema de estilos. Cada cambio en el informe habría que hacerlo dos
 * veces, y al primer descuido el PDF y la pantalla dejan de decir lo mismo.
 * Aquí el PDF es literalmente la página que el administrador ya puede abrir y
 * mandar a imprimir con Ctrl+P: un solo formato, imposible que se desincronicen.
 *
 * El navegador se lanza UNA vez y se reutiliza entre peticiones. Arrancar
 * Chromium cuesta 1-2 s y varios cientos de MB; hacerlo por cada informe en un
 * VPS que además corre la aplicación sería el camino más corto a quedarse sin
 * memoria.
 */

let navegadorPromesa: Promise<Browser> | null = null;

async function getNavegador(): Promise<Browser> {
  if (!navegadorPromesa) {
    navegadorPromesa = (async () => {
      // Import dinámico: playwright es una dependencia pesada y solo hace
      // falta cuando alguien genera un PDF. Si se importara arriba, entraría
      // en el arranque del servidor aunque nadie exporte nunca un informe.
      const { chromium } = await import("playwright");
      const navegador = await chromium.launch({
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
      });
      // Si el proceso del navegador muere (OOM, reinicio), soltar la promesa
      // para que la siguiente petición lance uno nuevo en vez de reutilizar
      // un manejador muerto para siempre.
      navegador.on("disconnected", () => {
        navegadorPromesa = null;
      });
      return navegador;
    })();

    // Un fallo al lanzar no debe quedar memorizado en la promesa.
    navegadorPromesa.catch(() => {
      navegadorPromesa = null;
    });
  }
  return navegadorPromesa;
}

export class PdfNoDisponibleError extends Error {}

/**
 * Renderiza una URL de la propia aplicación a PDF.
 *
 * `cookie` es la cabecera de la petición original: sin ella el navegador
 * headless llegaría a la hoja sin sesión, el proxy lo mandaría a /login y el
 * PDF saldría con la pantalla de acceso. Se reenvía tal cual para que la hoja
 * se renderice exactamente con los permisos de quien pidió el informe, ni más
 * ni menos.
 */
export async function renderizarPdf({
  url,
  cookie,
  cabecerasProxy,
  encabezado,
}: {
  url: string;
  cookie: string;
  /**
   * Las cabeceras que nginx pone en la petición pública (x-forwarded-proto y
   * x-forwarded-host). Hay que reenviarlas porque Auth.js decide el NOMBRE de
   * la cookie de sesión según si la petición es segura: en HTTPS emite
   * `__Secure-authjs.session-token`, pero al entrar por el loopback en HTTP
   * plano buscaría `authjs.session-token`, sin prefijo, y no encontraría
   * ninguna sesión aunque la cookie correcta viaje en la cabecera.
   */
  cabecerasProxy: Record<string, string>;
  encabezado: string;
}): Promise<Buffer> {
  let navegador: Browser;
  try {
    navegador = await getNavegador();
  } catch (error) {
    throw new PdfNoDisponibleError(
      `No se pudo iniciar el navegador de impresión: ${error instanceof Error ? error.message : "error desconocido"}`
    );
  }

  const contexto = await navegador.newContext();
  try {
    await contexto.setExtraHTTPHeaders({ cookie, ...cabecerasProxy });

    const pagina = await contexto.newPage();
    const respuesta = await pagina.goto(url, { waitUntil: "networkidle", timeout: 60_000 });

    if (!respuesta || !respuesta.ok()) {
      throw new Error(`La hoja respondió ${respuesta?.status() ?? "sin respuesta"}`);
    }
    // El proxy redirige a /login cuando la sesión no viajó bien. Sin esta
    // comprobación el informe saldría siendo un pantallazo del formulario de
    // acceso, que es peor que un error: parece que funcionó.
    if (new URL(pagina.url()).pathname.startsWith("/login")) {
      throw new Error("La sesión no llegó al navegador de impresión.");
    }
    // La hoja tiene que existir de verdad; si el selector no aparece, algo
    // falló en el render y no queremos entregar un PDF en blanco.
    await pagina.waitForSelector(".hoja-impresa", { timeout: 15_000 });

    const pdf = await pagina.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `<div style="font-size:7pt;color:#5c6b7a;width:100%;padding:0 12mm;">${encabezado}</div>`,
      footerTemplate:
        '<div style="font-size:7pt;color:#5c6b7a;width:100%;padding:0 12mm;text-align:right;">' +
        'Página <span class="pageNumber"></span> de <span class="totalPages"></span></div>',
      margin: { top: "18mm", bottom: "16mm", left: "12mm", right: "12mm" },
    });

    return pdf;
  } finally {
    await contexto.close();
  }
}
