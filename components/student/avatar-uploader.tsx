"use client";

import { useActionState, useRef, useState } from "react";
import Image from "next/image";
import { Upload, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadAvatarAction, type AvatarUploadState } from "@/app/(estudiante)/perfil/actions";

const initialState: AvatarUploadState = { error: null };

export function AvatarUploader({ avatarUrl }: { avatarUrl: string | null }) {
  const [state, formAction, pending] = useActionState(uploadAvatarAction, initialState);
  const inputRef = useRef<HTMLInputElement>(null);
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);

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
        {/*
         * Input de archivo oculto disparado por un botón propio: el control
         * nativo ("Choose File · No file chosen") no acata los tokens del tema
         * y quedaba como un parche gris en la pasada de diseño. El nombre del
         * archivo elegido se muestra aparte, con el estilo de la interfaz.
         */}
        <input
          ref={inputRef}
          type="file"
          name="avatar"
          accept="image/*"
          className="sr-only"
          onChange={(e) => setNombreArchivo(e.target.files?.[0]?.name ?? null)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
            <Upload className="h-4 w-4" />
            Elegir imagen
          </Button>
          {nombreArchivo && (
            <span className="max-w-[180px] truncate text-xs text-muted-foreground" title={nombreArchivo}>
              {nombreArchivo}
            </span>
          )}
        </div>
        <Button type="submit" size="sm" disabled={pending || !nombreArchivo}>
          {pending ? "Subiendo..." : "Guardar foto"}
        </Button>
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      </div>
    </form>
  );
}
