export type JobLifecycleStatus = "not-started" | "in-progress" | "completed" | "late" | null;

export function getJobLifecycleStatus(
  job: { is_completed: boolean; scheduled_start: string | null; scheduled_completion: string | null },
  today: string,
): JobLifecycleStatus {
  if (job.is_completed) return "completed";
  if (!job.scheduled_start && !job.scheduled_completion) return "not-started"
  if (job.scheduled_completion && job.scheduled_completion < today) return "late";
  if (!job.scheduled_start) return null;
  return job.scheduled_start > today ? "not-started" : "in-progress";
}

export function getLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
