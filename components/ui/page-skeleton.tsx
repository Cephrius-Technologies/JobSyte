import { Skeleton } from "@/components/ui/skeleton";

export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading page" className="space-y-8">
      <span className="sr-only">Loading page…</span>
      <div className="space-y-3">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="rounded-xl border bg-card p-5">
        <Skeleton className="mb-6 h-5 w-32" />
        <div className="space-y-5">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
