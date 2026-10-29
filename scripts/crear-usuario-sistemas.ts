import "dotenv/config";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";

/** Crea la cuenta de área y su asignación; no reemplaza cuentas ni contraseñas existentes. */
async function main() {
  const password = `Rs!${randomBytes(9).toString("base64url")}`;
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findFirst({ where: { OR: [{ username: { equals: "sistemas", mode: "insensitive" } }, { documentNumber: "AREA-SISTEMAS" }] }, select: { id: true } });
    if (existing) throw new Error("La cuenta de Sistemas ya existe. No se modifica su contraseña.");
    const area = await tx.trainingArea.findFirst({ where: { name: { equals: "Sistemas", mode: "insensitive" } } });
    if (area?.tutorId) throw new Error("El área de Sistemas ya tiene responsable; revisa la asignación existente.");
    const admin = await tx.user.findFirstOrThrow({ where: { role: "ADMIN", status: "ACTIVE", canManageAllMeetings: true }, select: { id: true } });
    const user = await tx.user.create({ data: {
      fullName: "Sistemas", username: "sistemas", email: null,
      documentType: "CC", documentNumber: "AREA-SISTEMAS",
      department: "Sistemas", position: "Responsable del área de Sistemas",
      role: "TUTOR", status: "ACTIVE", personnelType: "ADMINISTRATIVO",
      tipoVinculacion: "OTRO", origenRegistro: "IMPORTACION",
      mustChangePassword: true, passwordHash, canManageAllMeetings: false,
      provisionedAt: new Date(), provisionedBy: admin.id,
    }, select: { id: true, username: true } });
    if (area) {
      await tx.trainingArea.update({ where: { id: area.id }, data: { tutorId: user.id, isActive: true } });
    } else {
      const last = await tx.trainingArea.aggregate({ _max: { sortOrder: true } });
      await tx.trainingArea.create({ data: { name: "Sistemas", tutorId: user.id, isActive: true, sortOrder: (last._max.sortOrder ?? 0) + 1 } });
    }
    await tx.auditLog.create({ data: {
      userId: admin.id, action: "CREATE", entity: "User", entityId: user.id,
      description: "Cuenta institucional del área de Sistemas creada por solicitud del administrador, rol tutor, cambio de contraseña obligatorio y área vinculada.",
    } });
    return user;
  });
  const saved = await prisma.user.findUniqueOrThrow({ where: { id: result.id }, select: { passwordHash: true, mustChangePassword: true, role: true, canManageAllMeetings: true, trainingAreasLed: { select: { name: true } } } });
  if (!(await bcrypt.compare(password, saved.passwordHash)) || !saved.mustChangePassword || saved.role !== "TUTOR" || saved.canManageAllMeetings || !saved.trainingAreasLed.some((a) => a.name.toLowerCase() === "sistemas")) throw new Error("No pasó la verificación de la cuenta creada.");
  console.log(JSON.stringify({ usuario: result.username, claveTemporal: password, area: "Sistemas", rol: saved.role, cambioObligatorio: saved.mustChangePassword }));
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
