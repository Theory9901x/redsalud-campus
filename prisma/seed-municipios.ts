import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Siembra los 19 municipios de Casanare. Idempotente (upsert por nombre), así
 * que se puede re-ejecutar sin duplicar. Editable: Talento Humano puede
 * agregar o desactivar municipios desde la tabla sin necesidad de migración.
 */
const MUNICIPIOS_CASANARE = [
  "Yopal",
  "Aguazul",
  "Chámeza",
  "Hato Corozal",
  "La Salina",
  "Maní",
  "Monterrey",
  "Nunchía",
  "Orocué",
  "Paz de Ariporo",
  "Pore",
  "Recetor",
  "Sabanalarga",
  "Sácama",
  "San Luis de Palenque",
  "Támara",
  "Tauramena",
  "Trinidad",
  "Villanueva",
];

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  for (const nombre of MUNICIPIOS_CASANARE) {
    await prisma.municipio.upsert({
      where: { nombre },
      update: {},
      create: { nombre, departamento: "Casanare" },
    });
  }
  const total = await prisma.municipio.count();
  console.log(`Municipios sembrados. Total en la tabla: ${total}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
