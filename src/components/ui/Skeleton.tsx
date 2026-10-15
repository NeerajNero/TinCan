import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-surface-2", className)} aria-hidden />;
}

/** A few card-shaped placeholders for any list that's still loading. */
export function ListSkeleton({ rows = 3, tall }: { rows?: number; tall?: boolean }) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="card flex items-center gap-3 rounded-[24px] p-4">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className={cn("h-3 w-1/3", tall && "h-10 w-full")} />
          </div>
        </div>
      ))}
    </div>
  );
}
