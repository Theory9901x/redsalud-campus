/**
 * Graba una sesión CORTA de la jornada de demostración y la archiva.
 *
 * No fabrica el archivo por fuera ni lo inserta en la base: usa el MISMO
 * MediaRecorder del navegador que usa la grabación real de la sala y lo sube
 * por el MISMO endpoint autenticado, así que lo que queda archivado recorrió
 * exactamente el camino de una grabación de verdad.
 *
 *   npx tsx --env-file=.env scripts/demo/grabar-demo.ts <urlBase> <correoAdmin> <clave>
 */
import { chromium } from "playwright";
import { prisma } from "../../lib/prisma";

const BASE = process.argv[2] ?? "http://localhost:3000";
const ADMIN = process.argv[3] ?? "redsaludteforma@gmail.com";
const CLAVE = process.argv[4] ?? "RedSalud2026*";
const SEGUNDOS = 5;

/**
 * El trabajo dentro del navegador va como TEXTO, no como función: al
 * serializar una función, el transpilador le inyecta ayudantes propios
 * (__name) que no existen en la página y la evaluación falla antes de
 * empezar.
 */
function guionDeGrabacion(activityId: string, segundos: number) {
  return `(async () => {
    const lienzo = document.createElement("canvas");
    lienzo.width = 640; lienzo.height = 360;
    const ctx = lienzo.getContext("2d");

    let frame = 0;
    const pintar = function () {
      frame++;
      ctx.fillStyle = "#0F2438"; ctx.fillRect(0, 0, 640, 360);
      ctx.fillStyle = "#2BA6DE"; ctx.fillRect(0, 0, 640, 56);
      ctx.fillStyle = "#FFFFFF"; ctx.font = "bold 22px sans-serif";
      ctx.fillText("RedSalud Te Forma", 20, 36);
      ctx.font = "bold 18px sans-serif";
      ctx.fillText("Grabacion de la jornada (demostracion)", 20, 120);
      ctx.font = "14px sans-serif"; ctx.fillStyle = "#A8C4D8";
      ctx.fillText(new Date().toLocaleString("es-CO"), 20, 156);
      ctx.fillText("segundo " + Math.floor(frame / 15), 20, 182);
      ctx.fillStyle = frame % 30 < 15 ? "#C4232A" : "#5B7184";
      ctx.beginPath(); ctx.arc(600, 28, 10, 0, Math.PI * 2); ctx.fill();
    };
    const temporizador = setInterval(pintar, 1000 / 15);
    pintar();

    const flujo = lienzo.captureStream(15);
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
    const trozos = [];
    const grabador = new MediaRecorder(flujo, { mimeType: mime, videoBitsPerSecond: 800000 });
    grabador.ondataavailable = function (e) { if (e.data.size > 0) trozos.push(e.data); };

    await new Promise(function (listo) {
      grabador.onstop = function () { listo(); };
      grabador.start(500);
      setTimeout(function () { grabador.stop(); }, ${segundos} * 1000);
    });
    clearInterval(temporizador);
    flujo.getTracks().forEach(function (t) { t.stop(); });

    const blob = new Blob(trozos, { type: "video/webm" });
    const fecha = new Date().toISOString().slice(0, 16).replace("T", " ").replace(":", "h");
    const datos = new FormData();
    datos.append("file", new File([blob], "Grabacion jornada " + fecha + ".webm", { type: "video/webm" }));

    const r = await fetch("/api/planes-capacitacion/actividades/${activityId}/grabacion", { method: "POST", body: datos });
    return { ok: r.ok, estado: r.status, bytes: blob.size, tipo: mime };
  })()`;
}

async function main() {
  const actividad = await prisma.trainingActivity.findFirstOrThrow({
    where: { title: { startsWith: "[DEMO]" }, status: "CLOSED" },
    select: { id: true, title: true },
  });
  console.log(`Jornada: ${actividad.title}`);

  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', ADMIN);
  await page.fill('input[name="password"]', CLAVE);
  await page.click('button[type="submit"]');
  // Basta con salir de /login: si la cuenta tiene cambio de contraseña
  // obligatorio aterriza en /cambiar-contrasena, y esperar /admin colgaría
  // el guion. La sesión ya está iniciada, que es lo único que hace falta
  // para que la subida lleve su cookie.
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
  console.log(`sesión iniciada (aterrizó en ${new URL(page.url()).pathname})`);

  // Ya autenticados y en el mismo origen: la subida lleva la cookie de
  // sesión igual que la llevaría el botón «Grabar jornada».
  const resultado = await page.evaluate(guionDeGrabacion(actividad.id, SEGUNDOS));
  console.log("subida:", JSON.stringify(resultado));
  await browser.close();

  const docs = await prisma.media.findMany({
    where: { trainingActivityId: actividad.id },
    select: { fileName: true, fileType: true, fileSize: true, fileUrl: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  console.log(`\nDocumentos archivados en la jornada (${docs.length}):`);
  for (const d of docs) {
    console.log(`   · ${d.fileName}  [${d.fileType}, ${(d.fileSize / 1024).toFixed(0)} KB]`);
    console.log(`     ${d.fileUrl}`);
  }
}

main()
  .catch((e) => {
    console.error("FALLÓ:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
