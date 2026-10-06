import { Skeleton } from "@/components/ui/skeleton";

export default function ProjectDetailLoading() {
  return (
    <div role="status" aria-label="Loading project">
      <span className="sr-only">Loading project…</span>
      <div aria-hidden="true" className="flex flex-col gap-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row">
          <div className="space-y-2"><Skeleton className="h-8 w-64 max-w-full" /><Skeleton className="h-4 w-72 max-w-full" /></div>
          <div className="flex gap-2"><Skeleton className="h-10 w-32" /><Skeleton className="h-10 w-24" /></div>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="space-y-2 rounded-xl border bg-card p-4 sm:p-5">
              <Skeleton className="h-5 w-3/4" /><Skeleton className="h-8 w-1/2" /><Skeleton className="h-4 w-2/3" />
            </div>
          ))}
        </div>
        <div className="order-2 grid gap-4 lg:order-none lg:grid-cols-2">
          {Array.from({ length: 2 }, (_, index) => (
            <div key={index} className="space-y-4 rounded-xl border bg-card p-4 sm:p-5">
              <Skeleton className="h-5 w-28" />
              <div className="grid grid-cols-2 gap-4">
                {[0, 1].map((column) => <div key={column} className="space-y-1"><Skeleton className="h-4 w-20" /><Skeleton className="h-7 w-24" /></div>)}
              </div>
              <div className="space-y-2 border-t pt-3"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></div>
            </div>
          ))}
        </div>
        <div className="order-1 grid gap-4 lg:order-none lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)] lg:items-start">
          <div className="space-y-4 rounded-xl border bg-card p-4 sm:p-5">
            <Skeleton className="h-5 w-24" /><Skeleton className="h-4 w-3/4" />
            <div className="flex justify-between"><Skeleton className="h-10 w-24" /><Skeleton className="h-10 w-28" /></div>
            {[0, 1, 2].map((row) => <Skeleton key={row} className="h-14 w-full" />)}
          </div>
          <div className="space-y-4 rounded-xl border bg-card p-4">
            <Skeleton className="h-5 w-40" /><Skeleton className="aspect-[4/3] w-full" /><Skeleton className="h-8 w-24" />
          </div>
        </div>
      </div>
    </div>
  );
}
