import { FileEdit, CheckCircle2, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { publishCourseAction, archiveCourseAction, revertToDraftAction } from "@/app/admin/cursos/actions";
import type { CourseStatus } from "@prisma/client";

const STATUS_CONFIG: Record<
  CourseStatus,
  { icon: typeof FileEdit; iconClass: string; bgClass: string; message: string }
> = {
  DRAFT: {
    icon: FileEdit,
    iconClass: "text-muted-foreground",
    bgClass: "bg-muted/60",
    message: "Este curso está en borrador. No es visible en el catálogo público.",
  },
  PUBLISHED: {
    icon: CheckCircle2,
    iconClass: "text-success",
    bgClass: "bg-success/10",
    message: "Este curso está publicado y visible en el catálogo público.",
  },
  ARCHIVED: {
    icon: Archive,
    iconClass: "text-destructive",
    bgClass: "bg-destructive/10",
    message: "Este curso está archivado. No es visible en el catálogo público.",
  },
};

export function CoursePublishControls({ courseId, status }: { courseId: string; status: CourseStatus }) {
  const { icon: Icon, iconClass, bgClass, message } = STATUS_CONFIG[status];

  return (
    <div className={`flex items-center gap-3 rounded-2xl border border-border p-4 ${bgClass}`}>
      <Icon className={`h-5 w-5 shrink-0 ${iconClass}`} />
      <p className="flex-1 text-sm text-foreground">{message}</p>
      {status === "DRAFT" && (
        <form
          action={async () => {
            "use server";
            await publishCourseAction(courseId);
          }}
        >
          <Button type="submit">Publicar curso</Button>
        </form>
      )}
      {status === "PUBLISHED" && (
        <form
          action={async () => {
            "use server";
            await archiveCourseAction(courseId);
          }}
        >
          <Button type="submit" variant="destructive">
            Archivar curso
          </Button>
        </form>
      )}
      {status === "ARCHIVED" && (
        <form
          action={async () => {
            "use server";
            await revertToDraftAction(courseId);
          }}
        >
          <Button type="submit" variant="outline">
            Volver a borrador
          </Button>
        </form>
      )}
    </div>
  );
}
