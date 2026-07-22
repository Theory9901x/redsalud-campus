import { chromium } from "playwright";
const BASE = "https://campusvirtual.redsaludteforma.com";
const browser = await chromium.launch();
const c0 = await browser.newContext({ viewport:{width:1440,height:950} });
const p0 = await c0.newPage();
await p0.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await p0.fill('input[name="email"]', "redsaludteforma@gmail.com");
await p0.fill('input[name="password"]', "redsaludteforma123");
await p0.click('button[type="submit"]');
await p0.waitForTimeout(3000);
const state = await c0.storageState(); await c0.close();
for (const ruta of process.argv.slice(2)) {
  const c = await browser.newContext({ viewport:{width:1440,height:950}, storageState: state });
  const page = await c.newPage();
  await page.goto(`${BASE}/${ruta}`, { waitUntil: "networkidle" });
  const m = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const rs = performance.getEntriesByType("resource");
    const sum = f => Math.round(rs.filter(f).reduce((s,x)=>s+(x.transferSize||0),0)/1024);
    return { ttfb:Math.round(nav.responseStart-nav.requestStart),
      fcp:Math.round(performance.getEntriesByType("paint").find(p=>p.name==="first-contentful-paint")?.startTime||0),
      load:Math.round(nav.loadEventEnd), js:sum(x=>x.name.endsWith(".js")), fonts:sum(x=>x.name.includes(".woff")), img:sum(x=>x.name.includes("/uploads/")) };
  });
  console.log(`${ruta.padEnd(17)} TTFB ${String(m.ttfb).padStart(4)} | FCP ${String(m.fcp).padStart(4)} | load ${String(m.load).padStart(4)}ms | JS ${String(m.js).padStart(4)}KB | fuentes ${String(m.fonts).padStart(3)}KB | imgs ${m.img}KB`);
  await c.close();
}
await browser.close();
