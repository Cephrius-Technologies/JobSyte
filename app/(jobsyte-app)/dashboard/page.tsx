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
  DollarSign,
  FolderKanban,
  TrendingUp,
  ChevronRight,
} from "lucide-react";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { BreadcrumbSetter } from "@/components/app-shell/breadcrumb-setter";
import { MonthJobsCalendar } from "@/components/dashboard/month-jobs-calendar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
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

function DashboardSummaryCard({ href, icon, label, value, description, detail }: {
  href: string;
  icon: ReactNode;
  label: string;
  value: string | number;
  description: string;
  detail: ReactNode;
}) {
  return (
    <Link href={href} className="group min-w-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card className="h-full gap-0 p-4 transition-colors hover:border-primary/40 hover:bg-primary/3 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </span>
        </div>
        <div className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-foreground">{value}</div>
        <p className="mb-4 mt-1 text-xs text-muted-foreground">{description}</p>
        <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
          <span className="min-w-0 truncate">{detail}</span>
          <ChevronRight className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
        </div>
      </Card>
    </Link>
  );
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
      .select("id, title, scheduled_completion, is_completed, project_id")
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
    }),
  );

  const monthName = format(monthStartDate, "MMMM yyyy");

  const totalPipelineValue = ((monthJobsRes.data ?? []) as JobSummaryRow[])
    .filter((j) => !j.is_completed)
    .reduce((sum, j) => sum + (j.price_cents ?? 0), 0);

  return (
    <div className="flex min-h-full flex-col">
      <BreadcrumbSetter crumbs={[{ label: "Dashboard", href: "/" }]} />

      {/* ─── Page heading ─── */}
      <PageHeader title="Dashboard" description="Your schedule, active projects, and billing at a glance." className="pb-6" />

      <div className="grid gap-3 pb-6 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardSummaryCard
          href="/calendar"
          icon={<CalendarDays className="size-4" />}
          label="Due today"
          value={dueTodayCount}
          description="Incomplete jobs due today"
          detail={`${currentWeekJobsCount} due this week · ${format(weekStartDate, "MMM d")}–${format(weekEndDate, "MMM d")}`}
        />
        <DashboardSummaryCard
          href="/jobs"
          icon={<TrendingUp className="size-4" />}
          label="Open jobs"
          value={openJobsCount}
          description="Work currently in progress"
          detail={<span className="inline-flex items-center gap-1"><CheckCircle2 className="size-3.5" />{completedThisMonth} completed in {format(monthStartDate, "MMMM")}</span>}
        />
        <DashboardSummaryCard
          href="/projects"
          icon={<FolderKanban className="size-4" />}
          label="Active projects"
          value={projects.length}
          description="Projects across your company"
          detail={totalPipelineValue > 0 ? `${money(totalPipelineValue)} scheduled pipeline` : "View all projects"}
        />
        <DashboardSummaryCard
          href="/invoices"
          icon={<DollarSign className="size-4" />}
          label={`Invoices · ${monthName}`}
          value={invoiceMonthCount}
          description="Invoices issued this month"
          detail={`${money(invoiceMonthTotal)} total invoiced`}
        />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="min-w-0">
          <Card className="flex min-h-[40rem] flex-col border-border">
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

        <Card className="min-w-0 gap-0 border-border py-0">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-4">
            <div>
              <h2 className="font-semibold">Jobs This Week</h2>
              <p className="text-xs text-muted-foreground">Incomplete jobs · {format(weekStartDate, "MMM d")}–{format(weekEndDate, "MMM d")}</p>
            </div>
            <Badge variant="secondary" className="shrink-0">{upcomingJobs.length}</Badge>
          </div>
          {upcomingJobs.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">No incomplete jobs scheduled this week.</p>
          ) : (
            <div className="max-h-[32rem] divide-y overflow-y-auto">
              {upcomingJobs.map((job) => {
                const date = new Date(`${job.scheduled_completion}T00:00:00`);
                return (
                  <div key={job.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="flex w-10 shrink-0 flex-col items-center rounded-md bg-muted px-1 py-1 text-xs text-muted-foreground">
                      <span>{format(date, "EEE")}</span>
                      <strong className="text-base leading-tight text-foreground">{format(date, "d")}</strong>
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link href={`/projects/${job.project_id}`} className="block truncate text-sm font-medium hover:text-primary hover:underline">
                        {job.title}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">{job.project_address}</p>
                    </div>
                    <ToggleJobCompleteButton jobId={job.id} isCompleted={job.is_completed} compact />
                  </div>
                );
              })}
            </div>
          )}
          <Link href="/jobs" className="flex items-center justify-between border-t px-4 py-3 text-xs font-medium text-primary hover:bg-muted/50">
            View all jobs <ChevronRight className="size-4" />
          </Link>
        </Card>
      </div>
    </div>
  );
}
