import { Button } from "@/components/ui/button";
import { setAttendanceAction } from "@/app/admin/planes-capacitacion/actions";

export function AttendanceToggleButton({
  activityId,
  userId,
  attended,
}: {
  activityId: string;
  userId: string;
  attended: boolean;
}) {
  return (
    <form
      action={async () => {
        "use server";
        await setAttendanceAction(activityId, userId, !attended);
      }}
    >
      <Button type="submit" size="sm" variant={attended ? "outline" : "secondary"}>
        {attended ? "Quitar asistencia" : "Marcar asistencia"}
      </Button>
    </form>
  );
}
