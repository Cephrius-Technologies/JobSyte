"use client";

import { useTransition, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toggleJobComplete } from "@/app/(jobsyte-app)/projects/[id]/actions";
import { markProjectJobPaid } from "@/components/projects/actions";

function formatPrice(cents: number | null): string {
  if (cents === null) return "0";
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export type QuickJobItem = {
  id: string;
  title: string;
  is_completed: boolean;
  scheduled_completion: string | null;
  price_cents: number | null;
  is_invoiced: boolean;
  is_paid: boolean;
};

function QuickJobStateBadges({ job }: { job: QuickJobItem }) {
  return (
    <>
      {/* Completion and billing are independent enough to show together. */}
      {job.is_completed && (
        <span className="shrink-0 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-950 dark:text-green-400">
          Completed
        </span>
      )}
      {job.is_invoiced && (
        <span className="shrink-0 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-950 dark:text-violet-400">
          Invoiced
        </span>
      )}
      {job.is_paid && (
        <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
          Paid
        </span>
      )}
    </>
  );
}

export function QuickJobDrawer({
  jobs,
  open: controlledOpen,
  onOpenChange,
}: {
  jobs: QuickJobItem[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [internalOpen, setInternalOpen] = useState(false);
  const [optimisticJobs, setOptimisticJobs] = useState<QuickJobItem[]>(jobs);

  // Sync optimisticJobs when jobs prop changes
  useEffect(() => {
    setOptimisticJobs(jobs);
  }, [jobs]);

  // Use controlled open if provided, otherwise use internal state
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;

  const handleOpenChange = (newOpen: boolean) => {
    setInternalOpen(newOpen);
    onOpenChange?.(newOpen);
  };

  const completedCount = optimisticJobs.filter((j) => j.is_completed).length;
  const incompleteJobs = optimisticJobs.filter((j) => !j.is_completed);

  const handleMarkComplete = (jobId: string) => {
    setOptimisticJobs(prev =>
      prev.map(j => j.id === jobId ? { ...j, is_completed: true } : j)
    );
    
    startTransition(async () => {
      const result = await toggleJobComplete(jobId, true);
      if (!result?.ok) {
        setOptimisticJobs(jobs);
        toast.error(result?.message ?? "Failed to update job.");
        return;
      }
      toast.success("Job marked as complete.");
      router.refresh();
    });
  };

  const handleMarkIncomplete = (jobId: string) => {
    setOptimisticJobs(prev =>
      prev.map(j => j.id === jobId ? { ...j, is_completed: false } : j)
    );
    
    startTransition(async () => {
      const result = await toggleJobComplete(jobId, false);
      if (!result?.ok) {
        setOptimisticJobs(jobs);
        toast.error(result?.message ?? "Failed to update job.");
        return;
      }
      toast.success("Job marked as incomplete.");
      router.refresh();
    });
  };

  const handleSetPaid = (job: QuickJobItem, nextPaid: boolean) => {
    setOptimisticJobs((prev) =>
      prev.map((item) =>
        item.id === job.id ? { ...item, is_paid: nextPaid } : item,
      ),
    );

    startTransition(async () => {
      const result = await markProjectJobPaid(job.id, nextPaid);
      if (!result?.ok) {
        setOptimisticJobs(jobs);
        toast.error(result?.message ?? "Failed to update payment status.");
        return;
      }

      toast.success(
        job.is_invoiced
          ? "Job and invoice payment status updated."
          : nextPaid
            ? "Job marked as paid."
            : "Job marked as unpaid.",
      );
      router.refresh();
    });
  };

  if (jobs.length === 0) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Project Jobs</DialogTitle>
          <DialogDescription>
            {completedCount} of {jobs.length} jobs completed
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="h-2 overflow-hidden rounded-full bg-primary/10">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${(completedCount / jobs.length) * 100}%` }}
            />
          </div>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {incompleteJobs.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                  Incomplete
                </div>
                <div className="space-y-2">
                  {incompleteJobs.map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-border bg-primary/2 p-3 text-sm hover:bg-muted/50"
                    >
                      <div className="min-w-0 flex-1">
                        {/* Title gets its own row so it isn't squeezed out by the status badges. */}
                        <div className="truncate font-medium">{job.title}</div>
                        {/* Badges wrap to a new line if they don't fit; never overlap the title. */}
                        <div className="mt-0.5 flex flex-wrap items-center gap-1">
                          <QuickJobStateBadges job={job} />
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1 mt-1">
                          <div className="flex justify-between gap-2">
                            <span>Price:</span>
                            <span>{formatPrice(job.price_cents)}</span>
                          </div>
                          {job.scheduled_completion && (
                            <div className="flex justify-between gap-2">
                              <span>Due:</span>
                              <span>{job.scheduled_completion}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 cursor-pointer p-0 hover:bg-green-100 hover:text-green-700 dark:hover:bg-green-950 dark:hover:text-green-400"
                        disabled={isPending || job.is_paid || job.is_invoiced}
                        title={job.is_paid ? "Paid — manage from Invoices" : job.is_invoiced ? "Invoiced — manage from Invoices" : "Mark as complete"}
                        onClick={() => handleMarkComplete(job.id)}
                      >
                        <CheckCircle2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {optimisticJobs.filter((j) => j.is_completed).length > 0 && (
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                  Completed
                </div>
                <div className="space-y-2">
                  {optimisticJobs
                    .filter((j) => j.is_completed)
                    .map((job) => (
                      <div
                        key={job.id}
                        className="flex items-center justify-between gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm dark:border-green-900 dark:bg-green-950/20"
                      >
                        <div className="min-w-0 flex-1">
                          {/* Title gets its own row so it isn't squeezed out by the status badges. */}
                          <div className="truncate font-medium line-through text-muted-foreground">
                            {job.title}
                          </div>
                          {/* Badges wrap to a new line if they don't fit; never overlap the title. */}
                          <div className="mt-0.5 flex flex-wrap items-center gap-1">
                            <QuickJobStateBadges job={job} />
                          </div>
                          <div className="text-xs text-muted-foreground space-y-1 mt-1">
                            <div className="flex justify-between gap-2">
                              <span>Price:</span>
                              <span>{formatPrice(job.price_cents)}</span>
                            </div>
                            {job.scheduled_completion && (
                              <div className="flex justify-between gap-2">
                                <span>Due:</span>
                                <span>{job.scheduled_completion}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 cursor-pointer p-0 hover:bg-emerald-100 hover:text-emerald-700 dark:hover:bg-emerald-950 dark:hover:text-emerald-400"
                            disabled={isPending}
                            title={
                              job.is_paid
                                ? "Mark as unpaid"
                                : job.is_invoiced
                                  ? "Mark paid and update invoice"
                                  : "Mark as paid"
                            }
                            onClick={() => handleSetPaid(job, !job.is_paid)}
                          >
                            <DollarSign className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 cursor-pointer p-0 hover:bg-amber-100 hover:text-amber-700 dark:hover:bg-amber-950 dark:hover:text-amber-400"
                            disabled={isPending || job.is_paid || job.is_invoiced}
                            title={job.is_paid ? "Paid — manage from Invoices" : job.is_invoiced ? "Invoiced — manage from Invoices" : "Mark as incomplete"}
                            onClick={() => handleMarkIncomplete(job.id)}
                          >
                            <CheckCircle2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 pt-4">
          <DialogClose asChild>
            <Button type="button" variant="outline" className="flex-1 cursor-pointer">
              Close
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
