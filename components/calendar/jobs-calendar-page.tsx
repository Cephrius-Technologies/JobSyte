"use client";

import { type ComponentProps, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  isSameMonth,
  isValid,
  parse,
  startOfMonth,
  subMonths,
} from "date-fns";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FolderKanban,
  Home,
  MapPin,
  Printer,
  Plus,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { ToggleJobCompleteButton } from "@/components/dashboard/toggle-job-complete-button";
import {
  FilterDialog,
  FilterDialogSection,
} from "@/components/ui/filter-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type CalendarPageJob = {
  id: string;
  title: string;
  scheduled_completion: string;
  is_completed: boolean;
  project_id: string;
  project_address: string;
  builder_name: string | null;
  subdivision: string | null;
  superintendent: string | null;
  price_cents: number | null;
};

type StatusFilter = "all" | "open" | "done";

type CalendarReportDateGroup = {
  dateKey: string;
  date: Date;
  jobs: CalendarPageJob[];
};

type CalendarJobDayButtonProps = ComponentProps<typeof CalendarDayButton> & {
  jobCountsByDate: Map<string, number>;
};

function getJobListDocumentTitle() {
  return `job-list-${format(new Date(), "yyyy-MM-dd")}`;
}

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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildStandaloneJobListHtml(documentTitle: string, printableMarkup: string) {
  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(documentTitle)}</title>
        <style>
          @page { margin: 0.5in; }
          html, body { background: #ffffff; margin: 0; padding: 0; }
          body { color: #111827; font-family: Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          #job-list-print-root { margin: 0; padding: 0; }
          .print\\:hidden { display: none !important; }
        </style>
      </head>
      <body>${printableMarkup}</body>
    </html>
  `;
}

function CalendarJobDayButton({
  jobCountsByDate,
  className,
  day,
  ...props
}: CalendarJobDayButtonProps) {
  const dateKey = format(day.date, "yyyy-MM-dd");
  const jobCount = jobCountsByDate.get(dateKey) ?? 0;

  return (
    <CalendarDayButton
      day={day}
      className={cn(
        "h-full min-h-[var(--cell-size)] justify-center py-1.5 [&>span]:opacity-100",
        className,
      )}
      {...props}
    >
      <span className="text-sm font-medium leading-none sm:text-base">
        {format(day.date, "d")}
      </span>
      {jobCount > 0 ? (
        <span className="mt-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary">
          {jobCount}
        </span>
      ) : null}
    </CalendarDayButton>
  );
}

function JobListPrintablePreview({
  dateGroups,
  generatedDateKey,
}: {
  dateGroups: CalendarReportDateGroup[];
  generatedDateKey: string;
}) {
  const allJobs = dateGroups.flatMap((group) => group.jobs);
  const completedJobs = allJobs.filter((job) => job.is_completed).length;
  const totalValue = allJobs.reduce(
    (sum, job) => sum + (job.price_cents ?? 0),
    0,
  );

  return (
    <div
      id="job-list-print-root"
      className="rounded-lg border border-border bg-background p-5 text-foreground shadow-xs print:border-0 print:p-0 print:shadow-none"
    >
      <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xl font-semibold">Job List</div>
          <div className="text-sm text-muted-foreground">
            Generated {format(parseYmd(generatedDateKey), "MMMM d, yyyy")}
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          {dateGroups.length} date{dateGroups.length === 1 ? "" : "s"} selected
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        <div className="rounded-md border border-border px-3 py-2">
          <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            Jobs
          </div>
          <div className="mt-1 text-lg font-semibold">{allJobs.length}</div>
        </div>
        <div className="rounded-md border border-border px-3 py-2">
          <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            Completed
          </div>
          <div className="mt-1 text-lg font-semibold">{completedJobs}</div>
        </div>
        <div className="rounded-md border border-border px-3 py-2">
          <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            Incomplete
          </div>
          <div className="mt-1 text-lg font-semibold">
            {allJobs.length - completedJobs}
          </div>
        </div>
        <div className="rounded-md border border-border px-3 py-2">
          <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            Total Value
          </div>
          <div className="mt-1 text-lg font-semibold">
            {formatCurrency(totalValue)}
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-5">
        {dateGroups.map(({ dateKey, date, jobs }) => (
          <section key={dateKey} className="break-inside-avoid">
            <div className="border-b border-border pb-2 text-base font-semibold">
              {format(date, "EEEE, MMMM d, yyyy")}
            </div>

            {jobs.length === 0 ? (
              <div className="mt-3 text-sm text-muted-foreground">
                No matching jobs for this date.
              </div>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[46rem] border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="border border-border px-2 py-2 font-semibold">
                        Job
                      </th>
                      <th className="border border-border px-2 py-2 font-semibold">
                        Project
                      </th>
                      <th className="border border-border px-2 py-2 font-semibold">
                        Builder
                      </th>
                      <th className="border border-border px-2 py-2 font-semibold">
                        Subdivision
                      </th>
                      <th className="border border-border px-2 py-2 font-semibold">
                        Superintendent / GC
                      </th>
                      <th className="border border-border px-2 py-2 font-semibold">
                        Status
                      </th>
                      <th className="border border-border px-2 py-2 text-right font-semibold">
                        Value
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((job) => (
                      <tr key={job.id}>
                        <td className="border border-border px-2 py-2 align-top font-medium">
                          {job.title}
                        </td>
                        <td className="border border-border px-2 py-2 align-top">
                          {job.project_address}
                        </td>
                        <td className="border border-border px-2 py-2 align-top">
                          {job.builder_name ?? "Unknown builder"}
                        </td>
                        <td className="border border-border px-2 py-2 align-top">
                          {job.subdivision ?? "Unassigned subdivision"}
                        </td>
                        <td className="border border-border px-2 py-2 align-top">
                          {job.superintendent ?? "No superintendent assigned"}
                        </td>
                        <td className="border border-border px-2 py-2 align-top">
                          {job.is_completed ? "Completed" : "Incomplete"}
                        </td>
                        <td className="border border-border px-2 py-2 text-right align-top">
                          {formatCurrency(job.price_cents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

export function JobsCalendarPageClient({
  jobs,
  todayKey,
}: {
  jobs: CalendarPageJob[];
  todayKey: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [superintendentFilter, setSuperintendentFilter] = useState("all");

  const scheduledJobs = useMemo(
    () =>
      jobs
        .filter((job) => Boolean(job.scheduled_completion))
        .sort((left, right) =>
          left.scheduled_completion.localeCompare(right.scheduled_completion),
        ),
    [jobs],
  );

  const calendarBounds = useMemo(() => {
    const currentMonth = startOfMonth(parseYmd(todayKey));
    const earliestJobMonth = scheduledJobs[0]
      ? startOfMonth(parseYmd(scheduledJobs[0].scheduled_completion))
      : currentMonth;
    const latestJobMonth = scheduledJobs[scheduledJobs.length - 1]
      ? startOfMonth(
          parseYmd(scheduledJobs[scheduledJobs.length - 1].scheduled_completion),
        )
      : currentMonth;

    return {
      // Unlike the dashboard widget, the full calendar page should expose the
      // broadest navigable range the company has data for, while still keeping
      // "Today" reachable if the current month sits outside scheduled work.
      firstJobMonth:
        earliestJobMonth < currentMonth ? earliestJobMonth : currentMonth,
      lastJobMonth:
        latestJobMonth > currentMonth ? latestJobMonth : currentMonth,
      currentMonth,
    };
  }, [scheduledJobs, todayKey]);

  const [visibleMonth, setVisibleMonth] = useState(() => {
    const { currentMonth, firstJobMonth, lastJobMonth } = calendarBounds;
    if (currentMonth < firstJobMonth) return firstJobMonth;
    if (currentMonth > lastJobMonth) return lastJobMonth;
    return currentMonth;
  });

  const superintendentOptions = useMemo(() => {
    const uniqueNames = new Set<string>();

    for (const job of scheduledJobs) {
      const normalized = job.superintendent?.trim();
      if (normalized) uniqueNames.add(normalized);
    }

    return Array.from(uniqueNames).sort((left, right) =>
      left.localeCompare(right),
    );
  }, [scheduledJobs]);

  const filteredJobs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return scheduledJobs.filter((job) => {
      if (statusFilter === "open" && job.is_completed) return false;
      if (statusFilter === "done" && !job.is_completed) return false;
      if (
        superintendentFilter !== "all" &&
        (job.superintendent ?? "") !== superintendentFilter
      ) {
        return false;
      }

      if (!normalizedQuery) return true;

      const haystack = [
        job.title,
        job.project_address,
        job.builder_name ?? "",
        job.subdivision ?? "",
        job.superintendent ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [query, scheduledJobs, statusFilter, superintendentFilter]);

  const activeFilterCount =
    Number(query.trim().length > 0) +
    Number(statusFilter !== "all") +
    Number(superintendentFilter !== "all");

  const jobsByDate = useMemo(() => {
    const groupedJobs = new Map<string, CalendarPageJob[]>();

    // Filter state is applied before grouping so every month/day count, job
    // list, and detail view reflects the same subset of work.
    for (const job of filteredJobs) {
      const existing = groupedJobs.get(job.scheduled_completion) ?? [];
      existing.push(job);
      groupedJobs.set(job.scheduled_completion, existing);
    }

    for (const [dateKey, dateJobs] of groupedJobs) {
      groupedJobs.set(
        dateKey,
        [...dateJobs].sort((left, right) => left.title.localeCompare(right.title)),
      );
    }

    return groupedJobs;
  }, [filteredJobs]);

  const jobCountsByDate = useMemo(() => {
    const nextCounts = new Map<string, number>();

    for (const [dateKey, dateJobs] of jobsByDate) {
      nextCounts.set(dateKey, dateJobs.length);
    }

    return nextCounts;
  }, [jobsByDate]);

  const visibleMonthJobs = useMemo(
    () =>
      filteredJobs.filter((job) =>
        isSameMonth(parseYmd(job.scheduled_completion), visibleMonth),
      ),
    [filteredJobs, visibleMonth],
  );

  const firstVisibleMonthJobDate = useMemo(() => {
    for (const job of visibleMonthJobs) {
      const parsed = parseYmd(job.scheduled_completion);
      if (isSameMonth(parsed, visibleMonth)) return parsed;
    }

    return startOfMonth(visibleMonth);
  }, [visibleMonth, visibleMonthJobs]);

  const [selectedDateKey, setSelectedDateKey] = useState(() =>
    format(firstVisibleMonthJobDate, "yyyy-MM-dd"),
  );
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportDateKeys, setReportDateKeys] = useState<string[]>([]);
  const [reportSingleDateKey, setReportSingleDateKey] = useState(() =>
    format(firstVisibleMonthJobDate, "yyyy-MM-dd"),
  );
  const [reportRangeStartKey, setReportRangeStartKey] = useState(() =>
    format(firstVisibleMonthJobDate, "yyyy-MM-dd"),
  );
  const [reportRangeEndKey, setReportRangeEndKey] = useState(() =>
    format(firstVisibleMonthJobDate, "yyyy-MM-dd"),
  );
  const [isPreparingJobList, setIsPreparingJobList] = useState(false);

  const selectedDate = useMemo(() => {
    const parsed = parseYmd(selectedDateKey);
    if (isValid(parsed) && isSameMonth(parsed, visibleMonth)) return parsed;
    return firstVisibleMonthJobDate;
  }, [firstVisibleMonthJobDate, selectedDateKey, visibleMonth]);

  const selectedDayJobs = useMemo(() => {
    const dateKey = format(selectedDate, "yyyy-MM-dd");
    return jobsByDate.get(dateKey) ?? [];
  }, [jobsByDate, selectedDate]);
  const selectedDateKeyFormatted = format(selectedDate, "yyyy-MM-dd");

  // Keep the job detail selection derived from the active day so filtered or
  // cross-month transitions do not need repair effects.
  const effectiveSelectedJobId = selectedDayJobs.some(
    (job) => job.id === selectedJobId,
  )
    ? selectedJobId
    : (selectedDayJobs[0]?.id ?? null);
  const selectedJob =
    selectedDayJobs.find((job) => job.id === effectiveSelectedJobId) ?? null;

  const monthSummary = useMemo(() => {
    const totalRevenue = visibleMonthJobs.reduce(
      (sum, job) => sum + (job.price_cents ?? 0),
      0,
    );
    const completedJobs = visibleMonthJobs.filter((job) => job.is_completed).length;
    const projectCount = new Set(visibleMonthJobs.map((job) => job.project_id)).size;

    return {
      totalJobs: visibleMonthJobs.length,
      completedJobs,
      totalRevenue,
      projectCount,
    };
  }, [visibleMonthJobs]);

  const reportDateGroups = useMemo(
    () =>
      reportDateKeys.map((dateKey) => ({
        dateKey,
        date: parseYmd(dateKey),
        jobs: jobsByDate.get(dateKey) ?? [],
      })),
    [jobsByDate, reportDateKeys],
  );
  const reportJobCount = reportDateGroups.reduce(
    (count, group) => count + group.jobs.length,
    0,
  );
  const minReportDateKey = format(calendarBounds.firstJobMonth, "yyyy-MM-dd");
  const maxReportDateKey = format(endOfMonth(calendarBounds.lastJobMonth), "yyyy-MM-dd");
  const previousMonth = subMonths(visibleMonth, 1);
  const nextMonth = addMonths(visibleMonth, 1);
  const canGoToPreviousMonth = previousMonth >= calendarBounds.firstJobMonth;
  const canGoToNextMonth = nextMonth <= calendarBounds.lastJobMonth;
  const selectedCalendarDayInJobList = reportDateKeys.includes(
    selectedDateKeyFormatted,
  );

  function openProject(projectId: string) {
    router.push(`/projects/${projectId}`);
  }

  function openReportDialog() {
    setReportSingleDateKey(selectedDateKeyFormatted);
    setReportRangeStartKey(selectedDateKeyFormatted);
    setReportRangeEndKey(selectedDateKeyFormatted);
    setReportDialogOpen(true);
  }

  function addReportDateKeys(nextDateKeys: string[]) {
    setReportDateKeys((current) =>
      Array.from(new Set([...current, ...nextDateKeys]))
        .filter((dateKey) => isValid(parseYmd(dateKey)))
        .sort((left, right) => left.localeCompare(right)),
    );
  }

  function addSingleReportDate() {
    if (!reportSingleDateKey) return;
    addReportDateKeys([reportSingleDateKey]);
  }

  function addSelectedCalendarDayToJobList() {
    addReportDateKeys([selectedDateKeyFormatted]);
  }

  function addReportDateRange() {
    const start = parseYmd(reportRangeStartKey);
    const end = parseYmd(reportRangeEndKey);
    if (!isValid(start) || !isValid(end)) return;

    const firstDate = start <= end ? start : end;
    const lastDate = start <= end ? end : start;
    const nextDateKeys: string[] = [];

    for (
      let cursor = firstDate;
      cursor <= lastDate;
      cursor = addDays(cursor, 1)
    ) {
      nextDateKeys.push(format(cursor, "yyyy-MM-dd"));
    }

    addReportDateKeys(nextDateKeys);
  }

  function removeReportDate(dateKey: string) {
    setReportDateKeys((current) => current.filter((item) => item !== dateKey));
  }

  function clearReportDates() {
    setReportDateKeys([]);
  }

  async function openReportForPrint() {
    if (reportDateGroups.length === 0) return;

    const jobListRoot = document.getElementById("job-list-print-root");
    if (!jobListRoot) return;

    const documentTitle = getJobListDocumentTitle();
    const printFrame = document.createElement("iframe");
    printFrame.setAttribute("aria-hidden", "true");
    printFrame.style.position = "fixed";
    printFrame.style.right = "0";
    printFrame.style.bottom = "0";
    printFrame.style.width = "0";
    printFrame.style.height = "0";
    printFrame.style.border = "0";

    const styles = Array.from(
      document.querySelectorAll<HTMLLinkElement | HTMLStyleElement>(
        'link[rel="stylesheet"], style',
      ),
    )
      .map((node) => node.outerHTML)
      .join("\n");

    const cleanup = () => {
      window.setTimeout(() => {
        printFrame.remove();
      }, 0);
    };

    setIsPreparingJobList(true);

    try {
      document.body.appendChild(printFrame);

      const printDocument = printFrame.contentDocument;
      const printWindow = printFrame.contentWindow;

      if (!printDocument || !printWindow) {
        cleanup();
        window.print();
        return;
      }

      // Match the invoice print path: clone the visible document into an
      // isolated frame so app-shell print styles cannot affect the output.
      printDocument.open();
      printDocument.write(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(documentTitle)}</title>
    ${styles}
    <style>
      @page { margin: 0.4in; }
      html, body { margin: 0; padding: 0; background: #ffffff; }
      body { color: #111827; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      #job-list-print-root {
        position: static !important;
        inset: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        font-size: 9px !important;
        line-height: 1.25 !important;
        color: #111827 !important;
        background: #ffffff !important;
      }
      #job-list-print-root table { page-break-inside: auto; }
      #job-list-print-root tr { page-break-inside: avoid; page-break-after: auto; }
      #job-list-print-root .print\\:hidden { display: none !important; }
      #job-list-print-root .print\\:border-0 { border: 0 !important; }
      #job-list-print-root .print\\:p-0 { padding: 0 !important; }
      #job-list-print-root .print\\:shadow-none { box-shadow: none !important; }
    </style>
  </head>
  <body>
    ${jobListRoot.outerHTML}
  </body>
</html>`);
      printDocument.close();
      printDocument.title = documentTitle;

      await printDocument.fonts.ready.catch(() => undefined);
      await new Promise((resolve) => window.setTimeout(resolve, 150));

      printWindow.addEventListener("afterprint", cleanup, { once: true });
      printWindow.focus();
      printWindow.print();
      window.setTimeout(cleanup, 1000);
    } finally {
      setIsPreparingJobList(false);
    }
  }

  function saveReport() {
    if (reportDateGroups.length === 0) return;

    const jobListRoot = document.getElementById("job-list-print-root");
    if (!jobListRoot) return;

    const documentTitle = getJobListDocumentTitle();
    const reportHtml = buildStandaloneJobListHtml(
      documentTitle,
      jobListRoot.outerHTML,
    );
    const reportBlob = new Blob([reportHtml], { type: "text/html" });
    const reportUrl = URL.createObjectURL(reportBlob);
    const reportLink = document.createElement("a");
    reportLink.href = reportUrl;
    reportLink.download = `${documentTitle}.html`;
    reportLink.click();
    URL.revokeObjectURL(reportUrl);
  }

  function selectMonth(nextMonth: Date) {
    const firstJobInMonth = filteredJobs.find((job) =>
      isSameMonth(parseYmd(job.scheduled_completion), nextMonth),
    );

    setVisibleMonth(nextMonth);
    setSelectedDateKey(
      format(
        firstJobInMonth
          ? parseYmd(firstJobInMonth.scheduled_completion)
          : startOfMonth(nextMonth),
        "yyyy-MM-dd",
      ),
    );
    setSelectedJobId(null);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Calendar</h1>
          <p className="text-sm text-muted-foreground">
            Browse scheduled jobs month by month across your entire company history.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
            <DialogTrigger asChild>
              <Button type="button" variant="outline" onClick={openReportDialog}>
                <Printer className="mr-2 size-4" />
                Create Job List
              </Button>
            </DialogTrigger>
            <DialogContent className="flex max-h-[94svh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
              <DialogHeader className="border-b p-4 pr-12 sm:p-6 sm:pr-14">
                <DialogTitle>Create Job List</DialogTitle>
                <DialogDescription>
                  Select single days or a date range, review the printable job
                  list, then save it or print it as a PDF.
                </DialogDescription>
              </DialogHeader>

              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
                {/* Mobile users need the add-date controls before the preview;
                    desktop keeps the same flow in a wider two-column workspace. */}
                <div className="grid gap-4 lg:grid-cols-[minmax(18rem,0.85fr)_minmax(0,1.15fr)]">
                  <div className="grid content-start gap-4">
                    <div className="rounded-lg border border-border/80 p-4">
                      <div className="flex flex-col gap-3">
                        <div>
                          <div className="text-sm font-semibold">
                            Add Calendar Day
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(selectedDate, "EEEE, MMM d, yyyy")}
                          </div>
                        </div>
                        <Button
                          type="button"
                          className="w-full justify-center gap-2"
                          onClick={addSelectedCalendarDayToJobList}
                          disabled={selectedCalendarDayInJobList}
                        >
                          <Plus className="size-4" />
                          {selectedCalendarDayInJobList
                            ? "Day Added"
                            : "Add Selected Day"}
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-lg border border-border/80 p-4">
                      <div className="mb-3 text-sm font-semibold">Add Single Day</div>
                      <div className="grid gap-3">
                        <div className="grid gap-2">
                          <Label htmlFor="report-single-date">Day</Label>
                          <Input
                            id="report-single-date"
                            type="date"
                            min={minReportDateKey}
                            max={maxReportDateKey}
                            value={reportSingleDateKey}
                            onChange={(event) =>
                              setReportSingleDateKey(event.target.value)
                            }
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full justify-center gap-2"
                          onClick={addSingleReportDate}
                        >
                          <Plus className="size-4" />
                          Add Day
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-lg border border-border/80 p-4">
                      <div className="mb-3 text-sm font-semibold">Add Date Range</div>
                      <div className="grid gap-3">
                        <div className="grid gap-3">
                          <div className="grid gap-2">
                            <Label htmlFor="report-range-start">Start</Label>
                            <Input
                              id="report-range-start"
                              type="date"
                              min={minReportDateKey}
                              max={maxReportDateKey}
                              value={reportRangeStartKey}
                              onChange={(event) =>
                                setReportRangeStartKey(event.target.value)
                              }
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="report-range-end">End</Label>
                            <Input
                              id="report-range-end"
                              type="date"
                              min={minReportDateKey}
                              max={maxReportDateKey}
                              value={reportRangeEndKey}
                              onChange={(event) =>
                                setReportRangeEndKey(event.target.value)
                              }
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full justify-center gap-2"
                          onClick={addReportDateRange}
                        >
                          <Plus className="size-4" />
                          Add Range
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-lg border border-border/80">
                      <div className="flex items-center justify-between gap-3 border-b p-4">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold">Job List Dates</div>
                          <div className="text-xs text-muted-foreground">
                            {reportDateGroups.length} date
                            {reportDateGroups.length === 1 ? "" : "s"} selected,
                            {" "}
                            {reportJobCount} matching job
                            {reportJobCount === 1 ? "" : "s"}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={clearReportDates}
                          disabled={reportDateGroups.length === 0}
                        >
                          Clear
                        </Button>
                      </div>

                      {reportDateGroups.length === 0 ? (
                        <div className="p-4 text-sm text-muted-foreground">
                          No job-list dates selected.
                        </div>
                      ) : (
                        <div className="grid max-h-64 gap-2 overflow-y-auto p-3 sm:p-4">
                          {reportDateGroups.map(({ dateKey, date, jobs }) => (
                            <div
                              key={dateKey}
                              className="flex items-center justify-between gap-3 rounded-md border border-border/80 px-3 py-2 text-sm"
                            >
                              <div className="min-w-0">
                                <div className="truncate font-medium">
                                  {format(date, "EEE, MMM d, yyyy")}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {jobs.length} matching job
                                  {jobs.length === 1 ? "" : "s"}
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => removeReportDate(dateKey)}
                                aria-label={`Remove ${format(date, "MMMM d, yyyy")}`}
                              >
                                <X className="size-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid min-w-0 content-start gap-3">
                    <div>
                      <div className="text-sm font-semibold">Printable Preview</div>
                      <div className="text-xs text-muted-foreground">
                        This is the same document used for save and print/PDF.
                      </div>
                    </div>
                    {reportDateGroups.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">
                        Add one or more days to preview the job list.
                      </div>
                    ) : (
                      <div className="max-h-[26rem] overflow-auto rounded-lg bg-muted/20 p-3 lg:max-h-[34rem]">
                        <JobListPrintablePreview
                          dateGroups={reportDateGroups}
                          generatedDateKey={todayKey}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <DialogFooter className="border-t bg-background p-4 sm:p-6">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2 sm:w-auto"
                  onClick={saveReport}
                  disabled={reportDateGroups.length === 0}
                >
                  <Download className="size-4" />
                  Save Job List
                </Button>
                <Button
                  type="button"
                  className="w-full gap-2 sm:w-auto"
                  onClick={openReportForPrint}
                  disabled={reportDateGroups.length === 0 || isPreparingJobList}
                >
                  <Printer className="size-4" />
                  {isPreparingJobList ? "Preparing..." : "Print / Save PDF"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <FilterDialog
            title="Calendar Filters"
            description="Narrow the calendar by job text, status, or superintendent."
            activeCount={activeFilterCount}
            onClear={() => {
              setQuery("");
              setStatusFilter("all");
              setSuperintendentFilter("all");
            }}
          >
            <FilterDialogSection title="Search">
              <InputGroup>
                <InputGroupAddon>
                  <Search className="size-4" />
                </InputGroupAddon>
                <InputGroupInput
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search jobs, projects, builders..."
                />
              </InputGroup>
            </FilterDialogSection>

            <FilterDialogSection title="Status">
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as StatusFilter)}
              >
                <SelectTrigger className="w-full justify-between">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="open">Incomplete</SelectItem>
                  <SelectItem value="done">Completed</SelectItem>
                </SelectContent>
              </Select>
            </FilterDialogSection>

            <FilterDialogSection title="Superintendent / GC">
              <Select
                value={superintendentFilter}
                onValueChange={setSuperintendentFilter}
              >
                <SelectTrigger className="w-full justify-between">
                  <SelectValue placeholder="All superintendents" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All superintendents</SelectItem>
                  {superintendentOptions.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterDialogSection>
          </FilterDialog>

          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setVisibleMonth(calendarBounds.currentMonth);
              setSelectedDateKey(todayKey);
              setSelectedJobId(null);
            }}
          >
            <CalendarDays className="mr-2 size-4" />
            Today
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(18rem,21rem)] 2xl:grid-cols-[minmax(0,1.9fr)_minmax(20rem,24rem)]">
        <Card className="overflow-hidden">
          <div className="border-b p-3 sm:p-4">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="text-base font-semibold">Calendar Workspace</div>
                <div className="text-sm text-muted-foreground">
                  {format(visibleMonth, "MMMM yyyy")} • {monthSummary.totalJobs} job
                  {monthSummary.totalJobs === 1 ? "" : "s"} in view
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Month-first planning surface with a supporting day agenda.
              </div>
            </div>
          </div>

          {/* Keep the calendar column wide enough for readable custom date
              cells, then let the jobs pane take the remaining flexible space. */}
          <div className="grid min-w-0 items-start gap-4 p-3 sm:p-4 xl:grid-cols-[34rem_minmax(0,1fr)]">
            <div className="min-w-0 space-y-4">
              <div className="w-full overflow-hidden rounded-xl border border-border/80 bg-muted/20 p-2 sm:p-3">
                {/* Keep the navigation and grid constrained to the same width so
                    the month controls, weekdays, and date cells align exactly. */}
                <div className="mx-auto mb-2 flex w-full max-w-[32rem] items-center justify-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => selectMonth(previousMonth)}
                    disabled={!canGoToPreviousMonth}
                    aria-label="Previous month"
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <div className="min-w-[9rem] text-center text-sm font-semibold sm:min-w-[10rem] sm:text-base">
                    {format(visibleMonth, "MMMM yyyy")}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => selectMonth(nextMonth)}
                    disabled={!canGoToNextMonth}
                    aria-label="Next month"
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
                <Calendar
                  className="mx-auto w-full max-w-[32rem] rounded-xl bg-background p-2 [--cell-size:2.75rem] sm:[--cell-size:3.1rem] xl:[--cell-size:3.45rem] sm:p-3"
                  buttonVariant="ghost"
                  mode="single"
                  month={visibleMonth}
                  onMonthChange={selectMonth}
                  selected={selectedDate}
                  onSelect={(nextDate) => {
                    if (!nextDate) return;
                    setSelectedDateKey(format(nextDate, "yyyy-MM-dd"));
                    setSelectedJobId(null);
                  }}
                  fromMonth={calendarBounds.firstJobMonth}
                  toMonth={calendarBounds.lastJobMonth}
                  showOutsideDays={false}
                  components={{
                    // Day cells own the visible job-count indicator. Empty
                    // days intentionally render no count instead of showing 0.
                    DayButton: (dayButtonProps) => (
                      <CalendarJobDayButton
                        {...dayButtonProps}
                        jobCountsByDate={jobCountsByDate}
                      />
                    ),
                  }}
                  classNames={{
                    root: "w-full overflow-hidden",
                    months: "w-full justify-center",
                    month: "mx-auto w-full max-w-[32rem] gap-3",
                    month_caption: "hidden",
                    nav: "hidden",
                    button_previous: "size-8 sm:size-9",
                    button_next: "size-8 sm:size-9",
                    caption_label: "hidden",
                    weekdays: "flex w-full gap-1",
                    weekday:
                      "flex min-w-0 flex-1 items-center justify-center py-1 text-center text-[0.7rem] font-medium text-muted-foreground sm:text-[0.78rem]",
                    week: "mt-1 flex w-full gap-1 sm:mt-1.5",
                    day:
                      "relative aspect-square min-w-0 flex-1 rounded-md p-0 text-center sm:rounded-lg [&_button]:flex [&_button]:items-center [&_button]:justify-center [&_button]:min-w-0",
                    today:
                      "rounded-md bg-muted/80 text-foreground ring-1 ring-border/70 sm:rounded-lg",
                  }}
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5">
                  <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                    Completed
                  </div>
                  <div className="mt-1 flex items-end justify-between gap-2">
                    <div className="text-lg font-semibold">
                      {monthSummary.completedJobs}/{monthSummary.totalJobs}
                    </div>
                    <CheckCircle2 className="size-4 text-primary" />
                  </div>
                </div>
                <div className="rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5">
                  <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                    Pipeline
                  </div>
                  <div className="mt-1 flex items-end justify-between gap-2">
                    <div className="text-lg font-semibold">
                      {formatCurrency(monthSummary.totalRevenue)}
                    </div>
                    <FolderKanban className="size-4 text-primary" />
                  </div>
                </div>
                <div className="rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5">
                  <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                    Active Projects
                  </div>
                  <div className="mt-1 flex items-end justify-between gap-2">
                    <div className="text-lg font-semibold">
                      {monthSummary.projectCount}
                    </div>
                    <Building2 className="size-4 text-primary" />
                  </div>
                </div>
              </div>
            </div>

            <div className="min-w-0 overflow-hidden rounded-xl border border-border/80 bg-background">
              <div className="border-b p-3 sm:p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-sm font-semibold">
                      {format(selectedDate, "EEEE, MMM d, yyyy")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {selectedDayJobs.length} job
                      {selectedDayJobs.length === 1 ? "" : "s"} scheduled
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={openReportDialog}
                  >
                    <Printer className="size-3.5" />
                    Create Job List
                  </Button>
                </div>
              </div>

              {selectedDayJobs.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground sm:p-4">
                  No jobs match the current filters for this date.
                </div>
              ) : (
                <div className="grid gap-3 p-3 sm:p-4">
                  {selectedDayJobs.map((job) => {
                    const isSelected = job.id === effectiveSelectedJobId;

                    return (
                      <article
                        key={job.id}
                        className={cn(
                          "rounded-xl border p-4 transition-colors",
                          isSelected
                            ? "border-primary/40 bg-primary/5"
                            : "border-border/80 bg-muted/15 hover:bg-muted/30",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            className="min-w-0 flex-1 text-left"
                            onClick={() => setSelectedJobId(job.id)}
                          >
                            <div className="truncate text-sm font-semibold">
                              {job.title}
                            </div>
                            <div className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="size-3.5" />
                              {job.project_address}
                            </div>
                          </button>

                          <Badge
                            variant="outline"
                            className={
                              job.is_completed
                                ? "border-emerald-300 bg-emerald-100 text-emerald-800"
                                : "border-amber-300 bg-amber-100 text-amber-800"
                            }
                          >
                            {job.is_completed ? "Completed" : "Incomplete"}
                          </Badge>
                        </div>

                        {/* Smaller breakpoints lose the side inspector, so each
                            job card carries the full context and actions there. */}
                        <div className="mt-3 grid gap-2 text-xs text-muted-foreground xl:hidden">
                          <div className="inline-flex items-center gap-2">
                            <Building2 className="size-3.5" />
                            {job.builder_name ?? "Unknown builder"}
                          </div>
                          <div className="inline-flex items-center gap-2">
                            <Home className="size-3.5" />
                            {job.subdivision ?? "Unassigned subdivision"}
                          </div>
                          <div className="inline-flex items-center gap-2">
                            <UserRound className="size-3.5" />
                            {job.superintendent ?? "No superintendent assigned"}
                          </div>
                          <div className="inline-flex items-center gap-2">
                            <CalendarDays className="size-3.5" />
                            {format(
                              parseYmd(job.scheduled_completion),
                              "MMMM d, yyyy",
                            )}
                          </div>
                          <div className="rounded-lg border border-border/80 bg-muted/20 px-3 py-2">
                            <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                              Job Value
                            </div>
                            <div className="mt-1 text-sm font-semibold text-foreground">
                              {formatCurrency(job.price_cents)}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                          <div className="hidden text-xs text-muted-foreground xl:block">
                            {job.superintendent
                              ? `Supt / GC: ${job.superintendent}`
                              : "No superintendent assigned"}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 px-2 text-xs"
                              onClick={() => openProject(job.project_id)}
                            >
                              Open Project
                              <ChevronRight className="size-3.5" />
                            </Button>
                            <div className="xl:hidden">
                              <ToggleJobCompleteButton
                                jobId={job.id}
                                isCompleted={job.is_completed}
                              />
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </Card>

        <Card className="hidden overflow-hidden xl:block">
          <div className="border-b p-4">
            <div className="text-sm font-semibold">Job Detail</div>
            <div className="text-xs text-muted-foreground">
              {selectedJob ? "Review the selected job before opening the project." : "Select a job to see its detail."}
            </div>
          </div>

          {!selectedJob ? (
            <div className="p-4 text-sm text-muted-foreground">
              Pick a job from the selected day to inspect its builder, subdivision,
              assignee, and completion status.
            </div>
          ) : (
            <div className="space-y-4 p-4">
              {/* The dedicated detail pane gives the calendar page a real
                  inspection workflow instead of making every job card oversized. */}
              <div>
                <div className="text-lg font-semibold">{selectedJob.title}</div>
                <div className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="size-4" />
                  {selectedJob.project_address}
                </div>
              </div>

              <div className="grid gap-3 text-sm text-muted-foreground">
                <div className="inline-flex items-center gap-2">
                  <Building2 className="size-4" />
                  {selectedJob.builder_name ?? "Unknown builder"}
                </div>
                <div className="inline-flex items-center gap-2">
                  <Home className="size-4" />
                  {selectedJob.subdivision ?? "Unassigned subdivision"}
                </div>
                <div className="inline-flex items-center gap-2">
                  <UserRound className="size-4" />
                  {selectedJob.superintendent ?? "No superintendent assigned"}
                </div>
                <div className="inline-flex items-center gap-2">
                  <CalendarDays className="size-4" />
                  {format(parseYmd(selectedJob.scheduled_completion), "MMMM d, yyyy")}
                </div>
              </div>

              <div className="rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5">
                <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                  Job Value
                </div>
                <div className="mt-1 text-lg font-semibold">
                  {formatCurrency(selectedJob.price_cents)}
                </div>
              </div>

              {/* Quick-complete is the extra calendar-specific productivity feature:
                  users can update status without leaving the month workflow. */}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  className="flex-1"
                  onClick={() => openProject(selectedJob.project_id)}
                >
                  Open Project
                </Button>
                <ToggleJobCompleteButton
                  jobId={selectedJob.id}
                  isCompleted={selectedJob.is_completed}
                />
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
