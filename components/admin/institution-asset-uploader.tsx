"use client";

import { useActionState } from "react";
import Image from "next/image";
import { ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AssetUploadState } from "@/app/admin/configuracion/actions";

const initialState: AssetUploadState = { error: null };

export function InstitutionAssetUploader({
  action,
  fieldName,
  label,
  description,
  imageUrl,
}: {
  action: (prevState: AssetUploadState, formData: FormData) => Promise<AssetUploadState>;
  fieldName: string;
  label: string;
  description: string;
  imageUrl: string | null;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="surface p-4">
      <div className="flex items-center gap-4">
        <div className="flex h-20 w-36 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
          {imageUrl ? (
            <Image src={imageUrl} alt={label} width={288} height={160} className="h-full w-full object-contain" />
          ) : (
            <ImagePlus className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 space-y-2">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
          <input
            type="file"
            name={fieldName}
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
