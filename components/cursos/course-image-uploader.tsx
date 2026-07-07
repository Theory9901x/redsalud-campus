"use client";

import { useActionState } from "react";
import Image from "next/image";
import { ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadCourseImageAction, type ImageUploadState } from "@/app/admin/cursos/actions";

const initialState: ImageUploadState = { error: null };

export function CourseImageUploader({
  courseId,
  basePath,
  imageUrl,
}: {
  courseId: string;
  basePath: string;
  imageUrl: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    uploadCourseImageAction.bind(null, courseId, basePath),
    initialState
  );

  return (
    <form action={formAction} className="surface p-4">
      <div className="flex items-center gap-4">
        <div className="flex h-28 w-48 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt="Imagen del curso"
              width={384}
              height={216}
              className="h-full w-full object-contain"
            />
          ) : (
            <ImagePlus className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 space-y-2">
          <p className="text-sm font-medium text-foreground">Imagen destacada</p>
          <p className="text-xs text-muted-foreground">
            Se ve en el catálogo público. Recomendado 16:9, hasta 15 MB (JPG o PNG).
          </p>
          <input
            type="file"
            name="image"
            accept="image/*"
            className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-secondary-foreground"
          />
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            {pending ? "Subiendo..." : "Subir imagen"}
          </Button>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        </div>
      </div>
    </form>
  );
}
