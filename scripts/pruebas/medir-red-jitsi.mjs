/**
 * Mide el ANCHO DE BANDA real que consume una llamada, para poder proyectar
 * cuánto necesitaría una jornada de 100 personas. Levanta N receptores
 * (escenario real: un expositor emitiendo, el resto recibiendo) y mide el
 * tráfico de salida del servidor, que es el que escala con los asistentes.
 */
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { SignJWT } from "jose";

const OBJETIVO = Number(process.argv[2] ?? 20);
const SSH_CMD = `ssh -i ${process.env.HOME}/.ssh/redsalud_vps_tunnel -o ConnectTimeout=10 root@2.25.210.122`;

function enServidor(cmd) {
  return execSync(`${SSH_CMD} ${JSON.stringify(cmd)}`, { encoding: "utf8", timeout: 40000 });
}

const envRemoto = (() => {
  const env = {};
  for (const l of enServidor("cat /opt/redsalud/current/.env").split("\n")) {
    const m = l.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
  }
  return env;
})();

const DOMINIO = envRemoto.NEXT_PUBLIC_JITSI_DOMAIN || "campusvirtual.redsaludteforma.com:8443";
const SALA = `CargaRed${Date.now()}`;

async function firmarToken(nombre) {
  return new SignJWT({ aud: "jitsi", iss: envRemoto.JITSI_JWT_APP_ID, sub: "*", room: "*", context: { user: { name: nombre } } })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(new TextEncoder().encode(envRemoto.JITSI_JWT_APP_SECRET));
}

function medirRed() {
  const salida = enServidor(
    "R1=$(cat /sys/class/net/eth0/statistics/rx_bytes); T1=$(cat /sys/class/net/eth0/statistics/tx_bytes); " +
      "sleep 6; " +
      "R2=$(cat /sys/class/net/eth0/statistics/rx_bytes); T2=$(cat /sys/class/net/eth0/statistics/tx_bytes); " +
      "echo $(( (R2-R1)*8/6/1000 )) $(( (T2-T1)*8/6/1000 )); " +
      "docker exec docker-jitsi-meet-jvb-1 sh -c 'curl -s http://localhost:8080/debug' | head -c 200"
  );
  const [linea, ...resto] = salida.trim().split("\n");
  const [rx, tx] = linea.trim().split(/\s+/).map(Number);
  const json = resto.join("");
  const stress = (json.match(/"stress":"([\d.]+)"/) || [])[1];
  // Cuántos endpoints ve el bridge: sin esto no se sabe si el tráfico bajo
  // significa "es barato" o "nadie llegó a entrar".
  let endpoints = -1;
  try {
    const completo = enServidor("docker exec docker-jitsi-meet-jvb-1 sh -c 'curl -s http://localhost:8080/debug'");
    const d = JSON.parse(completo);
    endpoints = Object.values(d.conferences ?? {}).reduce((s, c) => {
      const eps = c?.endpoints ?? {};
      return s + (Array.isArray(eps) ? eps.length : Object.keys(eps).length);
    }, 0);
  } catch {}
  return { rxKbps: rx, txKbps: tx, stress: Number(stress ?? -1), endpoints };
}

const navegadores = [];

async function abrir(indices, emite) {
  const browser = await chromium.launch({
    headless: true,
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--no-sandbox", "--disable-dev-shm-usage"],
  });
  navegadores.push(browser);
  const ctx = await browser.newContext({ permissions: ["microphone", "camera"] });
  await Promise.all(
    indices.map(async (i) => {
      const page = await ctx.newPage();
      const jwt = await firmarToken(`Red${i}`);
      const p = `room=${SALA}&jwt=${jwt}&audio=${emite}&video=${emite}&numClients=1&clientId=${i}`;
      await page.goto(`https://${DOMINIO}/load-test/index.html?${p}#config.prejoinConfig.enabled=false`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
    })
  );
}

async function main() {
  console.log("reposo:", JSON.stringify(medirRed()));

  await abrir([1], true); // expositor emitiendo
  const receptores = [];
  for (let i = 2; i <= OBJETIVO; i++) receptores.push(i);
  // En tandas de 5: abrir 19 pestañas de golpe en un solo contexto hacía que
  // varias no llegaran a negociar y la medición saliera en cero.
  for (let i = 0; i < receptores.length; i += 5) {
    await abrir(receptores.slice(i, i + 5), false);
    await new Promise((r) => setTimeout(r, 4000));
  }

  await new Promise((r) => setTimeout(r, 40000));
  const m = medirRed();
  console.log(`${OBJETIVO} participantes (1 emite, ${OBJETIVO - 1} reciben):`, JSON.stringify(m));
  console.log(`  -> salida por asistente: ${Math.round(m.txKbps / (OBJETIVO - 1))} kbps`);
  console.log(`  -> proyección 100 asistentes: ${Math.round((m.txKbps / (OBJETIVO - 1)) * 99 / 1000)} Mbps de subida`);

  await Promise.allSettled(navegadores.map((b) => b.close()));
  console.log("cerrado.");
}

main().catch(async (e) => {
  console.error("FALLO:", e);
  await Promise.allSettled(navegadores.map((b) => b.close()));
  process.exit(1);
});
