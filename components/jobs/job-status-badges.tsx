import { StatusBadge } from "@/components/ui/status-badge";
import { getJobLifecycleStatus } from "@/components/jobs/job-status";

type JobStatusBadgeFields = {
  is_completed: boolean;
  scheduled_start: string | null;
  scheduled_completion: string | null;
  is_invoiced: boolean;
  is_paid: boolean;
};

export function JobStatusBadges({ job, today }: { job: JobStatusBadgeFields; today: string }) {
  const lifecycleStatus = getJobLifecycleStatus(job, today);
  if (!lifecycleStatus && !job.is_invoiced && !job.is_paid) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {lifecycleStatus === "completed" ? (
        <StatusBadge tone="success">Completed</StatusBadge>
      ) : lifecycleStatus === "not-started" ? (
        <StatusBadge>Not Started</StatusBadge>
      ) : lifecycleStatus === "in-progress" ? (
        <StatusBadge tone="info">In progress</StatusBadge>
      ) : lifecycleStatus === "late" ? (
        <StatusBadge tone="danger">Late</StatusBadge>
      ) : null}
      {job.is_invoiced && <StatusBadge>Invoiced</StatusBadge>}
      {job.is_paid && <StatusBadge tone="success">Paid</StatusBadge>}
    </div>
  );
}
