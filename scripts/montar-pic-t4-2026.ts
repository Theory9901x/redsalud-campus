import { prisma } from "../lib/prisma";
import { registrarAuditoria } from "../lib/audit";

/**
 * Programación del 4.º TRIMESTRE 2026 del Plan Institucional de Capacitaciones
 * (tabla que pasó Talento Humano el 11-nov-2026: 11 programadas + 7 aplazadas
 * en 17 filas; la 13 cuenta 2 aplazadas).
 *
 * Por cada fila:
 *  - Si la capacitación YA está en el plan 2026 (mismo tema), se OMITE: no se
 *    duplica (ver memoria «trimestres sin duplicar»). La vista previa dice si
 *    tiene o no el T4 marcado.
 *  - Si no está, se CREA en el plan 2026, trimestre 4, en el ÁREA del tema,
 *    con la persona de la tabla como responsable (responsibleUserId) y el
 *    texto de la tabla como responsable del plan (responsibleLabel).
 *  - La persona se busca por nombre entre las cuentas activas; si no hay una
 *    sola coincidencia, NO se adivina: queda el texto y se avisa.
 *
 *   npx tsx --env-file=.env scripts/montar-pic-t4-2026.ts             (vista previa, no cambia nada)
 *   npx tsx --env-file=.env scripts/montar-pic-t4-2026.ts --aplicar
 */

type Fila = {
  item: number;
  titulo: string;
  aplazada: number;
  /** Área del plan (TrainingArea.name) a la que pertenece por su tema. */
  area: string;
  programa?: string;
  /** Texto de la tabla, tal cual. */
  responsable: string;
  /** Palabras del nombre de la persona (todas deben estar). Vacío = la cuenta del área. */
  persona: string[];
  /** Coincide con una capacitación existente si el título normalizado contiene TODAS las de algún grupo. */
  existe: string[][];
};

const FILAS: Fila[] = [
  { item: 1, titulo: "Esquema de vacunación y vacunación en esquemas incompletos en los menores de 6 años de edad", aplazada: 0, area: "Rutas Integrales", programa: "PAI", responsable: "Jefe Johana Parra", persona: ["johana", "parra"], existe: [["esquema", "vacunacion"], ["esquemas incompletos"]] },
  { item: 2, titulo: "Red de frío: toma de temperatura y diligenciamiento de formatos", aplazada: 0, area: "Rutas Integrales", programa: "PAI", responsable: "Jefe Johana Parra", persona: ["johana", "parra"], existe: [["red de frio"]] },
  { item: 3, titulo: "Vacunación segura y política de frascos abiertos", aplazada: 0, area: "Rutas Integrales", programa: "PAI", responsable: "Jefe Johana Parra", persona: ["johana", "parra"], existe: [["vacunacion segura"], ["frascos abiertos"]] },
  { item: 4, titulo: "Vacunación antirrábica, vacunación en víctimas de violencia sexual y vacunación a gestantes y adultos", aplazada: 0, area: "Rutas Integrales", programa: "PAI", responsable: "Jefe Johana Parra", persona: ["johana", "parra"], existe: [["antirrabica"], ["vacunacion", "violencia sexual"]] },
  { item: 5, titulo: "Manejo de derrames: limpieza y desinfección", aplazada: 1, area: "Rutas Integrales", programa: "PAI", responsable: "Mayra Castro", persona: ["mayra", "castro"], existe: [["derrame"]] },
  { item: 6, titulo: "Módulos del sistema nominal del PAI (PAIWEB 2)", aplazada: 0, area: "Rutas Integrales", programa: "PAI", responsable: "Jefe Johana Parra", persona: ["johana", "parra"], existe: [["sistema nominal"], ["paiweb"], ["pai web"]] },
  { item: 7, titulo: "Procedimiento de vacunación extramural", aplazada: 0, area: "Rutas Integrales", programa: "PAI", responsable: "Jefe Johana Parra", persona: ["johana", "parra"], existe: [["extramural"]] },
  { item: 8, titulo: "Proceso de solicitud, selección, recepción, transporte y almacenamiento de los biológicos", aplazada: 0, area: "Rutas Integrales", programa: "PAI", responsable: "Mayra Castro", persona: ["mayra", "castro"], existe: [["biologico"]] },
  { item: 9, titulo: "Capacitación en humanización en salud", aplazada: 0, area: "Atención al Usuario", responsable: "SIAU", persona: [], existe: [["humanizacion"]] },
  { item: 10, titulo: "Capacitación en estrategia IAMII", aplazada: 0, area: "Rutas Integrales", programa: "IAMII", responsable: "Jefe Zaida Soler", persona: ["zaida", "soler"], existe: [["iamii"], ["iami "]] },
  { item: 11, titulo: "Capacitación en estrategia IAMII con enfoque en lactancia materna", aplazada: 0, area: "Rutas Integrales", programa: "IAMII", responsable: "Jefe Zaida Soler", persona: ["zaida", "soler"], existe: [["lactancia"]] },
  { item: 12, titulo: "Capacitación en el Programa de Farmacovigilancia", aplazada: 1, area: "Servicios Farmacéuticos", programa: "Farmacovigilancia", responsable: "Erika Mendoza Robles, regente de farmacia zona administrativa de almacén", persona: ["erika", "mendoza"], existe: [["farmacovigilancia"]] },
  { item: 13, titulo: "Capacitación del Manual de Procesos y Procedimientos del Servicio Farmacéutico", aplazada: 2, area: "Servicios Farmacéuticos", responsable: "Erika Mendoza Robles", persona: ["erika", "mendoza"], existe: [["manual", "farmaceutico"]] },
  { item: 14, titulo: "Uso correcto de los elementos de protección personal", aplazada: 1, area: "Seguridad y Salud en el Trabajo", responsable: "TH - SSG", persona: [], existe: [["elementos de proteccion personal"], ["epp"]] },
  { item: 15, titulo: "Algoritmo diagnóstico de enfermedades transmitidas por vectores (dengue, Chagas)", aplazada: 0, area: "Salud Pública", programa: "ETV", responsable: "Yemi Tatiana, Directora Zona Norte", persona: ["yemi"], existe: [["vectores"], ["dengue"], ["chagas"]] },
  { item: 16, titulo: "Comunicación descendente efectiva en la red de IPS", aplazada: 1, area: "Talento Humano", responsable: "Talento Humano", persona: [], existe: [["comunicacion descendente"]] },
  { item: 17, titulo: "Introducción a la inteligencia artificial para apoyo al trabajo en salud", aplazada: 1, area: "Talento Humano", responsable: "Talento Humano", persona: [], existe: [["inteligencia artificial"]] },
];

const norm = (s: string) => ` ${s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim()} `;

async function main() {
  const aplicar = process.argv.includes("--aplicar");

  const plan = await prisma.trainingPlan.findFirstOrThrow({
    where: { kind: "CAPACITACION", isIndependent: false, title: { contains: "Plan Institucional de Capacitaciones 2026", mode: "insensitive" } },
    select: { id: true, title: true, createdById: true },
  });
  const areas = await prisma.trainingArea.findMany({ select: { id: true, name: true, isActive: true, tutorId: true, tutor: { select: { fullName: true, username: true } } } });
  const actividades = await prisma.trainingActivity.findMany({
    where: { planId: plan.id },
    select: { id: true, title: true, quarters: true, status: true, manuallyHidden: true, area: { select: { name: true } }, responsibleLabel: true, responsibleUser: { select: { fullName: true } } },
  });

  console.log(`Plan: ${plan.title} (${plan.id}) · ${actividades.length} capacitaciones hoy\n`);

  type Plan = { fila: Fila; existentes: typeof actividades; areaId: string | null; responsableId: string | null; nota: string };
  const planes: Plan[] = [];

  for (const f of FILAS) {
    const existentes = actividades.filter((a) => f.existe.some((grupo) => grupo.every((k) => norm(a.title).includes(norm(k).trimEnd()))));
    const area = areas.find((a) => norm(a.name) === norm(f.area)) ?? null;

    let responsableId: string | null = null;
    let nota = "";
    if (f.persona.length) {
      const us = await prisma.user.findMany({
        where: { status: "ACTIVE", AND: f.persona.map((p) => ({ fullName: { contains: p, mode: "insensitive" as const } })) },
        select: { id: true, fullName: true, role: true, position: true },
      });
      if (us.length === 1) {
        responsableId = us[0].id;
        nota = `persona: ${us[0].fullName} (${us[0].role}${us[0].position ? ` · ${us[0].position}` : ""})`;
      } else nota = us.length ? `VARIAS cuentas coinciden (${us.map((u) => `${u.fullName} ${u.role}`).join(" | ")}): no se asigna persona` : "SIN cuenta en la plataforma: queda solo el texto";
    } else if (area?.tutorId) {
      responsableId = area.tutorId;
      nota = `cuenta del área: ${area.tutor?.fullName} (${area.tutor?.username})`;
    } else nota = "el área no tiene cuenta responsable";

    planes.push({ fila: f, existentes, areaId: area?.id ?? null, responsableId, nota });

    const accion = existentes.length ? "OMITIR (ya existe)" : area ? "CREAR" : `CREAR · ÁREA «${f.area}» NO EXISTE, se crea`;
    console.log(`[${String(f.item).padStart(2)}] ${accion}${f.aplazada ? ` · aplazada${f.aplazada > 1 ? ` ×${f.aplazada}` : ""}` : " · programada"}`);
    console.log(`     ${f.titulo}`);
    for (const a of existentes)
      console.log(`     ~ ya está: «${a.title}» · T${a.quarters.join(",T") || "—"}${a.quarters.includes(4) ? "" : "  ⚠ SIN T4"} · ${a.status}${a.manuallyHidden ? " (oculta)" : ""} · área ${a.area?.name ?? "—"} · resp ${a.responsibleUser?.fullName ?? a.responsibleLabel ?? "—"}`);
    if (!existentes.length) console.log(`     área ${f.area}${f.programa ? ` · programa ${f.programa}` : ""} · responsable «${f.responsable}» → ${nota}`);
  }

  const crear = planes.filter((p) => !p.existentes.length);
  console.log(`\nResumen: ${crear.length} por crear · ${planes.length - crear.length} se omiten porque ya existen.`);
  if (!aplicar) {
    console.log("(vista previa: no se cambió nada; agrega --aplicar para crear)");
    return;
  }

  const maxOrden = await prisma.trainingArea.aggregate({ _max: { sortOrder: true } });
  let orden = maxOrden._max.sortOrder ?? 0;
  for (const p of crear) {
    const f = p.fila;
    const areaId =
      p.areaId ??
      (await prisma.trainingArea.upsert({ where: { name: f.area }, update: {}, create: { name: f.area, sortOrder: ++orden }, select: { id: true } })).id;
    const nueva = await prisma.trainingActivity.create({
      data: {
        planId: plan.id,
        areaId,
        title: f.titulo,
        type: "EXTERNAL_EVENT",
        quarters: [4],
        programa: f.programa ?? null,
        responsibleLabel: f.responsable,
        responsibleUserId: p.responsableId,
        methodology: `Programación del 4.º trimestre 2026 (Talento Humano, 11-nov-2026)${f.aplazada ? ` · actividad aplazada${f.aplazada > 1 ? ` (${f.aplazada})` : ""}` : ""}.`,
      },
      select: { id: true },
    });
    await registrarAuditoria({ userId: plan.createdById ?? undefined, action: "CREATE", entity: "TrainingActivity", entityId: nueva.id, description: `PIC 2026 T4: «${f.titulo}» · ${f.area} · ${f.responsable}` });
    console.log(`✔ creada [${f.item}] ${f.titulo} · ${nueva.id}`);
  }
  console.log("\nListo.");
}
main().finally(() => prisma.$disconnect());
