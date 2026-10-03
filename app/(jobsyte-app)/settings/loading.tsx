import { BreadcrumbSetter } from "@/components/app-shell/breadcrumb-setter";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function LoadingCard({ titleWidth, children }: { titleWidth: string; children: React.ReactNode }) {
  return (
    <Card className="min-w-0 gap-4 p-5">
      <Skeleton className={`h-5 ${titleWidth}`} />
      {children}
    </Card>
  );
}

function Field({ width = "w-full" }: { width?: string }) {
  return (
    <div className="min-w-0 space-y-2">
      <Skeleton className="h-3 w-28" />
      <Skeleton className={`h-10 max-w-full ${width}`} />
    </div>
  );
}

export default function SettingsLoading() {
  return (
    <div role="status" aria-label="Loading settings" className="w-full min-w-0 space-y-4 pb-6">
      <BreadcrumbSetter crumbs={[{ label: "Settings", href: "/settings" }]} />
      <span className="sr-only">Loading settings…</span>

      <div className="space-y-2">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <LoadingCard titleWidth="w-36">
          <div className="space-y-3">
            {["w-56", "w-40", "w-44"].map((width, index) => (
              <div key={index} className="space-y-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className={`h-4 max-w-full ${width}`} />
              </div>
            ))}
          </div>
        </LoadingCard>
        <LoadingCard titleWidth="w-28">
          <Skeleton className="h-4 w-80 max-w-full" />
          <Skeleton className="h-9 w-28" />
        </LoadingCard>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <LoadingCard titleWidth="w-36">
          <div className="grid gap-4 md:grid-cols-2">
            <Field />
            <Field />
          </div>
          <Field />
          <Skeleton className="ml-auto h-9 w-28" />
        </LoadingCard>
        <LoadingCard titleWidth="w-40">
          <Skeleton className="h-4 w-72 max-w-full" />
          <Skeleton className="h-11 w-full" />
          <Field />
        </LoadingCard>
      </div>

      <div className="grid min-w-0 gap-4 2xl:grid-cols-2">
        <LoadingCard titleWidth="w-28">
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
          <Field width="w-48" />
          <Skeleton className="ml-auto h-9 w-36" />
        </LoadingCard>
        <LoadingCard titleWidth="w-24">
          <div className="grid min-w-0 gap-4 lg:grid-cols-2 2xl:grid-cols-1">
            <div className="space-y-3 rounded-md border p-4">
              <Skeleton className="h-4 w-28" />
              <Field />
              <Skeleton className="h-9 w-28" />
            </div>
            <div className="space-y-3 rounded-md border p-4">
              <Skeleton className="h-4 w-36" />
              <Field />
              <Field />
              <Skeleton className="h-9 w-36" />
            </div>
          </div>
        </LoadingCard>
      </div>

      <LoadingCard titleWidth="w-36">
        <Skeleton className="h-4 w-80 max-w-full" />
        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(13rem,0.8fr)_minmax(0,1.2fr)]">
          <div className="space-y-2">
            <Skeleton className="h-9 w-full" />
            {Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-10 w-full" />)}
          </div>
          <div className="space-y-3 rounded-md border p-3">
            <Field width="w-40" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
      </LoadingCard>

      <LoadingCard titleWidth="w-32">
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-9 w-44" />
        </div>
      </LoadingCard>
    </div>
  );
}
