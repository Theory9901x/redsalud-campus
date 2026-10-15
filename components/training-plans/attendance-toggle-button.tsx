import { Button } from "@/components/ui/button";
import { setAttendanceAction } from "@/app/admin/planes-capacitacion/actions";

export function AttendanceToggleButton({
  activityId,
  userId,
  attended,
  trimestre,
}: {
  activityId: string;
  userId: string;
  attended: boolean;
  trimestre?: number;
}) {
  return (
    <form
      action={async () => {
        "use server";
        await setAttendanceAction(activityId, userId, !attended, trimestre);
      }}
    >
      <Button type="submit" size="sm" variant={attended ? "outline" : "secondary"}>
        {attended ? "Quitar asistencia" : "Marcar asistencia"}
      </Button>
    </form>
  );
}
