import { Skeleton } from "@/components/ui/skeleton";

export default function AulaLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3.5 sm:px-6">
        <Skeleton className="h-4 w-20" />
        <div className="ml-auto flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>
      <div className="flex flex-1 flex-col lg:flex-row">
        <div className="w-full shrink-0 border-r border-border bg-card p-4 lg:w-80">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="mt-3 h-1.5 w-full" />
          <div className="mt-6 space-y-2">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
        <div className="flex-1 px-4 py-8 sm:px-8">
          <div className="mx-auto max-w-3xl space-y-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
