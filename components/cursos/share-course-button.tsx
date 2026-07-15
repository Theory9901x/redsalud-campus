"use client";

import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ShareCourseButton({ title }: { title: string }) {
  async function handleShare() {
    const url = window.location.href;
    const shareData = { title, text: `Mira este curso: ${title}`, url };
    if (navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
      } catch {
        // El usuario canceló el diálogo nativo: no es un error real.
      }
      return;
    }
    await navigator.clipboard.writeText(url);
    toast.success("Enlace del curso copiado al portapapeles.");
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className={cn(
        buttonVariants({ variant: "outline", size: "sm" }),
        "shrink-0 gap-1.5 border-white/20 bg-white/5 text-white hover:bg-white/10"
      )}
    >
      <Share2 className="h-3.5 w-3.5" />
      Compartir
    </button>
  );
}
