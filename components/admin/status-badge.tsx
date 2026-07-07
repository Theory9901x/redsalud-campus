import { Badge } from "@/components/ui/badge";
import type { UserStatus } from "@prisma/client";

const STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
  BLOCKED: "Bloqueado",
};

const STATUS_CLASSES: Record<UserStatus, string> = {
  ACTIVE: "bg-success/10 text-success",
  INACTIVE: "bg-muted text-muted-foreground",
  BLOCKED: "bg-destructive/10 text-destructive",
};

export function StatusBadge({ status }: { status: UserStatus }) {
  return <Badge className={STATUS_CLASSES[status]}>{STATUS_LABELS[status]}</Badge>;
}
