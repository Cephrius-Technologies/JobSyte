"use client";

import { useTransition, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, DollarSign, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
      {/* Job completion and billing are additive states; do not hide one with another. */}
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

export function QuickJobComplete({
  jobs,
}: {
  jobs: QuickJobItem[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [maxHeight, setMaxHeight] = useState<number | null>(null);
  const [optimisticJobs, setOptimisticJobs] = useState<QuickJobItem[]>(jobs);

  // Update optimistic jobs when prop changes
  useEffect(() => {
    setOptimisticJobs(jobs);
  }, [jobs]);

  useEffect(() => {
    const handleResize = () => {
      // Each job item is approximately 56px (with padding and borders)
      // Show roughly 10 jobs before requiring scroll
      const itemHeight = 56;
      const maxJobs = 10;
      const maxAllowedHeight = itemHeight * maxJobs; // 560px
      
      setMaxHeight(maxAllowedHeight);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (jobs.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border p-4 text-center">
        <p className="text-sm text-muted-foreground">No jobs yet</p>
      </div>
    );
  }

  const completedCount = optimisticJobs.filter((j) => j.is_completed).length;
  const incompleteJobs = optimisticJobs.filter((j) => !j.is_completed);

  function setPaid(job: QuickJobItem, nextPaid: boolean) {
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
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-muted-foreground">
          {completedCount} of {optimisticJobs.length} jobs completed
        </div>
        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-primary/10">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${(completedCount / optimisticJobs.length) * 100}%` }}
          />
        </div>
      </div>

      <div
        className="space-y-1.5 overflow-y-auto pr-2"
        style={{ maxHeight: maxHeight ? `${maxHeight}px` : "560px" }}
      >
        {incompleteJobs.length > 0 && (
          <div className="text-xs font-semibold text-muted-foreground uppercase sticky top-0 bg-card backdrop-blur supports-backdrop-filter:bg-card py-1 z-10">
            Incomplete
          </div>
        )}
        {incompleteJobs.map((job) => (
          <div
            key={job.id}
            className="flex items-center justify-between gap-2 rounded-md border border-border bg-primary/2 p-2 text-sm hover:bg-muted/50"
          >
            <div className="min-w-0 flex-1">
              {/* Title gets its own row so it isn't squeezed out by the status badges. */}
              <div className="truncate font-medium">{job.title}</div>
              {/* Badges wrap to a new line if they don't fit; never overlap the title. */}
              <div className="mt-0.5 flex flex-wrap items-center gap-1">
                <QuickJobStateBadges job={job} />
              </div>
              <div className="text-xs text-muted-foreground space-y-0.5">
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
                className="h-7 w-7 cursor-pointer p-0 hover:bg-green-100 hover:text-green-700 dark:hover:bg-green-950 dark:hover:text-green-400"
                disabled={isPending || job.is_paid || job.is_invoiced}
                title={job.is_paid ? "Paid — manage from Invoices" : job.is_invoiced ? "Invoiced — manage from Invoices" : "Mark as complete"}
                onClick={() => {
                  // Optimistic update
                  setOptimisticJobs(prev =>
                    prev.map(j => j.id === job.id ? { ...j, is_completed: true } : j)
                  );
                  
                  startTransition(async () => {
                    const result = await toggleJobComplete(job.id, true);
                    if (!result?.ok) {
                      // Revert on error
                      setOptimisticJobs(jobs);
                      toast.error(result?.message ?? "Failed to update job.");
                      return;
                    }
                    toast.success("Job marked as complete.");
                    router.refresh();
                  });
                }}
              >
                <CheckCircle2 className="size-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 cursor-pointer p-0"
                    disabled={isPending}
                    aria-label={`Actions for ${job.title}`}
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem
                    className="cursor-pointer text-xs"
                    disabled={isPending || job.is_paid || job.is_invoiced}
                    onSelect={() => {
                      // Optimistic update
                      setOptimisticJobs(prev =>
                        prev.map(j => j.id === job.id ? { ...j, is_completed: true } : j)
                      );
                      
                      startTransition(async () => {
                        const result = await toggleJobComplete(job.id, true);
                        if (!result?.ok) {
                          // Revert on error
                          setOptimisticJobs(jobs);
                          toast.error(result?.message ?? "Failed to update job.");
                          return;
                        }
                        toast.success("Job marked as complete.");
                        router.refresh();
                      });
                    }}
                  >
                    <CheckCircle2 className="size-4" />
                    Mark Complete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}

        {jobs.filter((j) => j.is_completed).length > 0 && (
          <>
            <div className="text-xs font-semibold text-muted-foreground uppercase sticky top-0 bg-card/80 backdrop-blur supports-backdrop-filter:bg-card/60 py-1 z-10 mt-1.5">
              Completed
            </div>
            {optimisticJobs
              .filter((j) => j.is_completed)
              .map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-green-200 bg-green-50 p-2 text-sm dark:border-green-900 dark:bg-green-950/20"
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
                    <div className="text-xs text-muted-foreground space-y-0.5">
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
                      onClick={() => setPaid(job, !job.is_paid)}
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
                      onClick={() => {
                        // Optimistic update
                        setOptimisticJobs(prev =>
                          prev.map(j => j.id === job.id ? { ...j, is_completed: false } : j)
                        );
                        
                        startTransition(async () => {
                          const result = await toggleJobComplete(job.id, false);
                          if (!result?.ok) {
                            // Revert on error
                            setOptimisticJobs(jobs);
                            toast.error(result?.message ?? "Failed to update job.");
                            return;
                          }
                          toast.success("Job marked as incomplete.");
                          router.refresh();
                        });
                      }}
                    >
                      <CheckCircle2 className="size-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 cursor-pointer p-0"
                          disabled={isPending}
                          aria-label={`Actions for ${job.title}`}
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                          className="cursor-pointer text-xs"
                          disabled={isPending}
                          onSelect={() => setPaid(job, !job.is_paid)}
                        >
                          <DollarSign className="size-4" />
                          {job.is_paid ? "Unmark Paid" : "Mark Paid"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer text-xs"
                          disabled={isPending || job.is_paid || job.is_invoiced}
                          onSelect={() => {
                            // Optimistic update
                            setOptimisticJobs(prev =>
                              prev.map(j => j.id === job.id ? { ...j, is_completed: false } : j)
                            );
                            
                            startTransition(async () => {
                              const result = await toggleJobComplete(job.id, false);
                              if (!result?.ok) {
                                // Revert on error
                                setOptimisticJobs(jobs);
                                toast.error(result?.message ?? "Failed to update job.");
                                return;
                              }
                              toast.success("Job marked as incomplete.");
                              router.refresh();
                            });
                          }}
                        >
                          <CheckCircle2 className="size-4" />
                          Mark Incomplete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
          </>
        )}
      </div>
    </div>
  );
}
