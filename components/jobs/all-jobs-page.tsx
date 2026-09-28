"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, DollarSign, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { toggleJobComplete } from "@/app/(jobsyte-app)/projects/[id]/actions";
import { EditJobDialog } from "@/components/jobs/edit-job-dialog";
import { DeleteJobDialog } from "@/components/jobs/delete-job-dialog";
import { JobStatusBadges } from "@/components/jobs/job-status-badges";
import { getLocalDateKey } from "@/components/jobs/job-status";
import { markProjectJobPaid } from "@/components/projects/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatJobDisplayId } from "@/lib/jobs/job-id";
import { JOBS_PAGE_SIZE, type CompanyJob } from "@/lib/jobs/company-jobs";

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function AllJobsPage({ jobs, total, page }: { jobs: CompanyJob[]; total: number; page: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingJob, setEditingJob] = useState<CompanyJob | null>(null);
  const [deleteJobId, setDeleteJobId] = useState<string | null>(null);
  const today = getLocalDateKey(new Date());
  const pageCount = Math.max(1, Math.ceil(total / JOBS_PAGE_SIZE));

  function changeCompletion(job: CompanyJob) {
    startTransition(async () => {
      const result = await toggleJobComplete(job.id, !job.is_completed);
      if (!result.ok) {
        toast.error(result.message ?? "Could not update job.");
        return;
      }
      router.refresh();
    });
  }

  function changePaid(job: CompanyJob) {
    startTransition(async () => {
      const result = await markProjectJobPaid(job.id, !job.is_paid);
      if (!result.ok) {
        toast.error(result.message ?? "Could not update payment status.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
          <p className="text-sm text-muted-foreground">
            {total} job{total === 1 ? "" : "s"} across your active company&apos;s projects.
          </p>
        </div>
        {pageCount > 1 && (
          <nav aria-label="Jobs pages" className="flex items-center gap-2 text-sm">
            <span className="mr-1 whitespace-nowrap text-muted-foreground">Page {page} of {pageCount}</span>
            {page > 1 ? (
              <Button asChild variant="outline" size="icon-sm">
                <Link href={`/jobs?page=${page - 1}`} aria-label="Previous page" scroll={false}>
                  <ChevronLeft className="size-4" />
                </Link>
              </Button>
            ) : (
              <Button type="button" variant="outline" size="icon-sm" aria-label="Previous page" disabled>
                <ChevronLeft className="size-4" />
              </Button>
            )}
            {page < pageCount ? (
              <Button asChild variant="outline" size="icon-sm">
                <Link href={`/jobs?page=${page + 1}`} aria-label="Next page" scroll={false}>
                  <ChevronRight className="size-4" />
                </Link>
              </Button>
            ) : (
              <Button type="button" variant="outline" size="icon-sm" aria-label="Next page" disabled>
                <ChevronRight className="size-4" />
              </Button>
            )}
          </nav>
        )}
      </div>

      {jobs.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="font-medium">No jobs to show</p>
          <p className="text-sm text-muted-foreground">
            Add jobs from a project, or return to the first page if this page is empty.
          </p>
          <Button asChild variant="outline" className="mx-auto mt-2">
            <Link href="/projects">View projects</Link>
          </Button>
        </Card>
      ) : (
        <div className="min-w-0 overflow-hidden rounded-lg border">
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow className="bg-muted/20 hover:bg-muted/20">
                <TableHead className="h-11">Job ID</TableHead>
                <TableHead>Job</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead>Scheduled start</TableHead>
                <TableHead>Scheduled completion</TableHead>
                <TableHead>Superintendent / GC</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground" title={job.id}>
                    {formatJobDisplayId(job.id)}
                  </TableCell>
                  <TableCell className="max-w-56 truncate font-medium" title={job.title}>{job.title}</TableCell>
                  <TableCell className="max-w-52 truncate">
                    {job.project_address ? (
                      <Link href={`/projects/${job.project_id}`} className="text-primary underline-offset-4 hover:underline">
                        {job.project_address}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Project unavailable</span>
                    )}
                  </TableCell>
                  <TableCell><JobStatusBadges job={job} today={today} /></TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(job.price_cents)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(job.scheduled_start)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(job.scheduled_completion)}</TableCell>
                  <TableCell className="max-w-44 truncate text-muted-foreground" title={job.superintendent ?? undefined}>
                    {job.superintendent || "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button type="button" variant="outline" size="sm" aria-label={`Edit ${job.title}`} onClick={() => setEditingJob(job)}>
                        <Pencil className="size-4" />
                        Edit
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" variant="outline" size="icon-sm" aria-label={`Actions for ${job.title}`} disabled={isPending}>
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => changeCompletion(job)} disabled={job.is_paid || job.is_invoiced || isPending}>
                            <CheckCircle2 className="size-4" />
                            {job.is_completed ? "Unmark Completed" : "Mark Completed"}
                          </DropdownMenuItem>
                          {job.is_completed && (
                            <DropdownMenuItem onSelect={() => changePaid(job)} disabled={isPending}>
                              <DollarSign className="size-4" />
                              {job.is_paid ? "Unmark Paid" : "Mark Paid"}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem variant="destructive" onSelect={() => setDeleteJobId(job.id)} disabled={isPending}>
                            <Trash2 className="size-4" />
                            Delete Job
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {editingJob && (
        <EditJobDialog
          job={editingJob}
          projectId={editingJob.project_id}
          open
          onOpenChange={(open) => { if (!open) setEditingJob(null); }}
        />
      )}
      {deleteJobId && (
        <DeleteJobDialog
          jobId={deleteJobId}
          open
          onOpenChange={(open) => { if (!open) setDeleteJobId(null); }}
        />
      )}
    </div>
  );
}
