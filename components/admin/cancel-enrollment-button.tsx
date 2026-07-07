import { Button } from "@/components/ui/button";
import { cancelEnrollmentAction, reactivateEnrollmentAction } from "@/app/admin/inscripciones/actions";
import type { EnrollmentStatus } from "@prisma/client";

export function CancelEnrollmentButton({
  enrollmentId,
  status,
}: {
  enrollmentId: string;
  status: EnrollmentStatus;
}) {
  if (status === "CANCELLED") {
    return (
      <form
        action={async () => {
          "use server";
          await reactivateEnrollmentAction(enrollmentId);
        }}
      >
        <Button type="submit" size="sm" variant="outline">
          Reactivar
        </Button>
      </form>
    );
  }

  return (
    <form
      action={async () => {
        "use server";
        await cancelEnrollmentAction(enrollmentId);
      }}
    >
      <Button type="submit" size="sm" variant="destructive">
        Cancelar
      </Button>
    </form>
  );
}
