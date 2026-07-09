"use client";

import { useActionState } from "react";
import Image from "next/image";
import { User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadAvatarAction, type AvatarUploadState } from "@/app/(estudiante)/perfil/actions";

const initialState: AvatarUploadState = { error: null };

export function AvatarUploader({ avatarUrl }: { avatarUrl: string | null }) {
  const [state, formAction, pending] = useActionState(uploadAvatarAction, initialState);

  return (
    <form action={formAction} className="flex items-center gap-4">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted ring-2 ring-border">
        {avatarUrl ? (
          // unoptimized: avatarUrl es una ruta privada (/api/media/[id]) protegida por sesión;
          // el optimizador de next/image la pide desde el servidor sin cookies y recibe 401.
          <Image
            src={avatarUrl}
            alt="Foto de perfil"
            width={64}
            height={64}
            unoptimized
            className="h-full w-full object-cover"
          />
        ) : (
          <User className="h-7 w-7 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 space-y-2">
        <input
          type="file"
          name="avatar"
          accept="image/*"
          className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-secondary-foreground"
        />
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? "Subiendo..." : "Cambiar foto"}
        </Button>
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      </div>
    </form>
  );
}
