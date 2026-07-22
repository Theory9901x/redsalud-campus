import { chromium } from "playwright";
const BASE = "https://campusvirtual.redsaludteforma.com";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', "redsaludteforma@gmail.com");
await page.fill('input[name="password"]', "redsaludteforma123");
await page.click('button[type="submit"]');
await page.waitForTimeout(2500);

for (const r of ["/admin/inscripciones","/admin/usuarios"]) {
  await page.goto(`${BASE}${r}`, { waitUntil: "networkidle" });
  const m = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const rs = performance.getEntriesByType("resource");
    const js = rs.filter(x=>x.name.endsWith(".js"));
    const top = js.map(x=>({n:x.name.split("/").pop().slice(0,40), kb:Math.round((x.transferSize||0)/1024), ms:Math.round(x.duration)}))
      .sort((a,b)=>b.kb-a.kb).slice(0,5);
    return {
      ttfb: Math.round(nav.responseStart - nav.requestStart),
      htmlKB: Math.round((nav.transferSize||0)/1024),
      domInteractive: Math.round(nav.domInteractive),
      domComplete: Math.round(nav.domComplete),
      jsTotalKB: Math.round(js.reduce((s,x)=>s+(x.transferSize||0),0)/1024),
      jsCount: js.length,
      top,
      selectOptions: document.querySelectorAll("select option").length,
    };
  });
  console.log(`\n=== ${r}`);
  console.log(`  TTFB ${m.ttfb}ms | HTML ${m.htmlKB}KB | domInteractive ${m.domInteractive}ms | domComplete ${m.domComplete}ms`);
  console.log(`  JS: ${m.jsTotalKB}KB en ${m.jsCount} archivos | <option> en la página: ${m.selectOptions}`);
  m.top.forEach(t=>console.log(`    ${String(t.kb).padStart(4)}KB ${String(t.ms).padStart(5)}ms  ${t.n}`));
}
await browser.close();
