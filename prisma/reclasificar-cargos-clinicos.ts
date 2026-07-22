/**
 * Reclasifica a ASISTENCIAL los cargos clínicos que la columna NIVEL del plan
 * de cargos dejaba como administrativos.
 *
 * Por qué: NIVEL es el nivel jerárquico del empleo público (PRO = Profesional,
 * ASIS = Asistencial, etc.), no la naturaleza del trabajo. Un MEDICO SSO tiene
 * NIVEL = PRO y por eso caía en ADMINISTRATIVO. Talento Humano confirmó que
 * médicos, bacteriólogos, enfermeros y odontólogos son asistenciales.
 *
 * Actualiza la tabla Cargo (para futuras importaciones) y a las personas ya
 * cargadas. Idempotente.
 *
 *   npx tsx --env-file=.env prisma/reclasificar-cargos-clinicos.ts [--commit]
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/** Prefijos de cargo que son asistenciales por la naturaleza del trabajo. */
const PREFIJOS_CLINICOS = ["MEDICO", "ENFERMERO", "BACTERIOLOGO", "ODONTOLOGO"];

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const commit = process.argv.includes("--commit");

const cargos = await prisma.cargo.findMany({ orderBy: { nombre: "asc" } });
const aCambiar = cargos.filter(
  (c) => c.personnelType !== "ASISTENCIAL" && PREFIJOS_CLINICOS.some((p) => c.nombre.toUpperCase().startsWith(p))
);

console.log(`${commit ? "=== APLICANDO ===" : "=== DRY-RUN (no escribe) ==="}`);
if (aCambiar.length === 0) {
  console.log("Nada por reclasificar: los cargos clínicos ya son ASISTENCIAL.");
} else {
  for (const c of aCambiar) {
    const n = await prisma.user.count({ where: { cargoId: c.id } });
    console.log(`  ${c.nombre}: ADMINISTRATIVO -> ASISTENCIAL (${n} personas)`);
  }
}

if (commit && aCambiar.length > 0) {
  const ids = aCambiar.map((c) => c.id);
  await prisma.cargo.updateMany({ where: { id: { in: ids } }, data: { personnelType: "ASISTENCIAL" } });
  const { count } = await prisma.user.updateMany({
    where: { cargoId: { in: ids } },
    data: { personnelType: "ASISTENCIAL" },
  });
  console.log(`\nCargos actualizados: ${aCambiar.length} | Personas actualizadas: ${count}`);

  const resumen = await prisma.user.groupBy({
    by: ["personnelType"],
    where: { origenRegistro: "IMPORTACION" },
    _count: { _all: true },
  });
  console.log("Distribución final del personal importado:");
  resumen.forEach((r) => console.log(`  ${r.personnelType}: ${r._count._all}`));
} else if (!commit) {
  console.log("\nNada fue escrito. Repite con --commit para aplicar.");
}

await prisma.$disconnect();
