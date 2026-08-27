import { chromium, type Page } from "playwright";

/**
 * DEMO del constructor de cursos, hecho POR LA INTERFAZ del tutor (es lo
 * que se va a enseñar): módulo → 7 lecciones (una por tipo de contenido,
 * con archivos reales y un embebido en el texto enriquecido) → cuestionario
 * con los 4 tipos de pregunta → publicación → recorrido del estudiante hasta
 * aprobar la evaluación.
 */
const BASE = process.env.DEMO_BASE ?? "http://localhost:3000";
const COURSE_ID = process.env.DEMO_COURSE_ID ?? "";
const SHOTS = "C:/Users/USUARIO/AppData/Local/Temp/claude/d--redsaludlms/0515329b-aad2-41a1-9184-2b88a262b03b/scratchpad";
const ASSETS = `${SHOTS}/demo-assets`;
const SLUG = "demo-manejo-residuos-hospitalarios";

const errores: string[] = [];

async function entrar(page: Page, email: string) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', "Demo2026*");
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
}

/** Espera a que el diálogo (Radix) se cierre: señal de que la acción terminó bien. */
async function esperarCierre(page: Page) {
  try {
    await page.waitForSelector('[role="region"][aria-label^="Nuev"]', { state: "detached", timeout: 30000 });
  } catch (e) {
    const err = await page.locator('[role="region"] .text-destructive').allTextContents().catch(() => []);
    await page.screenshot({ path: `${SHOTS}/fallo-dialogo.png` });
    throw new Error("El diálogo no cerró. Error mostrado: " + JSON.stringify(err));
  }
  // Tras guardar, el servidor re-envía el temario y el editor lo adopta:
  // se deja asentar antes de abrir el siguiente diálogo.
  await page.waitForTimeout(1500);
}

async function crearLeccion(
  page: Page,
  datos: {
    titulo: string;
    descripcion: string;
    tipo: "TEXT" | "YOUTUBE" | "VIDEO" | "PDF" | "IMAGE" | "LINK" | "MIXED";
    minutos: number;
    texto?: () => Promise<void>;
    youtube?: string;
    archivo?: string;
    enlace?: string;
  }
) {
  await page.click('button:has-text("Añadir lección")');
  const dialogo = page.locator('[role="region"]');
  await dialogo.waitFor();
  await dialogo.locator("#title").fill(datos.titulo);
  await dialogo.locator("#description").fill(datos.descripcion);
  await dialogo.locator("#contentType").selectOption(datos.tipo);
  if (datos.texto) await datos.texto();
  if (datos.youtube) await dialogo.locator("#videoUrl").fill(datos.youtube);
  if (datos.archivo) await dialogo.locator("#file").setInputFiles(datos.archivo);
  if (datos.enlace) await dialogo.locator("#externalUrl").fill(datos.enlace);
  await dialogo.locator("#estimatedMinutes").fill(String(datos.minutos));
  await dialogo.locator('button:has-text("Guardar lección")').click();
  await esperarCierre(page);
  console.log("  lección creada:", datos.titulo, `(${datos.tipo})`);
}

async function crearPregunta(
  page: Page,
  datos: {
    tipo: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE" | "OPEN_TEXT";
    enunciado: string;
    puntaje: number;
    retro: string;
    opciones?: { texto: string; correcta: boolean }[];
    esperada?: string;
    imagen?: string;
  }
) {
  await page.click('button:has-text("Añadir pregunta")');
  const d = page.locator('[role="region"]');
  await d.waitFor();
  await d.locator("#type").selectOption(datos.tipo);
  await d.locator("#statement").fill(datos.enunciado);
  if (datos.imagen) await d.locator("#image").setInputFiles(datos.imagen);
  await d.locator("#score").fill(String(datos.puntaje));
  await d.locator("#explanation").fill(datos.retro);
  if (datos.tipo === "OPEN_TEXT") {
    await d.locator("#expectedAnswer").fill(datos.esperada ?? "");
  } else if (datos.tipo === "TRUE_FALSE") {
    // Verdadero/Falso trae sus dos opciones; solo se marca la correcta.
    const correcta = datos.opciones!.findIndex((o) => o.correcta);
    await d.locator('input[aria-label="Marcar como correcta"]').nth(correcta).check({ force: true });
  } else {
    const ops = datos.opciones!;
    // El formulario arranca con 2 opciones vacías: se añaden las que falten.
    for (let i = 2; i < ops.length; i++) await d.locator('button:has-text("Añadir opción")').click();
    for (let i = 0; i < ops.length; i++) {
      await d.locator(`input[placeholder="Opción ${i + 1}"]`).fill(ops[i].texto);
      if (ops[i].correcta) {
        const marca = d.locator('input[aria-label="Marcar como correcta"]').nth(i);
        if (datos.tipo === "MULTIPLE_CHOICE") await marca.check({ force: true });
        else await marca.check({ force: true });
      }
    }
  }
  await d.locator('button:has-text("Guardar pregunta")').click();
  await esperarCierre(page);
  console.log("  pregunta creada:", datos.tipo, "·", datos.enunciado.slice(0, 50));
}

async function main() {
  if (!COURSE_ID) throw new Error("Falta DEMO_COURSE_ID");
  const curso = { id: COURSE_ID };
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  page.on("pageerror", (e) => errores.push("tutor: " + String(e).slice(0, 140)));

  await entrar(page, "demo.tutora@ejemplo.test");
  await page.goto(`${BASE}/tutor/cursos/${curso.id}`);
  await page.click('[role="tab"]:has-text("Temario")');
  await page.waitForSelector('button:has-text("Añadir módulo")');
  await page.screenshot({ path: `${SHOTS}/curso-01-temario-vacio.png` });

  // 1. Módulo
  await page.click('button:has-text("Añadir módulo")');
  let d = page.locator('[role="region"]');
  await d.locator("#mod-title").fill("Módulo 1 · Segregación de residuos en el punto de generación");
  await d.locator("#mod-description").fill("Código de colores, canecas y errores frecuentes en la segregación.");
  await d.locator('button:has-text("Guardar módulo")').click();
  await esperarCierre(page);
  console.log("módulo creado");

  // 2. Lecciones: una por tipo de contenido
  await crearLeccion(page, {
    titulo: "1. ¿Por qué segregar bien?",
    descripcion: "Lectura con presentación embebida.",
    tipo: "TEXT",
    minutos: 10,
    texto: async () => {
      // Se escribe con calma: cada acción de la barra espera a que el editor
      // asiente antes de seguir tecleando (si no, se pierden caracteres).
      const editor = page.locator('[role="region"] .ProseMirror');
      const barra = (t: string) => page.locator(`[role="region"] button[title="${t}"]`);
      await editor.click();
      await page.keyboard.type("La segregación correcta reduce el riesgo biológico y el costo de disposición final.", { delay: 5 });
      await page.keyboard.press("Enter");
      await barra("Título").click();
      await page.waitForTimeout(200);
      await page.keyboard.type("Lo que debes recordar", { delay: 5 });
      await page.keyboard.press("Enter");
      await page.waitForTimeout(200);
      await barra("Lista").click();
      await page.waitForTimeout(200);
      await page.keyboard.type("Rojo: biosanitarios y cortopunzantes", { delay: 5 });
      await page.keyboard.press("Enter");
      await page.keyboard.type("Negro: no aprovechables", { delay: 5 });
      await page.keyboard.press("Enter");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(200);
      // Enlace: como lo haría una persona, seleccionar la palabra con doble
      // clic y pulsar el botón de enlace.
      await page.keyboard.type("Consulta la normativa vigente", { delay: 5 });
      await page.waitForTimeout(200);
      await editor.getByText("normativa").dblclick();
      page.once("dialog", (dlg) => dlg.accept("https://www.minsalud.gov.co"));
      await barra("Enlace").click();
      await page.waitForTimeout(300);
      await editor.click({ position: { x: 300, y: 10 } });
      await page.keyboard.press("Control+End");
      await page.keyboard.press("Enter");
      // Embebido (YouTube pegado como enlace "watch": se convierte a embed)
      page.once("dialog", (dlg) => dlg.accept("https://www.youtube.com/watch?v=3PmVJQUCm4E&t=5s"));
      await barra("Insertar embebido (YouTube, Genially, Canva, Google Slides...)").click();
      await page.waitForTimeout(400);
    },
  });
  await crearLeccion(page, {
    titulo: "2. Video: los cinco momentos del lavado de manos",
    descripcion: "Video de YouTube (formato corto).",
    tipo: "YOUTUBE",
    minutos: 6,
    youtube: "https://youtu.be/3PmVJQUCm4E",
  });
  await crearLeccion(page, {
    titulo: "3. Guía rápida de segregación (PDF)",
    descripcion: "Documento de consulta.",
    tipo: "PDF",
    minutos: 8,
    archivo: `${ASSETS}/guia-residuos.pdf`,
  });
  await crearLeccion(page, {
    titulo: "4. Infografía del código de colores",
    descripcion: "Imagen de referencia para el puesto de trabajo.",
    tipo: "IMAGE",
    minutos: 3,
    archivo: `${ASSETS}/canecas.png`,
  });
  await crearLeccion(page, {
    titulo: "5. Video institucional (archivo subido)",
    descripcion: "Video propio, reproducido desde el campus.",
    tipo: "VIDEO",
    minutos: 2,
    archivo: `${ASSETS}/lavado-manos.webm`,
  });
  await crearLeccion(page, {
    titulo: "6. Normativa: Resolución 2184 de 2019",
    descripcion: "Enlace externo a la fuente oficial.",
    tipo: "LINK",
    minutos: 5,
    enlace: "https://www.minambiente.gov.co/documento-normativa/resolucion-2184-de-2019/",
  });
  await crearLeccion(page, {
    titulo: "7. Repaso mixto: texto + video + adjunto + enlace",
    descripcion: "Lección mixta que combina varios contenidos.",
    tipo: "MIXED",
    minutos: 10,
    texto: async () => {
      await page.locator('[role="region"] .ProseMirror').click();
      await page.keyboard.type("Repasa la infografía adjunta y el video antes de la evaluación.");
    },
    youtube: "https://www.youtube.com/watch?v=3PmVJQUCm4E",
    archivo: `${ASSETS}/canecas.png`,
    enlace: "https://www.minsalud.gov.co",
  });
  await page.screenshot({ path: `${SHOTS}/curso-02-lecciones.png`, fullPage: true });

  // 3. Cuestionario del módulo
  await page.click('button:has-text("Añadir cuestionario")');
  d = page.locator('[role="region"]');
  await d.locator("#quiz-title").fill("Evaluación · Segregación de residuos");
  await d.locator("#quiz-description").fill("Cuatro tipos de pregunta. Mínimo 70 % para aprobar.");
  await d.locator("#passingScore").fill("70");
  await d.locator("#maxAttempts").fill("3");
  await d.locator("#timeLimitMinutes").fill("15");
  await d.locator('button:has-text("Guardar cuestionario")').click();
  await esperarCierre(page);
  console.log("cuestionario creado");

  await crearPregunta(page, {
    tipo: "SINGLE_CHOICE",
    enunciado: "¿En qué caneca se deposita una jeringa usada?",
    puntaje: 2,
    retro: "Los cortopunzantes van al guardián y este a la ruta roja.",
    opciones: [
      { texto: "Guardián (ruta roja)", correcta: true },
      { texto: "Caneca negra", correcta: false },
      { texto: "Caneca blanca", correcta: false },
    ],
  });
  await crearPregunta(page, {
    tipo: "MULTIPLE_CHOICE",
    enunciado: "Selecciona los residuos que van en la caneca blanca (aprovechables):",
    puntaje: 3,
    retro: "Solo aprovechables limpios y secos.",
    opciones: [
      { texto: "Cartón limpio", correcta: true },
      { texto: "Botella plástica vacía", correcta: true },
      { texto: "Gasas con sangre", correcta: false },
      { texto: "Papel de baño", correcta: false },
    ],
  });
  await crearPregunta(page, {
    tipo: "TRUE_FALSE",
    enunciado: "Según la infografía, la caneca verde recibe residuos orgánicos aprovechables.",
    puntaje: 1,
    retro: "Verde = orgánicos aprovechables.",
    imagen: `${ASSETS}/pregunta-canecas.png`,
    opciones: [
      { texto: "Verdadero", correcta: true },
      { texto: "Falso", correcta: false },
    ],
  });
  await crearPregunta(page, {
    tipo: "OPEN_TEXT",
    enunciado: "Describe qué harías si encuentras un cortopunzante en una caneca negra.",
    puntaje: 2,
    retro: "Se evalúa la revisión por Talento Humano.",
    esperada: "No manipular con la mano; usar pinzas/guantes, trasladar al guardián y reportar el incidente.",
  });
  await page.screenshot({ path: `${SHOTS}/curso-03-cuestionario.png`, fullPage: true });

  console.log("errores de página:", errores.length, errores.slice(0, 3));
  await browser.close();
}

main();
