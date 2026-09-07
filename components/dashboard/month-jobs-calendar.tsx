"use client";

import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { format, isSameMonth, isValid, parse, startOfMonth } from "date-fns";
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  FolderKanban,
  Home,
  MapPin,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { ToggleJobCompleteButton } from "@/components/dashboard/toggle-job-complete-button";
import { cn } from "@/lib/utils";

export type CalendarJob = {
  id: string;
  title: string;
  scheduled_completion: string;
  is_completed: boolean;
  project_id: string;
  project_address: string;
  builder_name: string | null;
  subdivision: string | null;
  superintendent: string | null;
  price_cents?: number | null;
};

function parseYmd(value: string): Date {
  return parse(value, "yyyy-MM-dd", new Date());
}

function formatCurrency(cents: number | null | undefined) {
  if (!cents) return "$0.00";
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export function MonthJobsCalendar({
  jobs,
  monthStart,
  todayKey,
}: {
  jobs: CalendarJob[];
  monthStart: string;
  todayKey: string;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const calendarRailRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [calendarRailWidth, setCalendarRailWidth] = useState(0);
  const currentMonth = useMemo(
    () => startOfMonth(parseYmd(monthStart)),
    [monthStart],
  );

  // Group jobs by date once so the calendar highlights and detail panel can read
  // from the same source of truth.
  const jobsByDate = useMemo(() => {
    const groupedJobs = new Map<string, CalendarJob[]>();

    for (const job of jobs) {
      const existingJobs = groupedJobs.get(job.scheduled_completion) ?? [];
      existingJobs.push(job);
      groupedJobs.set(job.scheduled_completion, existingJobs);
    }

    for (const [dateKey, dateJobs] of groupedJobs) {
      groupedJobs.set(
        dateKey,
        [...dateJobs].sort((left, right) => left.title.localeCompare(right.title)),
      );
    }

    return groupedJobs;
  }, [jobs]);

  const scheduledDateKeys = useMemo(
    () => Array.from(jobsByDate.keys()).sort((left, right) => left.localeCompare(right)),
    [jobsByDate],
  );

  const highlightedDates = useMemo(
    () => scheduledDateKeys.map(parseYmd).filter((date) => isValid(date)),
    [scheduledDateKeys],
  );

  const firstCurrentMonthJobDate = useMemo(() => {
    for (const dateKey of scheduledDateKeys) {
      const parsedDate = parseYmd(dateKey);
      if (isSameMonth(parsedDate, currentMonth)) return parsedDate;
    }

    return null;
  }, [currentMonth, scheduledDateKeys]);

  // Selected date handling stays inside the current month now that future-month
  // navigation is intentionally disabled.
  const initialSelectedDate = useMemo(() => {
    if (jobsByDate.has(todayKey)) {
      const parsedToday = parseYmd(todayKey);
      if (isSameMonth(parsedToday, currentMonth)) return parsedToday;
    }

    if (firstCurrentMonthJobDate) return firstCurrentMonthJobDate;

    return currentMonth;
  }, [currentMonth, firstCurrentMonthJobDate, jobsByDate, todayKey]);

  const [selectedDate, setSelectedDate] = useState<Date>(initialSelectedDate);

  function handleDateSelect(nextDate: Date | undefined) {
    if (!nextDate) return;

    setSelectedDate(nextDate);
  }

  const selectedDateKey = format(selectedDate, "yyyy-MM-dd");
  const selectedJobs = jobsByDate.get(selectedDateKey) ?? [];
  const completedSelectedJobs = selectedJobs.filter(
    (job) => job.is_completed,
  ).length;
  const selectedDayRevenue = selectedJobs.reduce(
    (sum, job) => sum + (job.price_cents ?? 0),
    0,
  );
  const selectedDayProjects = new Set(selectedJobs.map((job) => job.project_id))
    .size;
  const selectedDayBuilders = new Set(
    selectedJobs
      .map((job) => job.builder_name?.trim())
      .filter((builderName): builderName is string => Boolean(builderName)),
  ).size;

  function openProject(projectId: string) {
    router.push(`/projects/${projectId}`);
  }

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;

    const resizeObservers: ResizeObserver[] = [];

    if (containerRef.current) {
      const containerObserver = new ResizeObserver(([entry]) => {
        setContainerWidth(entry.contentRect.width);
      });
      containerObserver.observe(containerRef.current);
      resizeObservers.push(containerObserver);
    }

    if (calendarRailRef.current) {
      const railObserver = new ResizeObserver(([entry]) => {
        setCalendarRailWidth(entry.contentRect.width);
      });
      railObserver.observe(calendarRailRef.current);
      resizeObservers.push(railObserver);
    }

    return () => {
      for (const observer of resizeObservers) observer.disconnect();
    };
  }, []);

  // The dashboard can resize without a clean breakpoint transition, especially
  // while users drag the app window. Drive this layout from the actual
  // component width so day cells keep shrinking before dates get clipped.
  // Split this widget much earlier than the page-level xl breakpoint. The
  // dashboard card can be around 650-760px wide on smaller desktop windows, and
  // stacking the month above the job list there causes the calendar to collide
  // with the detail panel.
  const isSplitLayout = containerWidth >= 600;
  const shouldStackMetrics = isSplitLayout && calendarRailWidth < 360;
  const shouldLimitDailyJobs = !isSplitLayout;
  const computedCalendarCellSize = useMemo(() => {
    if (!calendarRailWidth) return 42;

    const usableWidth = Math.max(calendarRailWidth - 22, 238);
    const nextSize = Math.floor(usableWidth / 7);

    return Math.max(28, Math.min(nextSize, isSplitLayout ? 40 : 48));
  }, [calendarRailWidth, isSplitLayout]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "grid h-full min-h-0 gap-3",
        isSplitLayout
          ? "grid-cols-[minmax(15.5rem,18rem)_minmax(0,1fr)]"
          : "grid-cols-1",
      )}
    >
      <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border/80 bg-card/95 shadow-xs dark:border-white/8 dark:bg-card/90">
        <div className="border-b border-border/80 bg-muted/25 px-3 py-2.5 dark:border-white/8 dark:bg-white/[0.03]">
          <div className="text-sm font-semibold text-foreground">Calendar Overview</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {selectedJobs.length} scheduled job{selectedJobs.length === 1 ? "" : "s"} on{" "}
            {format(selectedDate, "MMM d")}
          </div>
        </div>
        <div
          ref={calendarRailRef}
          className="flex min-h-0 flex-1 flex-col gap-3 p-3"
        >
          {/* Keep the dashboard widget pinned to one month with no month
              navigation; the dedicated calendar page owns browsing controls. */}
          <Calendar
            className={cn(
              "mx-auto w-full rounded-xl bg-muted/20 p-1.5 text-card-foreground dark:bg-white/[0.03] dark:text-foreground [&_[data-day]]:text-foreground [&_[data-day]]:hover:bg-muted/55 dark:[&_[data-day]]:hover:bg-white/[0.06] [&_[data-selected-single=true]]:bg-primary/14 [&_[data-selected-single=true]]:text-foreground [&_[data-selected-single=true]]:ring-1 [&_[data-selected-single=true]]:ring-primary/30 dark:[&_[data-selected-single=true]]:bg-primary/24 dark:[&_[data-selected-single=true]]:text-primary-foreground dark:[&_[data-selected-single=true]]:ring-primary/35",
              isSplitLayout ? "max-w-[18rem]" : "max-w-[24rem]",
            )}
            style={
              {
                "--cell-size": `${computedCalendarCellSize}px`,
              } as CSSProperties
            }
            buttonVariant="ghost"
            mode="single"
            required
            defaultMonth={currentMonth}
            fromMonth={currentMonth}
            toMonth={currentMonth}
            showOutsideDays={false}
            selected={selectedDate}
            onSelect={handleDateSelect}
            modifiers={{ hasJobs: highlightedDates }}
            modifiersClassNames={{
              hasJobs:
                "relative after:absolute after:bottom-1 after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-primary/70 dark:after:bg-primary/80",
            }}
            classNames={{
              // Keep dark mode on the same muted/card palette as the rest of the dashboard.
              root: "relative w-full max-w-full",
              months: "flex w-full justify-center",
              month: "flex w-full max-w-full flex-col gap-1.5",
              month_caption: "flex h-8 items-center justify-center",
              caption_label:
                "truncate text-xs font-semibold text-foreground dark:text-foreground sm:text-sm",
              nav: "hidden",
              button_previous:
                "size-7 rounded-full bg-transparent p-0 text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground disabled:pointer-events-none disabled:opacity-30 dark:text-muted-foreground dark:hover:bg-transparent dark:hover:text-foreground [&_svg]:size-4",
              button_next:
                "size-7 rounded-full bg-transparent p-0 text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground disabled:pointer-events-none disabled:opacity-30 dark:text-muted-foreground dark:hover:bg-transparent dark:hover:text-foreground [&_svg]:size-4",
              weekdays: "mt-1.5 flex",
              weekday:
                "flex-1 select-none rounded-md text-center text-[0.68rem] font-medium text-muted-foreground dark:text-muted-foreground sm:text-[0.72rem]",
              week: "mt-0.5 flex w-full sm:mt-1",
              day: "relative aspect-square flex-1 rounded-md p-0 text-center",
              today:
                "rounded-md bg-muted/80 text-foreground ring-1 ring-border/70 dark:bg-white/[0.06] dark:text-foreground dark:ring-white/10",
            }}
          />

          <div
            className={cn(
              "grid gap-2",
              shouldStackMetrics
                ? "grid-cols-1"
                : isSplitLayout
                  ? "grid-cols-3"
                  : "sm:grid-cols-3",
            )}
          >
            {/* Fill the left panel with high-signal day metrics so larger screens
                don't leave a dead block of whitespace under the calendar. */}
            <div className="rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5  dark:border-white/8 dark:bg-white/[0.03]">
              <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Completed Today
              </div>
              <div className="mt-1 flex items-end justify-between gap-2">
                <div className="text-lg font-semibold text-foreground">
                  {completedSelectedJobs}/{selectedJobs.length}
                </div>
                <CheckCircle2 className="size-4 text-primary" />
              </div>
            </div>
            <div className="rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5 dark:border-white/8 dark:bg-white/[0.03]">
              <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Pipeline
              </div>
              <div className="mt-1 flex items-end justify-between gap-2">
                <div className="text-lg font-semibold text-foreground">
                  {formatCurrency(selectedDayRevenue)}
                </div>
                <FolderKanban className="size-4 text-primary" />
              </div>
            </div>
            <div className="rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5 dark:border-white/8 dark:bg-white/[0.03]">
              <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Coverage
              </div>
              <div className="mt-1 flex items-end justify-between gap-2">
                <div className="text-lg font-semibold text-foreground">
                  {selectedDayProjects} projects | {selectedDayBuilders} builder
                  {selectedDayBuilders === 1 ? "" : "s"}
                </div>
                <Building2 className="size-4 text-primary" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border/80 bg-card/95 shadow-xs dark:border-white/8 dark:bg-card/90">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border/80 bg-muted/25 px-3 py-2.5 dark:border-white/8 dark:bg-white/[0.03]">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-foreground">
              <span className="block lg:hidden">
                {format(selectedDate, "EEE, MMM d")}
              </span>
              <span className="hidden lg:block">
                {format(selectedDate, "EEEE, MMM d, yyyy")}
              </span>
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {completedSelectedJobs}/{selectedJobs.length} complete
            </div>
          </div>
          <Badge
            variant="outline"
            className="shrink-0 border-primary/25 bg-primary/10 text-primary dark:border-border dark:bg-primary/14 dark:text-primary-foreground"
          >
            {selectedJobs.length} job{selectedJobs.length === 1 ? "" : "s"}
          </Badge>
        </div>

        {selectedJobs.length === 0 ? (
          // Empty state rendering stays in the details pane so the calendar can
          // keep its place while users browse dates with no scheduled work.
          <div className="m-3 rounded-lg border border-dashed border-border/80 bg-muted/20 p-4 text-sm text-muted-foreground dark:border-white/10 dark:bg-white/[0.03]">
            No jobs scheduled for this date.
          </div>
        ) : (
          <div
            className={cn(
              "min-h-0 overflow-y-auto p-3",
              shouldLimitDailyJobs
                // Narrow stacked layouts keep the first ~5 cards in view, then
                // let the day list scroll so the month grid stays fully visible.
                ? "max-h-[44rem]"
                : "flex-1",
            )}
          >
            <div className="grid gap-3 2xl:grid-cols-2">
            {selectedJobs.map((job) => (
              <article
                key={job.id}
                role="button"
                tabIndex={0}
                onClick={() => openProject(job.project_id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openProject(job.project_id);
                  }
                }}
                className="grid min-h-32 grid-cols-[minmax(0,1fr)_auto] gap-4 rounded-xl border border-border/80 bg-muted/20 p-4 text-left transition-colors hover:bg-muted/35 sm:min-h-40 dark:border-white/8 dark:bg-white/[0.03] dark:hover:bg-white/[0.05]"
              >
                <div className="min-w-0 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-foreground">
                        {job.title}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3.5" />
                          {job.project_address}
                        </span>
                      </div>
                    </div>
                    <Badge
                      className={
                        job.is_completed
                          ? "border border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                          : "border border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                      }
                      variant="secondary"
                    >
                      {job.is_completed ? "Completed" : "Incomplete"}
                    </Badge>
                  </div>

                  <div className="grid gap-2 text-[12px] text-muted-foreground sm:grid-cols-2">
                    <div className="inline-flex items-center gap-1.5">
                      <Building2 className="size-3.5" />
                      {job.builder_name ?? "Unknown builder"}
                    </div>
                    <div className="inline-flex items-center gap-1.5">
                      <Home className="size-3.5" />
                      {job.subdivision ?? "Unassigned subdivision"}
                    </div>
                    {job.superintendent ? (
                      <div className="inline-flex items-center gap-1.5 sm:col-span-2">
                        <UserRound className="size-3.5" />
                        Supt / GC: {job.superintendent}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3 dark:border-white/8">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                        Scheduled
                      </div>
                      <div className="text-sm font-medium text-foreground">
                        {format(parseYmd(job.scheduled_completion), "EEE, MMM d")}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                        {formatCurrency(job.price_cents)}
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end justify-between gap-3">
                  <ToggleJobCompleteButton
                    jobId={job.id}
                    isCompleted={job.is_completed}
                    compact
                  />
                </div>
              </article>
            ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
