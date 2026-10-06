import { PageHeader } from "@/components/ui/page-header";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ProjectsLoadingView } from "@/components/projects/projects-loading-view";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function GroupedProjectsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="overflow-hidden rounded-xl border bg-card py-6">
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              {index === 0 ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
              <Skeleton className="h-6 w-40 max-w-full" />
            </div>
            <Skeleton className="h-4 w-36" />
          </div>
          {index === 0 && (
            <div className="space-y-3 border-t p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 p-3">
                <div className="flex items-center gap-2"><ChevronDown className="size-4 text-muted-foreground" /><Skeleton className="h-5 w-32" /></div>
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="space-y-2 pl-2 sm:pl-5">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                  <div className="flex items-center gap-2"><ChevronDown className="size-4 text-muted-foreground" /><Skeleton className="h-5 w-28" /></div>
                  <Skeleton className="h-4 w-20" />
                </div>
                <div className="space-y-2 pl-2 sm:pl-4">
                  {Array.from({ length: 2 }, (_, row) => (
                    <div key={row} className="space-y-3 rounded-xl border p-4">
                      <div className="flex flex-wrap justify-between gap-3"><Skeleton className="h-5 w-36 max-w-full" /><Skeleton className="h-8 w-16" /></div>
                      <Skeleton className="h-4 w-3/4" />
                      <div className="flex gap-2"><Skeleton className="h-5 w-16" /><Skeleton className="h-5 w-20" /></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function ProjectsLoading() {
  return (
    <div role="status" aria-label="Loading projects">
      <span className="sr-only">Loading projects…</span>
      <div aria-hidden="true" className="space-y-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <PageHeader
            title="Projects"
            description="Manage your active and completed construction projects."
          />
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex items-center justify-between gap-2 sm:justify-start">
              <Skeleton className="h-11 w-24 sm:h-8" />
              <Skeleton className="h-11 w-20 sm:h-8" />
            </div>
            <Skeleton className="h-11 w-full sm:h-10 sm:w-32" />
            <Skeleton className="h-11 w-full sm:h-10 sm:w-36" />
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0">
            <ProjectsLoadingView grouped={<GroupedProjectsSkeleton />}>
            <div className="divide-y rounded-xl border bg-card lg:hidden">
              {Array.from({ length: 5 }, (_, index) => (
                <div key={index} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Skeleton className="my-1 h-6 w-3/5" />
                    <Skeleton className="h-11 w-11 shrink-0 sm:h-8" />
                  </div>
                  <Skeleton className="h-5 w-4/5" />
                  <div className="flex flex-wrap justify-between gap-2">
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-hidden rounded-xl border bg-card lg:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project Address</TableHead>
                    <TableHead>Subdivision / Builder</TableHead>
                    <TableHead>Job Progress</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }, (_, index) => (
                    <TableRow key={index}>
                      <TableCell><Skeleton className="h-5 w-40" /><Skeleton className="mt-1 h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-28" /><Skeleton className="mt-1 h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="ml-auto h-8 w-24" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            </ProjectsLoadingView>
          </div>

          <div className="hidden h-fit space-y-6 rounded-xl border bg-card p-5 xl:block">
            <div className="space-y-3"><Skeleton className="h-4 w-28" /><Skeleton className="h-6 w-4/5" /></div>
            <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/30 p-4">
              <div className="space-y-2"><Skeleton className="h-4 w-16" /><Skeleton className="h-6 w-12" /></div>
              <div className="space-y-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-6 w-12" /></div>
            </div>
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="space-y-3 border-t pt-4">
                <Skeleton className="h-4 w-24" /><Skeleton className="h-5 w-full" /><Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
