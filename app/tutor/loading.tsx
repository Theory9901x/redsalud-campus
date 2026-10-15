import { Skeleton } from "@/components/ui/skeleton";

/**
 * Esqueleto del panel del tutor: la misma silueta del centro de mando
 * (héroe navy con cifras + paneles de consola), para que la carga no salte
 * de forma al pintar el contenido real.
 */
export default function TutorLoading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Cargando">
      <div className="hud-hero relative overflow-hidden rounded-[22px] p-6 sm:p-8">
        <Skeleton className="h-3 w-48 bg-white/10" />
        <Skeleton className="mt-4 h-8 w-80 max-w-full bg-white/10" />
        <Skeleton className="mt-3 h-4 w-[32rem] max-w-full bg-white/10" />
        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-[14px] bg-white/10" />
          ))}
        </div>
      </div>
      <Skeleton className="h-10 rounded-xl" />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Skeleton className="h-80 rounded-[18px] xl:col-span-7" />
        <Skeleton className="h-80 rounded-[18px] xl:col-span-5" />
      </div>
    </div>
  );
}
