import { Power, PowerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleUserStatusAction } from "@/app/admin/usuarios/actions";
import type { UserStatus } from "@prisma/client";

export function ToggleStatusButton({ userId, status }: { userId: string; status: UserStatus }) {
  const isActive = status === "ACTIVE";

  return (
    <form
      action={async () => {
        "use server";
        await toggleUserStatusAction(userId);
      }}
    >
      <Button
        type="submit"
        size="icon-sm"
        variant={isActive ? "destructive" : "default"}
        title={isActive ? "Desactivar usuario" : "Activar usuario"}
        aria-label={isActive ? "Desactivar usuario" : "Activar usuario"}
      >
        {isActive ? <PowerOff /> : <Power />}
      </Button>
    </form>
  );
}
