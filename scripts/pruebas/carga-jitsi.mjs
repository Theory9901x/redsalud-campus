/**
 * PRUEBA DE CARGA del servidor Jitsi propio de la entidad.
 *
 * Usa el cliente OFICIAL de carga que trae el propio Jitsi (/load-test):
 * está hecho justo para esto -no pinta la interfaz completa, así que un
 * equipo puede simular muchos más participantes- y habla el mismo protocolo
 * que un asistente real.
 *
 * Los navegadores corren en la máquina LOCAL, nunca en el VPS: levantar
 * decenas de Chromium en un servidor de 2 CPU consumiría justo la CPU que
 * necesitan los usuarios reales, que es lo contrario de lo que se mide.
 *
 * Escenario = una capacitación real: UN expositor emitiendo video y audio, y
 * el resto recibiendo en silencio (que es como entra el personal según
 * sala-virtual.tsx).
 *
 * En cada tanda mide el estrés que reporta el propio bridge, CPU/carga del
 * host y el tiempo de respuesta del campus -para ABORTAR si la prueba
 * empieza a afectar a quien está usando la plataforma ahora mismo-.
 *
 *   node tmp-carga-jitsi.mjs <objetivo> <pasoTanda>
 */
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { SignJWT } from "jose";

const OBJETIVO = Number(process.argv[2] ?? 30);
const PASO = Number(process.argv[3] ?? 10);
const SSH_CMD = `ssh -i ${process.env.HOME}/.ssh/redsalud_vps_tunnel -o ConnectTimeout=10 root@2.25.210.122`;

function enServidor(cmd) {
  return execSync(`${SSH_CMD} ${JSON.stringify(cmd)}`, { encoding: "utf8", timeout: 30000 });
}

const envRemoto = (() => {
  const contenido = enServidor("cat /opt/redsalud/current/.env");
  const env = {};
  for (const l of contenido.split("\n")) {
    const m = l.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
  }
  return env;
})();

const DOMINIO = envRemoto.NEXT_PUBLIC_JITSI_DOMAIN || "campusvirtual.redsaludteforma.com:8443";
const SALA = `CargaPrueba${Date.now()}`;

async function firmarToken(nombre) {
  return new SignJWT({ aud: "jitsi", iss: envRemoto.JITSI_JWT_APP_ID, sub: "*", room: "*", context: { user: { name: nombre } } })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(new TextEncoder().encode(envRemoto.JITSI_JWT_APP_SECRET));
}

function medir() {
  const salida = enServidor(
    `docker exec docker-jitsi-meet-jvb-1 sh -c 'curl -s http://localhost:8080/debug' ; echo '###' ; ` +
      `top -bn2 -d0.5 | grep '^%Cpu' | tail -1 | awk '{print $8}' ; ` +
      `free -m | awk '/^Mem:/{print $3"/"$2}' ; ` +
      `cat /proc/loadavg | awk '{print $1}' ; ` +
      `curl -s -o /dev/null -w '%{time_total}' http://localhost:3200/login`
  );
  const [json, resto] = salida.split("###");
  const [cpuIdle, mem, load1, tiempoApp] = resto.trim().split("\n").map((s) => s.trim());
  let stress = -1, estado = "?", conferencias = 0, endpoints = 0;
  try {
    const d = JSON.parse(json);
    stress = Number(d.load_management?.stress ?? -1);
    estado = d.load_management?.state ?? "?";
    const confs = Object.values(d.conferences ?? {});
    conferencias = confs.length;
    for (const c of confs) {
      const eps = c?.endpoints ?? c?.["endpoints"] ?? {};
      endpoints += Array.isArray(eps) ? eps.length : Object.keys(eps).length;
    }
  } catch {}
  return {
    stress,
    estado,
    conferencias,
    endpointsEnBridge: endpoints,
    cpuHostPct: Math.round((100 - Number(cpuIdle)) * 10) / 10,
    memMB: mem,
    load1: Number(load1),
    appSegundos: Number(tiempoApp),
  };
}

const navegadores = [];

/**
 * Cada navegador aloja VARIOS clientes de carga (el cliente /load-test es
 * liviano): así el equipo local aguanta simular decenas de asistentes.
 */
async function abrirParticipantes(indices, emiteVideo) {
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--autoplay-policy=no-user-gesture-required",
    ],
  });
  navegadores.push(browser);
  const contexto = await browser.newContext({ permissions: ["microphone", "camera"] });
  await Promise.all(
    indices.map(async (i) => {
      const page = await contexto.newPage();
      const jwt = await firmarToken(`Carga${i}`);
      const params = [
        `room=${SALA}`,
        `jwt=${jwt}`,
        // El expositor emite; los asistentes solo reciben (jornada real).
        `audio=${emiteVideo ? "true" : "false"}`,
        `video=${emiteVideo ? "true" : "false"}`,
        "numClients=1",
        `clientId=${i}`,
      ].join("&");
      await page.goto(`https://${DOMINIO}/load-test/index.html?${params}#config.prejoinConfig.enabled=false`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
    })
  );
}

async function main() {
  console.log(`Dominio Jitsi: ${DOMINIO} | sala: ${SALA}`);
  console.log(`Objetivo: ${OBJETIVO} participantes en tandas de ${PASO} (1 expositor emitiendo, resto recibiendo)`);
  const base = medir();
  console.log("BASE:", JSON.stringify(base));
  const appBase = base.appSegundos;

  let total = 0;
  while (total < OBJETIVO) {
    const cuantos = Math.min(PASO, OBJETIVO - total);
    const indices = [];
    for (let i = 0; i < cuantos; i++) indices.push(++total);
    // El primero de todos es el expositor.
    if (indices[0] === 1) {
      await abrirParticipantes([1], true);
      if (indices.length > 1) await abrirParticipantes(indices.slice(1), false);
    } else {
      await abrirParticipantes(indices, false);
    }

    await new Promise((r) => setTimeout(r, 25000)); // negociar media y estabilizar
    const m = medir();
    console.log(
      `participantes=${total} | stress=${m.stress.toFixed(3)} ${m.estado} | conf=${m.conferencias} enBridge=${m.endpointsEnBridge} | ` +
        `cpuHost=${m.cpuHostPct}% load=${m.load1} mem=${m.memMB}MB | campus=${m.appSegundos.toFixed(3)}s`
    );

    if (m.stress > 0.8) {
      console.log("!! Bridge cerca de sobrecarga (stress > 0.8): se detiene la escalada.");
      break;
    }
    if (m.appSegundos > appBase * 5 + 0.5) {
      console.log("!! El campus se está degradando para usuarios reales: se ABORTA.");
      break;
    }
  }

  console.log("cerrando participantes...");
  await Promise.allSettled(navegadores.map((b) => b.close()));
  await new Promise((r) => setTimeout(r, 8000));
  console.log("FINAL:", JSON.stringify(medir()));
}

main().catch(async (e) => {
  console.error("FALLO:", e);
  await Promise.allSettled(navegadores.map((b) => b.close()));
  process.exit(1);
});
