import { describe, expect, it } from "vitest";
import { getJobLifecycleStatus, getLocalDateKey } from "@/components/jobs/job-status";

const today = "2026-09-26";
const baseJob = { is_completed: false, scheduled_start: null, scheduled_completion: null };

describe("getJobLifecycleStatus", () => {
  it("keeps a job with a future start date not started", () => {
    expect(getJobLifecycleStatus({ ...baseJob, scheduled_start: "2026-09-27" }, today)).toBe("not-started");
  });

  it("marks a job scheduled for today in progress", () => {
    expect(getJobLifecycleStatus({ ...baseJob, scheduled_start: today }, today)).toBe("in-progress");
  });

  it("keeps an overdue incomplete job in progress", () => {
    expect(getJobLifecycleStatus({ ...baseJob, scheduled_start: "2026-09-25" }, today)).toBe("in-progress");
  });

  it("does not give an unscheduled incomplete job a status", () => {
    expect(getJobLifecycleStatus(baseJob, today)).toBeNull();
  });

  it("lets completion override the scheduled start date", () => {
    expect(getJobLifecycleStatus({ ...baseJob, is_completed: true, scheduled_start: "2026-09-27" }, today)).toBe("completed");
  });

  it("marks an incomplete job late after its scheduled completion date", () => {
    expect(getJobLifecycleStatus({ ...baseJob, scheduled_completion: "2026-09-25" }, today)).toBe("late");
  });

  it("does not mark a job late on its scheduled completion day", () => {
    expect(getJobLifecycleStatus({ ...baseJob, scheduled_start: "2026-09-25", scheduled_completion: today }, today)).toBe("in-progress");
  });

  it("keeps a completed overdue job completed", () => {
    expect(getJobLifecycleStatus({ ...baseJob, is_completed: true, scheduled_completion: "2026-09-25" }, today)).toBe("completed");
  });

  it("uses the local calendar day for status comparisons", () => {
    expect(getLocalDateKey(new Date(2026, 8, 26))).toBe(today);
  });
});
