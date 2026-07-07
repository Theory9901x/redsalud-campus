import { Badge } from "@/components/ui/badge";
import type { Role } from "@prisma/client";

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrador",
  TUTOR: "Tutor",
  STUDENT: "Estudiante",
};

const ROLE_CLASSES: Record<Role, string> = {
  ADMIN: "bg-navy text-white",
  TUTOR: "bg-primary/10 text-primary",
  STUDENT: "bg-secondary text-secondary-foreground",
};

export function RoleBadge({ role }: { role: Role }) {
  return <Badge className={ROLE_CLASSES[role]}>{ROLE_LABELS[role]}</Badge>;
}
