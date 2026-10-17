import { prisma } from "../lib/prisma";
import { regenerateCertificatePdf } from "../lib/certificates";

/**
 * Regenera el PDF de las constancias de Inducción y reinducción ya emitidas,
 * con los datos vigentes del curso (p. ej. tras corregir la intensidad
 * horaria). El código, el QR y el estado de cada constancia no cambian.
 *
 *   npx tsx --env-file=.env scripts/regenerar-constancias-induccion.ts
 */
async function main() {
  const lista = await prisma.certificate.findMany({
    where: { course: { courseType: { in: ["INDUCCION", "REINDUCCION"] } } },
    select: { id: true, certificateCode: true, status: true, course: { select: { title: true, durationHours: true } } },
  });
  for (const c of lista) {
    await regenerateCertificatePdf(c.id);
    console.log(`regenerada ${c.certificateCode} (${c.status}) · ${c.course.title} · ${c.course.durationHours} h`);
  }
  console.log(`${lista.length} constancia(s) regenerada(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
