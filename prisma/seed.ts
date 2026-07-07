import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";

async function main() {
  const adminPasswordHash = await bcrypt.hash("redsaludteforma123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "redsaludteforma@gmail.com" },
    update: {},
    create: {
      fullName: "Mateo Robayo Moreno",
      documentType: "CC",
      documentNumber: "1015469107",
      email: "redsaludteforma@gmail.com",
      passwordHash: adminPasswordHash,
      role: "ADMIN",
      status: "ACTIVE",
      mustChangePassword: true,
    },
  });
  console.log(`Usuario ADMIN listo: ${admin.email}`);

  const categories = [
    { name: "Inducción y Reinducción", description: "Procesos de bienvenida y actualización institucional." },
    { name: "Capacitación Institucional", description: "Formación continua para el personal de la entidad." },
    { name: "Seguridad y Salud en el Trabajo", description: "Cursos obligatorios de riesgos laborales." },
    { name: "Sistema de Gestión de Calidad", description: "Procesos, normatividad y mejora continua." },
  ];

  for (const category of categories) {
    await prisma.courseCategory.upsert({
      where: { name: category.name },
      update: {},
      create: category,
    });
  }
  console.log(`Categorías base listas: ${categories.length}`);

  await prisma.institutionSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
  console.log("Configuración institucional lista.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
