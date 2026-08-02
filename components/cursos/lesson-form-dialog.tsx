"use client";

import { Check, Paperclip } from "lucide-react";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RichTextEditor } from "@/components/cursos/rich-text-editor";
import { LESSON_CONTENT_TYPE_LABELS } from "@/components/cursos/labels";
import type { LessonContentType } from "@prisma/client";
import type { LessonFormState } from "@/app/admin/cursos/lesson-actions";
import { useAlTenerExito } from "@/lib/use-exito-accion";

const initialState: LessonFormState = { error: null };

type LessonDefaults = {
  title: string;
  description: string;
  contentType: LessonContentType;
  contentBody: string;
  videoUrl: string;
  externalUrl: string;
  isRequired: boolean;
  estimatedMinutes: number | null;
  fileUrl: string | null;
};

const EMPTY_DEFAULTS: LessonDefaults = {
  title: "",
  description: "",
  contentType: "TEXT",
  contentBody: "",
  videoUrl: "",
  externalUrl: "",
  isRequired: true,
  estimatedMinutes: null,
  fileUrl: null,
};

export function LessonFormDialog({
  mode,
  action,
  defaultValues,
  trigger,
}: {
  mode: "create" | "edit";
  action: (prevState: LessonFormState, formData: FormData) => Promise<LessonFormState>;
  defaultValues?: Partial<LessonDefaults>;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, initialState);
  const values = { ...EMPTY_DEFAULTS, ...defaultValues };
  const [contentType, setContentType] = useState<LessonContentType>(values.contentType);
  // Qué archivo se acaba de elegir: sin esto no hay forma de saber si el
  // clic en "examinar" surtió efecto hasta después de guardar.
  const [archivoElegido, setArchivoElegido] = useState<string | null>(null);

  // Cierra el diálogo cuando el envío acaba de terminar bien.
  useAlTenerExito(state, () => setOpen(false));

  const showText = contentType === "TEXT" || contentType === "MIXED";
  const showYoutube = contentType === "YOUTUBE" || contentType === "MIXED";
  const showFile = contentType === "PDF" || contentType === "IMAGE" || contentType === "MIXED";
  const showVideoFile = contentType === "VIDEO";
  const showLink = contentType === "LINK" || contentType === "MIXED";

  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Nueva lección" : "Editar lección"}</DialogTitle>
            <DialogDescription>Elige el tipo de contenido y completa los campos correspondientes.</DialogDescription>
          </DialogHeader>
          <form action={formAction} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="title">Título</Label>
              <Input id="title" name="title" required defaultValue={values.title} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Descripción breve</Label>
              <Textarea id="description" name="description" rows={2} defaultValue={values.description} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contentType">Tipo de contenido</Label>
              <select
                id="contentType"
                name="contentType"
                value={contentType}
                onChange={(e) => setContentType(e.target.value as LessonContentType)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                {Object.entries(LESSON_CONTENT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {showText && (
              <div className="space-y-1.5">
                <Label>Contenido de texto</Label>
                <RichTextEditor name="contentBody" defaultValue={values.contentBody} />
              </div>
            )}

            {showYoutube && (
              <div className="space-y-1.5">
                <Label htmlFor="videoUrl">URL de YouTube</Label>
                <Input
                  id="videoUrl"
                  name="videoUrl"
                  placeholder="https://www.youtube.com/watch?v=..."
                  defaultValue={values.videoUrl}
                />
              </div>
            )}

            {showFile && (
              <div className="space-y-1.5">
                <Label htmlFor="file">
                  {contentType === "IMAGE"
                    ? "Imagen"
                    : contentType === "MIXED"
                      ? "Archivo adjunto (PDF o imagen)"
                      : "Archivo PDF"}
                </Label>
                <Input
                  id="file"
                  name="file"
                  type="file"
                  accept={
                    contentType === "IMAGE"
                      ? "image/*"
                      : contentType === "MIXED"
                        ? "application/pdf,image/*"
                        : "application/pdf"
                  }
                  onChange={(e) => setArchivoElegido(e.target.files?.[0]?.name ?? null)}
                />
                <EstadoArchivo elegido={archivoElegido} yaHay={Boolean(values.fileUrl)} />
              </div>
            )}

            {showVideoFile && (
              <div className="space-y-1.5">
                <Label htmlFor="file">Archivo de video</Label>
                <Input
                  id="file"
                  name="file"
                  type="file"
                  accept="video/mp4,video/webm,video/ogg"
                  onChange={(e) => setArchivoElegido(e.target.files?.[0]?.name ?? null)}
                />
                <p className="text-xs text-muted-foreground">Formatos MP4, WebM u Ogg, hasta 200 MB.</p>
                <EstadoArchivo elegido={archivoElegido} yaHay={Boolean(values.fileUrl)} />
              </div>
            )}

            {showLink && (
              <div className="space-y-1.5">
                <Label htmlFor="externalUrl">Enlace externo</Label>
                <Input id="externalUrl" name="externalUrl" placeholder="https://..." defaultValue={values.externalUrl} />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="estimatedMinutes">Minutos estimados</Label>
                <Input
                  id="estimatedMinutes"
                  name="estimatedMinutes"
                  type="number"
                  min={0}
                  defaultValue={values.estimatedMinutes ?? ""}
                />
              </div>
              <div className="flex items-end gap-3 pb-1.5">
                <Switch id="isRequired" name="isRequired" defaultChecked={values.isRequired} />
                <Label htmlFor="isRequired" className="font-normal">
                  Obligatoria
                </Label>
              </div>
            </div>

            {state.error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
            )}

            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "Guardando..." : "Guardar lección"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Dice si la lección ya tiene archivo y cuál se va a subir.
 *
 * Antes el campo solo avisaba "ya hay un archivo cargado", sin nombre y sin
 * confirmar la selección: no se distinguía haber elegido un archivo de no
 * haberlo elegido, y por tanto tampoco se notaba cuando la subida se perdía.
 */
function EstadoArchivo({ elegido, yaHay }: { elegido: string | null; yaHay: boolean }) {
  if (elegido) {
    return (
      <p className="flex items-center gap-1.5 text-xs font-medium text-success">
        <Check className="h-3.5 w-3.5" />
        Se subirá «{elegido}» al guardar.
      </p>
    );
  }
  if (yaHay) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Paperclip className="h-3.5 w-3.5" />
        Ya hay un archivo cargado. Elige uno nuevo solo si quieres reemplazarlo.
      </p>
    );
  }
  return <p className="text-xs text-muted-foreground">Todavía no has adjuntado ningún archivo.</p>;
}
