import { chromium } from "playwright";
const BASE = "https://campusvirtual.redsaludteforma.com";
const SCRATCH = "C:/Users/USUARIO/AppData/Local/Temp/claude/d--redsaludlms/0515329b-aad2-41a1-9184-2b88a262b03b/scratchpad";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
const errors = [];
page.on("response", r => { if (r.status() >= 400) errors.push(`${r.url()} ${r.status()}`); });
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', "redsaludteforma@gmail.com");
await page.fill('input[name="password"]', "redsaludteforma123");
await page.click('button[type="submit"]');
await page.waitForTimeout(2500);

const t0 = Date.now();
await page.goto(`${BASE}/admin/usuarios`, { waitUntil: "networkidle" });
console.log(`carga /admin/usuarios: ${Date.now()-t0}ms`);
const filas = await page.locator("tbody tr").count();
console.log("filas mostradas:", filas);
console.log("texto paginación:", (await page.locator("text=/registros ·/").innerText().catch(()=>"?")));
await page.screenshot({ path: `${SCRATCH}/pag1.png` });

// Cambiar a 100 registros
await page.selectOption('#pageSize', "100");
await page.waitForTimeout(2500);
console.log("tras elegir 100 -> filas:", await page.locator("tbody tr").count());

// Ir a página 2
await page.selectOption('#pageSize', "20");
await page.waitForTimeout(2000);
await page.click('button:has-text("Siguiente")');
await page.waitForTimeout(2000);
console.log("página 2 ->", (await page.locator("text=/Página \d+ de/").innerText().catch(()=>"?")));
await page.screenshot({ path: `${SCRATCH}/pag2.png` });
console.log("errors:", JSON.stringify(errors));
await browser.close();
