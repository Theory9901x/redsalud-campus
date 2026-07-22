import { chromium } from "playwright";
const BASE = "https://campusvirtual.redsaludteforma.com";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', "redsaludteforma@gmail.com");
await page.fill('input[name="password"]', "redsaludteforma123");
await page.click('button[type="submit"]');
await page.waitForTimeout(2500);
const rutas = ["/admin","/admin/usuarios","/admin/inscripciones","/admin/certificados","/admin/cursos","/admin/reportes","/inicio","/cursos"];
for (const r of rutas) {
  const t0 = Date.now();
  await page.goto(`${BASE}${r}`, { waitUntil: "domcontentloaded" });
  const dcl = Date.now()-t0;
  await page.waitForLoadState("networkidle").catch(()=>{});
  console.log(`${r.padEnd(24)} HTML ${String(dcl).padStart(5)}ms | completo ${String(Date.now()-t0).padStart(5)}ms`);
}
await browser.close();
