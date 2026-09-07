import Link from "next/link";
import {
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { redirect } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  DollarSign,
  FolderKanban,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  Building2,
  ChevronRight,
  Home,
  MapPin,
  UserRound,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { BreadcrumbSetter } from "@/components/app-shell/breadcrumb-setter";
import { MonthJobsCalendar } from "@/components/dashboard/month-jobs-calendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ToggleJobCompleteButton } from "@/components/dashboard/toggle-job-complete-button";
import { createClient } from "@/lib/supabase/server";
import { getActiveCompanyId } from "@/lib/active-company";

type ProjectRow = {
  id: string;
  project_address: string;
  builder_name: string | null;
  subdivision: string | null;
};

type JobSummaryRow = {
  id: string;
  title: string;
  scheduled_completion: string | null;
  is_completed: boolean;
  project_id: string;
  superintendent: string | null;
  price_cents?: number | null;
};

function money(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}
export const metadata = {
  robots: {
    index: false,
    follow: false,
  }
}
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) redirect("/login");

  const companyId = await getActiveCompanyId();
  if (!companyId) redirect("/login");

  const now = new Date();
  const today = format(now, "yyyy-MM-dd");
  const weekStartDate = startOfWeek(now, { weekStartsOn: 0 });
  const weekEndDate = endOfWeek(now, { weekStartsOn: 0 });
  const weekStart = format(weekStartDate, "yyyy-MM-dd");
  const weekEnd = format(weekEndDate, "yyyy-MM-dd");

  const monthStartDate = startOfMonth(now);
  const monthEndDate = endOfMonth(now);
  const monthStart = format(monthStartDate, "yyyy-MM-dd");
  const monthEnd = format(monthEndDate, "yyyy-MM-dd");

  const [
    projectsRes,
    dueTodayRes,
    currentWeekJobsRes,
    monthJobsRes,
    openJobsCountRes,
    completedMonthCountRes,
    monthInvoicesRes,
    upcomingJobsRes,
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id, project_address, builder_name, subdivision")
      .eq("company_id", companyId)
      .is("deleted_at", null),
    supabase
      .from("jobs")
      .select("id")
      .eq("company_id", companyId)
      .eq("is_completed", false)
      .is("deleted_at", null)
      .eq("scheduled_completion", today),
    supabase
      .from("jobs")
      .select("id")
      .eq("company_id", companyId)
      .eq("is_completed", false)
      .is("deleted_at", null)
      .gte("scheduled_completion", weekStart)
      .lte("scheduled_completion", weekEnd),
    supabase
      .from("jobs")
      .select(
        "id, title, scheduled_completion, is_completed, project_id, superintendent, price_cents",
      )
      .eq("company_id", companyId)
      .is("deleted_at", null)
      // The dashboard calendar is intentionally scoped to the current month so
      // the month widget always matches the surrounding dashboard metrics.
      .gte("scheduled_completion", monthStart)
      .lte("scheduled_completion", monthEnd)
      .order("scheduled_completion", { ascending: true }),
    supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("is_completed", false)
      .is("deleted_at", null),
    supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("is_completed", true)
      .is("deleted_at", null)
      .gte("completed_at", `${monthStart}T00:00:00`)
      .lte("completed_at", `${monthEnd}T23:59:59.999`),
    supabase
      .from("invoices")
      .select("id, subtotal_cents")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .gte("invoice_date", monthStart)
      .lte("invoice_date", monthEnd),
    supabase
      .from("jobs")
      .select(
        "id, title, scheduled_completion, is_completed, project_id, superintendent",
      )
      .eq("company_id", companyId)
      .eq("is_completed", false)
      .is("deleted_at", null)
      .gte("scheduled_completion", weekStart)
      .lte("scheduled_completion", weekEnd)
      .order("scheduled_completion", { ascending: true }),
  ]);

  const firstError =
    projectsRes.error ??
    dueTodayRes.error ??
    currentWeekJobsRes.error ??
    monthJobsRes.error ??
    openJobsCountRes.error ??
    completedMonthCountRes.error ??
    monthInvoicesRes.error ??
    upcomingJobsRes.error;

  if (firstError) {
    return (
      <div className="space-y-6">
        <BreadcrumbSetter crumbs={[{ label: "Dashboard", href: "/" }]} />
        <Card className="border-border p-6">
          <div className="text-sm text-muted-foreground">
            Failed to load dashboard: {firstError.message}
          </div>
        </Card>
      </div>
    );
  }

  const projects = (projectsRes.data ?? []) as ProjectRow[];
  const projectMap = new Map(projects.map((project) => [project.id, project]));

  const monthJobs = ((monthJobsRes.data ?? []) as JobSummaryRow[])
    .filter((j) => !!j.scheduled_completion)
    .map((j) => ({
      id: j.id,
      title: j.title,
      scheduled_completion: j.scheduled_completion!,
      is_completed: j.is_completed,
      project_id: j.project_id,
      superintendent: j.superintendent,
      project_address:
        projectMap.get(j.project_id)?.project_address ?? "Unknown project",
      builder_name: projectMap.get(j.project_id)?.builder_name ?? null,
      subdivision: projectMap.get(j.project_id)?.subdivision ?? null,
      price_cents: j.price_cents ?? null,
    }));

  const dueTodayCount = (dueTodayRes.data ?? []).length;
  const currentWeekJobsCount = (currentWeekJobsRes.data ?? []).length;
  const openJobsCount = openJobsCountRes.count ?? 0;
  const completedThisMonth = completedMonthCountRes.count ?? 0;

  const monthInvoices = (monthInvoicesRes.data ?? []) as Array<{
    subtotal_cents: number | null;
  }>;
  const invoiceMonthCount = monthInvoices.length;
  const invoiceMonthTotal = monthInvoices.reduce(
    (sum, inv) => sum + (inv.subtotal_cents ?? 0),
    0,
  );

  const upcomingJobs = ((upcomingJobsRes.data ?? []) as JobSummaryRow[]).map(
    (j) => ({
      ...j,
      project_address:
        projectMap.get(j.project_id)?.project_address ?? "Unknown project",
      builder_name: projectMap.get(j.project_id)?.builder_name ?? null,
      subdivision: projectMap.get(j.project_id)?.subdivision ?? null,
    }),
  );

  const monthName = format(monthStartDate, "MMMM yyyy");

  // Derived stats for new widgets
  const completionRate =
    openJobsCount + completedThisMonth > 0
      ? Math.round(
        (completedThisMonth / (openJobsCount + completedThisMonth)) * 100,
      )
      : 0;

  const overdueJobs = upcomingJobs.filter((j) => {
    if (!j.scheduled_completion) return false;
    return j.scheduled_completion < today;
  });

  const totalPipelineValue = ((monthJobsRes.data ?? []) as JobSummaryRow[])
    .filter((j) => !j.is_completed)
    .reduce((sum, j) => sum + (j.price_cents ?? 0), 0);

  return (
    <div className="flex min-h-full flex-col">
      <BreadcrumbSetter crumbs={[{ label: "Dashboard", href: "/" }]} />

      {/* ─── Page heading ─── */}
      <PageHeader title="Dashboard" description="Your schedule, active projects, and billing at a glance." className="pb-6" />

      {/* ═══════════════════════════════════════════════
          ROW 1 — KPI stat cards (fixed height, no scroll)
         ═══════════════════════════════════════════════ */}
      <div className="shrink-0 grid gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-4 pb-6">
        {/* Schedule Focus */}
        <Card className="border-border" size="sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
                <CalendarDays className="size-4 text-muted-foreground" />
              </div>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Schedule Focus
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tracking-tight tabular-nums">
              {dueTodayCount}
            </div>
            <p className="text-xs text-muted-foreground">Jobs due today</p>
            <Separator className="my-3" />
            <div className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Clock className="size-3.5 text-muted-foreground" />
              <span>
                <span className="font-semibold">{currentWeekJobsCount}</span>{" "}
                incomplete this week
              </span>
            </div>
            <p className="mt-0.5 pl-5 text-[11px] text-muted-foreground">
              {format(weekStartDate, "MMM d")} –{" "}
              {format(weekEndDate, "MMM d")}
            </p>
          </CardContent>
        </Card>

        {/* Work Pipeline */}
        <Card className="border-border" size="sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
                <TrendingUp className="size-4 text-muted-foreground" />
              </div>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Work Pipeline
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tracking-tight tabular-nums">
              {openJobsCount}
            </div>
            <p className="text-xs text-muted-foreground">Open jobs</p>
            <Separator className="my-3" />
            <div className="flex items-center gap-1.5 text-xs sm:text-sm">
              <CheckCircle2 className="size-3.5 text-green-600 dark:text-green-400" />
              <span>
                <span className="font-semibold">{completedThisMonth}</span>{" "}
                completed in {format(monthStartDate, "MMMM")}
              </span>
            </div>
            <div className="mt-2">
              <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Completion rate</span>
                <span className="font-medium">{completionRate}%</span>
              </div>
              <Progress value={completionRate} className="h-1.5" />
            </div>
          </CardContent>
        </Card>

        {/* Projects */}
        <Card className="border-border" size="sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
                <FolderKanban className="size-4 text-muted-foreground" />
              </div>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Projects
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tracking-tight tabular-nums">
              {projects.length}
            </div>
            <p className="text-xs text-muted-foreground">Active projects</p>
            <Separator className="my-3" />
            {totalPipelineValue > 0 ? (
              <div className="flex items-center gap-1.5 text-xs sm:text-sm">
                <BarChart3 className="size-3.5 text-muted-foreground" />
                <span>
                  <span className="font-semibold">
                    {money(totalPipelineValue)}
                  </span>{" "}
                  pipeline value
                </span>
              </div>
            ) : (
              <Link href="/projects">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-border hover:bg-muted"
                >
                  Open Projects
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>

        {/* Invoices this month */}
        <Card className="border-border" size="sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
                <DollarSign className="size-4 text-muted-foreground" />
              </div>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Invoices · {monthName}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tracking-tight tabular-nums">
              {invoiceMonthCount}
            </div>
            <p className="text-xs text-muted-foreground">Invoices issued</p>
            <Separator className="my-3" />
            <div className="flex items-center gap-1.5 text-xs sm:text-sm">
              <DollarSign className="size-3.5 text-muted-foreground" />
              <span>
                Total:{" "}
                <span className="font-semibold">
                  {money(invoiceMonthTotal)}
                </span>
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════════
          ROW 2 — Below xl, panels stack and the app shell owns page scrolling.
          At xl and above, panels fit the viewport and scroll internally.
         ═══════════════════════════════════════════════ */}
      <div className="grid gap-4  xl:flex-1 xl:grid-cols-[2fr_1fr] ">
        <div className="flex flex-col gap-4   xl:pr-1">
          <Card className="flex min-h-[40rem] flex-col border-border  xl:flex-1">
            <CardHeader className="shrink-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-foreground">Jobs Calendar</CardTitle>
                  <CardDescription>
                    Select a date to review scheduled jobs and completion status.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="border-border bg-muted">
                  {monthJobs.length} scheduled
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-hidden">
              <MonthJobsCalendar
                jobs={monthJobs}
                monthStart={monthStart}
                todayKey={today}
              />
            </CardContent>
          </Card>

        </div>

        {/* Removed Quick Actions , Month overview and Futrure Ideas widget */}

        {/* Right column — Jobs this week + Overdue */}
        <div className="flex flex-col gap-4 ">
          {/* Overdue alert */}
          {overdueJobs.length > 0 && (
            <Card className="border-destructive/30 bg-destructive/5 shrink-0" size="sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-destructive" />
                  <CardTitle className="text-destructive">
                    Overdue Jobs
                  </CardTitle>
                </div>
                <CardDescription>
                  {overdueJobs.length} job{overdueJobs.length === 1 ? "" : "s"}{" "}
                  past scheduled date
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {overdueJobs.slice(0, 3).map((job) => (
                    <div
                      key={job.id}
                      className="flex items-start justify-between gap-2 rounded-md border border-destructive/20 bg-destructive/5 p-2 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">{job.title}</div>
                        <div className="text-xs text-muted-foreground">
                          Due: {job.scheduled_completion}
                        </div>
                      </div>
                      <Badge variant="destructive" className="shrink-0 text-[10px]">
                        Overdue
                      </Badge>
                    </div>
                  ))}
                  {overdueJobs.length > 3 && (
                    <p className="text-xs text-muted-foreground">
                      +{overdueJobs.length - 3} more
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Jobs This Week */}
          <Card className="mb-20 flex max-h-[60vh] min-h-0 flex-1 flex-col border-border md:mb-0 xl:max-h-none">
            <CardHeader className="shrink-0">
              <div className="flex items-center justify-between ">
                <div>
                  <CardTitle className="text-foreground">
                    Jobs This Week
                  </CardTitle>
                  <CardDescription>
                    Incomplete jobs scheduled for this week.
                  </CardDescription>
                </div>
                <Badge
                  variant="outline"
                  className="border-border bg-muted"
                >
                  {upcomingJobs.length}
                </Badge>
              </div>
            </CardHeader>
              <CardContent className="min-h-0 flex-1 overflow-y-auto pr-1">
              {upcomingJobs.length === 0 ? (
                <div className="rounded-md border p-3 text-center text-sm text-muted-foreground">
                  No incomplete jobs this week 🎉
                </div>
              ) : (
                <div className="space-y-3 pr-1">
                  {upcomingJobs.map((job) => (
                    <div
                      key={job.id}
                      className="rounded-lg border border-border bg-primary/3 p-3 dark:bg-primary/7"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-2">
                          <div className="min-w-0">
                            <div className="text-sm font-medium wrap-break-word">
                              {job.title}
                            </div>
                            <div className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="size-3.5" />
                              {job.project_address}
                            </div>
                          </div>
                          {/* Match the day-detail cards so the right rail uses its height
                              for real job context instead of sparse one-line rows. */}
                          <div className="grid gap-1.5 text-xs text-muted-foreground">
                            <div className="inline-flex items-center gap-1">
                              <Building2 className="size-3.5" />
                              {job.builder_name ?? "Unknown builder"}
                            </div>
                            <div className="inline-flex items-center gap-1">
                              <Home className="size-3.5" />
                              {job.subdivision ?? "Unassigned subdivision"}
                            </div>
                            {job.superintendent && (
                              <div className="inline-flex items-center gap-1 wrap-break-word">
                                <UserRound className="size-3.5" />
                                Supt / GC: {job.superintendent}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span>{job.scheduled_completion}</span>
                            <Link
                              href={`/projects/${job.project_id}`}
                              className="inline-flex items-center gap-1 font-medium text-primary transition-colors hover:text-muted-foreground"
                            >
                              Open project
                              <ChevronRight className="size-3.5" />
                            </Link>
                          </div>
                        </div>
                        <ToggleJobCompleteButton
                          jobId={job.id}
                          isCompleted={job.is_completed}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
