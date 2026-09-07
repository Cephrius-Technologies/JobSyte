// Onboarding: project detail server page. It fetches project, job, and
// profitability rows for `components/jobs/jobs-table.tsx`; job mutations live in
// the sibling `actions.ts`.
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { BreadcrumbSetter } from "@/components/app-shell/breadcrumb-setter";
import { AddJobButton } from "@/components/jobs/add-job-button";
import { JobsTable } from "@/components/jobs/jobs-table";
import { createClient } from "@/lib/supabase/server";
import { CreateInvoiceButton } from "@/components/invoices/create-invoice-button";
import { ProjectMapCard } from "@/components/projects/project-map-card";
import {
  getProjectLocationSubtitle,
  getProjectStreetTitle,
} from "@/components/projects/project-location";
import { getPublicMapboxAccessToken } from "@/lib/maps/mapbox";
import type { ProjectProfitability, ProjectStatus } from "@/components/accounting/types";

function formatMoney(cents: number) {
  const dollars = cents / 100;
  return dollars.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

function isMissingProjectLocationColumnError(message: string | undefined) {
  const normalized = (message ?? "").toLowerCase();
  return (
    normalized.includes("project_city") ||
    normalized.includes("project_state") ||
    (normalized.includes("schema cache") && normalized.includes("projects"))
  );
}


function MetricRow({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={muted ? "tabular-nums text-muted-foreground" : "tabular-nums font-medium"}>
        {value}
      </span>
    </div>
  );
}

function ComparisonBar({
  label,
  value,
  widthPct,
  tone,
}: {
  label: string;
  value: string;
  widthPct: number;
  tone: "primary" | "muted";
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums text-muted-foreground">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
        <div
          className={tone === "primary" ? "h-full rounded-full bg-primary" : "h-full rounded-full bg-muted-foreground/40"}
          style={{ width: `${Math.max(widthPct, 4)}%` }}
        />
      </div>
    </div>
  );
}

export default async function ProjectDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) redirect("/login");

  let projectRes = await supabase
    .from("projects")
    .select("id, project_address, project_city, project_state, builder_name, subdivision")
    .is("deleted_at", null)
    .eq("id", id)
    .single();

  if (
    projectRes.error &&
    isMissingProjectLocationColumnError(projectRes.error.message)
  ) {
    projectRes = await supabase
      .from("projects")
      .select("id, project_address, builder_name, subdivision")
      .is("deleted_at", null)
      .eq("id", id)
      .single();
  }

  const project = projectRes.data
    ? {
        ...projectRes.data,
        project_city: "project_city" in projectRes.data ? projectRes.data.project_city : null,
        project_state:
          "project_state" in projectRes.data ? projectRes.data.project_state : null,
      }
    : null;

  if (!project) {
    return (
      <div className="text-sm text-muted-foreground">Project not found.</div>
    );
  }

  const [jobsRes, expensesRes] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, title, price_cents, scheduled_completion, is_completed, superintendent, completed_by_type, completed_by_id, completed_by_name, is_invoiced, is_paid")
      .eq("project_id", project.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("project_expenses")
      .select("amount_cents, cost_type, value_type")
      .eq("project_id", project.id),
  ]);

  const { data: jobs } = jobsRes;
  const expenses = expensesRes.data ?? [];

  const allJobs = jobs ?? [];
  const totalJobs = allJobs.length;
  const completedJobs = allJobs.filter((j) => j.is_completed).length;

  // Profitability
  const rawStatus = (project as { status?: string }).status ?? "not-started";
  const projStatus: ProjectStatus =
    rawStatus === "completed" || rawStatus === "active" || rawStatus === "not-started"
      ? rawStatus
      : completedJobs === totalJobs && totalJobs > 0
      ? "completed"
      : totalJobs === 0
      ? "not-started"
      : "active";

  const rev_cents       = allJobs.filter((j) => j.is_completed).reduce((s, j) => s + (j.price_cents ?? 0), 0);
  const est_rev_cents   = allJobs.reduce((s, j) => s + (j.price_cents ?? 0), 0);
  const dir_actual      = expenses.filter((e) => e.cost_type === "direct"   && e.value_type === "actual").reduce((s, e) => s + e.amount_cents, 0);
  const dir_total       = expenses.filter((e) => e.cost_type === "direct").reduce((s, e) => s + e.amount_cents, 0);
  const ind_actual      = expenses.filter((e) => e.cost_type === "indirect" && e.value_type === "actual").reduce((s, e) => s + e.amount_cents, 0);
  const ind_total       = expenses.filter((e) => e.cost_type === "indirect").reduce((s, e) => s + e.amount_cents, 0);

  const profitability: ProjectProfitability = {
    project_id:              project.id,
    project_address:         project.project_address,
    project_city:            project.project_city,
    project_state:           project.project_state,
    builder_name:            project.builder_name,
    subdivision:             project.subdivision,
    status:                  projStatus,
    revenue_cents:           rev_cents,
    estimated_revenue_cents: est_rev_cents,
    direct_actual_cents:     dir_actual,
    direct_total_cents:      dir_total,
    indirect_actual_cents:   ind_actual,
    indirect_total_cents:    ind_total,
    gross_profit_cents:      rev_cents - dir_actual,
    net_profit_cents:        rev_cents - dir_actual - ind_actual,
    est_gross_profit_cents:  est_rev_cents - dir_total,
    est_net_profit_cents:    est_rev_cents - dir_total - ind_total,
  };

  // invoice actions
  const completedNotInvoiceCount = await (async () => {
    const completed = allJobs.filter((j) => j.is_completed);
    if (completed.length === 0) return 0;

    const { data: invoiced } = await supabase
      .from("invoices_jobs")
      .select("job_id")
      .in(
        "job_id",
        completed.map((j) => j.id),
      );

    const invoicedSet = new Set(
      (invoiced ?? []).map((x: { job_id: string | null }) => x.job_id ?? ""),
    );
    return completed.filter((j) => !invoicedSet.has(j.id)).length;
  })();

  const totalValue = allJobs.reduce((sum, j) => sum + (j.price_cents ?? 0), 0);
  const completedValue = allJobs
    .filter((j) => j.is_completed)
    .reduce((sum, j) => sum + (j.price_cents ?? 0), 0);
  const openJobs = totalJobs - completedJobs;
  const completionPct =
    totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0;
  const remainingValue = totalValue - completedValue;
  const invoicedJobs = allJobs.filter((j) => j.is_invoiced || j.is_paid).length;
  const invoicedValue = allJobs
    .filter((j) => j.is_invoiced || j.is_paid)
    .reduce((sum, j) => sum + (j.price_cents ?? 0), 0);
  const pendingJobs = totalJobs - invoicedJobs;
  const totalExpenses = dir_total + ind_total;
  const revenueForDisplay = projStatus === "completed" ? rev_cents : est_rev_cents;
  const chartMax = Math.max(revenueForDisplay, totalExpenses, 1);
  const revenueBarPct = Math.round((revenueForDisplay / chartMax) * 100);
  const expensesBarPct = Math.round((totalExpenses / chartMax) * 100);
  const grossProfitForDisplay =
    projStatus === "completed"
      ? profitability.gross_profit_cents
      : profitability.est_gross_profit_cents;
  const netProfitForDisplay =
    projStatus === "completed"
      ? profitability.net_profit_cents
      : profitability.est_net_profit_cents;
  const marginPct =
    revenueForDisplay > 0 ? Math.round((netProfitForDisplay / revenueForDisplay) * 100) : 0;
  const projectStreetTitle = getProjectStreetTitle(project);
  const projectLocationSubtitle = getProjectLocationSubtitle(project);
  const mapboxToken = getPublicMapboxAccessToken();

  return (
    <div className="flex flex-col gap-6">
      <BreadcrumbSetter
        crumbs={[
          { label: "Projects", href: "/projects" },
          { label: projectStreetTitle },
        ]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{projectStreetTitle}</h1>
          <p className="text-sm text-muted-foreground">
          Builder: {project.builder_name} • Subdivision: {project.subdivision}
          {projectLocationSubtitle ? ` • Location: ${projectLocationSubtitle}` : ""}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end">
          <CreateInvoiceButton
            projectId={project.id}
            disabled={completedNotInvoiceCount === 0}
            className="w-full sm:w-auto"
          />
          <AddJobButton
            projectId={project.id}
            label="Add Job"
            className="w-full sm:w-auto"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Total Jobs"
              value={String(totalJobs)}
              meta={`${openJobs} open`}
            />
            <StatCard
              label="Completed Jobs"
              value={String(completedJobs)}
              meta={`${completionPct}% complete`}
            />
            <StatCard
              label="Total Project Value"
              value={formatMoney(totalValue)}
              meta="All project jobs"
            />
            <StatCard
              label="Completed Value"
              value={formatMoney(completedValue)}
              meta="Completed work"
            />
      </div>

      <div className="order-2 grid gap-4 lg:order-none lg:grid-cols-2">
        <Card className="min-w-0 gap-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">Job Value</h2>
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {projStatus === "completed" ? "Actual" : "Estimated"}
              </span>
            </div>
            <Link
              href={`/projects/${project.id}/accounting`}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
            >
              View Accounting <ArrowRight className="size-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="min-w-0 space-y-1">
              <div className="text-xs text-muted-foreground">Net Profit</div>
              <div className="text-xl font-semibold tracking-tight tabular-nums break-words">{formatMoney(netProfitForDisplay)}</div>
            </div>
            <div className="min-w-0 space-y-1">
              <div className="text-xs text-muted-foreground">Gross Profit</div>
              <div className="text-xl font-semibold tracking-tight tabular-nums break-words">{formatMoney(grossProfitForDisplay)}</div>
            </div>
          </div>

          <div className="grid gap-x-6 gap-y-2 border-t pt-3 sm:grid-cols-2">
            <div className="space-y-2">
              <MetricRow label="Revenue" value={formatMoney(revenueForDisplay)} />
              <MetricRow label="Direct Costs" value={formatMoney(dir_total)} muted={dir_total === 0} />
              <MetricRow label="Indirect Costs" value={formatMoney(ind_total)} muted={ind_total === 0} />
            </div>
            <div className="space-y-2">
              <MetricRow label="Net Margin" value={`${marginPct}%`} />
              <MetricRow label="Completed" value={formatMoney(completedValue)} muted={completedValue === 0} />
              <MetricRow label="Remaining" value={formatMoney(remainingValue)} muted={remainingValue === 0} />
            </div>
          </div>
        </Card>

        <Card className="min-w-0 gap-4 p-4 sm:p-5">
          <h2 className="text-sm font-semibold">Project Status</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="min-w-0 space-y-1">
              <div className="text-xs text-muted-foreground">{invoicedJobs} Invoiced</div>
              <div className="text-xl font-semibold tracking-tight tabular-nums break-words">{formatMoney(invoicedValue)}</div>
            </div>
            <div className="min-w-0 space-y-1">
              <div className="text-xs text-muted-foreground">Remaining to invoice</div>
              <div className="text-xl font-semibold tracking-tight tabular-nums break-words">{formatMoney(totalValue - invoicedValue)}</div>
            </div>
          </div>

          <div className="space-y-3 border-t pt-3">
            <div className="grid gap-3 sm:grid-cols-2 sm:gap-6">
              <ComparisonBar label="Revenue" value={formatMoney(revenueForDisplay)} widthPct={revenueBarPct} tone="primary" />
              <ComparisonBar label="Expenses" value={formatMoney(totalExpenses)} widthPct={expensesBarPct} tone="muted" />
            </div>
            <p className="text-xs text-muted-foreground">
              {pendingJobs} job{pendingJobs === 1 ? "" : "s"} still not invoiced
            </p>
          </div>
        </Card>
      </div>

      <div className="order-1 grid gap-4 lg:order-none lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)] lg:items-start">
        <Card className="min-w-0 gap-4 p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold">Jobs</div>
              <div className="text-xs text-muted-foreground">
                Add jobs, then mark them complete for invoicing.
              </div>
            </div>
          </div>

          <JobsTable jobs={allJobs} projectId={project.id} />
        </Card>

        <ProjectMapCard
          address={project.project_address}
          city={project.project_city}
          mapboxToken={mapboxToken}
          state={project.project_state}
        />
      </div>
    </div>
  );
}
