import sanitizeHtml from "sanitize-html";

/**
 * HTML SEGURO para el contenido enriquecido que escriben tutores y
 * administradores (lecciones, instrucciones del curso).
 *
 * El esquema decía "HTML sanitizado" pero nadie sanitizaba: lo que salía
 * del editor iba directo a dangerouslySetInnerHTML. Aquí se define UNA
 * lista blanca y se aplica en dos puntos: al guardar (para que la base
 * quede limpia) y al renderizar (para el contenido que ya existía).
 *
 * Los embebidos (Genially, Canva, Google Docs/Slides/Drive, YouTube, Vimeo,
 * Office, Padlet, Prezi, Wordwall, Educaplay) se permiten SOLO desde esos
 * dominios: un iframe a cualquier otro sitio se elimina.
 */
const HOSTS_EMBEBIDOS = [
  "youtube.com",
  "www.youtube.com",
  "www.youtube-nocookie.com",
  "player.vimeo.com",
  "view.genially.com",
  "view.genial.ly",
  "www.canva.com",
  "docs.google.com",
  "drive.google.com",
  "forms.gle",
  "onedrive.live.com",
  "1drv.ms",
  "view.officeapps.live.com",
  "padlet.com",
  "prezi.com",
  "wordwall.net",
  "www.educaplay.com",
  "es.educaplay.com",
  "h5p.org",
  "www.mentimeter.com",
  "app.lumi.education",
];

export function hostEmbebidoPermitido(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === "https:" && HOSTS_EMBEBIDOS.some((h) => hostname === h || hostname.endsWith("." + h));
  } catch {
    return false;
  }
}

export function htmlSeguro(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html, {
    allowedTags: [
      "p", "br", "h2", "h3", "h4", "strong", "b", "em", "i", "u", "s", "code", "pre",
      "ul", "ol", "li", "blockquote", "hr", "a", "img", "iframe", "div", "span",
      "table", "thead", "tbody", "tr", "th", "td",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "width", "height"],
      iframe: ["src", "width", "height", "allow", "allowfullscreen", "frameborder", "title"],
      div: ["class", "data-embebido"],
      span: ["class"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
    },
    allowedSchemes: ["https", "http", "mailto"],
    allowedSchemesByTag: { img: ["https", "http", "data"], iframe: ["https"] },
    // Los iframes solo desde los proveedores de la lista blanca.
    exclusiveFilter: (frame) => frame.tag === "iframe" && !hostEmbebidoPermitido(frame.attribs.src ?? ""),
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer" },
      }),
    },
  });
}
