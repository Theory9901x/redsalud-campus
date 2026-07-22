import { chromium } from "playwright";
const BASE="https://campusvirtual.redsaludteforma.com";
const SCRATCH="C:/Users/USUARIO/AppData/Local/Temp/claude/d--redsaludlms/0515329b-aad2-41a1-9184-2b88a262b03b/scratchpad";
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1500,height:1000}});
await p.goto(BASE+"/login",{waitUntil:"networkidle"});
await p.fill("input[name=email]","redsaludteforma@gmail.com");
await p.fill("input[name=password]","redsaludteforma123");
await p.click("button[type=submit]"); await p.waitForTimeout(3000);
await p.goto(BASE+"/admin/reportes/centro",{waitUntil:"networkidle"}); await p.waitForTimeout(3500);
// KPIs
const kpis = await p.locator(".surface-clay").allInnerTexts();
console.log("KPIs:", JSON.stringify(kpis.slice(0,5).map(t=>t.replace(/\n/g," "))));
// buscar municipios con avance > 0
const el = await p.locator("text=Cumplimiento por municipio").locator("xpath=ancestor::section").first();
await el.screenshot({path:`${SCRATCH}/fix-muni.png`});
await b.close();
