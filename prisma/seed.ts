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
      personnelType: "ADMINISTRATIVO",
      position: "Director de Talento Humano",
      mustChangePassword: true,
    },
  });
  console.log(`Usuario ADMIN listo: ${admin.email}`);

  const examplePasswordHash = await bcrypt.hash("PruebaSegura123", 10);

  const tutorAdministrativo = await prisma.user.upsert({
    where: { email: "ana.torres@redsaludcasanare.gov.co" },
    update: {},
    create: {
      fullName: "Ana Torres",
      documentType: "CC",
      documentNumber: "1020304050",
      email: "ana.torres@redsaludcasanare.gov.co",
      passwordHash: examplePasswordHash,
      role: "TUTOR",
      status: "ACTIVE",
      personnelType: "ADMINISTRATIVO",
      position: "Coordinadora Administrativa",
      mustChangePassword: false,
    },
  });

  const tutorAsistencial = await prisma.user.upsert({
    where: { email: "carlos.ramirez@redsaludcasanare.gov.co" },
    update: {},
    create: {
      fullName: "Carlos Ramírez",
      documentType: "CC",
      documentNumber: "1020304051",
      email: "carlos.ramirez@redsaludcasanare.gov.co",
      passwordHash: examplePasswordHash,
      role: "TUTOR",
      status: "ACTIVE",
      personnelType: "ASISTENCIAL",
      position: "Enfermero Jefe",
      mustChangePassword: false,
    },
  });

  await prisma.user.upsert({
    where: { email: "estudiante.administrativo@redsaludcasanare.gov.co" },
    update: {},
    create: {
      fullName: "Laura Gómez",
      documentType: "CC",
      documentNumber: "1020304052",
      email: "estudiante.administrativo@redsaludcasanare.gov.co",
      passwordHash: examplePasswordHash,
      role: "STUDENT",
      status: "ACTIVE",
      personnelType: "ADMINISTRATIVO",
      position: "Auxiliar Administrativo",
      mustChangePassword: false,
    },
  });

  await prisma.user.upsert({
    where: { email: "estudiante.asistencial@redsaludcasanare.gov.co" },
    update: {},
    create: {
      fullName: "Julián Pérez",
      documentType: "CC",
      documentNumber: "1020304053",
      email: "estudiante.asistencial@redsaludcasanare.gov.co",
      passwordHash: examplePasswordHash,
      role: "STUDENT",
      status: "ACTIVE",
      personnelType: "ASISTENCIAL",
      position: "Auxiliar de Enfermería",
      mustChangePassword: false,
    },
  });
  console.log("Usuarios de ejemplo (administrativo y asistencial) listos.");

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

  await prisma.course.upsert({
    where: { slug: "induccion-procesos-administrativos" },
    update: {},
    create: {
      title: "Inducción a procesos administrativos",
      slug: "induccion-procesos-administrativos",
      shortDescription: "Procedimientos y herramientas del área administrativa de la institución.",
      courseType: "INDUCCION",
      durationHours: 4,
      status: "PUBLISHED",
      publishedAt: new Date(),
      tutorId: tutorAdministrativo.id,
      enrollmentMode: "OPEN",
      targetAudience: "ADMINISTRATIVO",
    },
  });

  await prisma.course.upsert({
    where: { slug: "bioseguridad-personal-asistencial" },
    update: {},
    create: {
      title: "Bioseguridad para personal asistencial",
      slug: "bioseguridad-personal-asistencial",
      shortDescription: "Protocolos de bioseguridad y manejo de pacientes para personal clínico y asistencial.",
      courseType: "OBLIGATORIO",
      durationHours: 8,
      status: "PUBLISHED",
      publishedAt: new Date(),
      tutorId: tutorAsistencial.id,
      enrollmentMode: "OPEN",
      targetAudience: "ASISTENCIAL",
    },
  });
  console.log("Cursos de ejemplo (uno por tipo de audiencia) listos.");

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
