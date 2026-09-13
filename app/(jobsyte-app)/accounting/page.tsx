// Onboarding: accounting overview server page. Project-level accounting reuses
// the same data types and client components under `components/accounting/*`.
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getActiveCompanyId } from "@/lib/active-company";
import { BreadcrumbSetter } from "@/components/app-shell/breadcrumb-setter";
import { AccountingOverviewClient } from "@/components/accounting/accounting-overview-client";
import type {
  AccountingOverviewExpense,
  AccountingOverviewInvoice,
  AccountingOverviewJob,
  AccountingOverviewRow,
  ProjectStatus,
} from "@/components/accounting/types";

/**
 * Compute profitability numbers for a single project given pre-fetched
 * job and expense rows.
 */
function isMissingProjectLocationColumnError(message: string | undefined) {
  const normalized = (message ?? "").toLowerCase();
  return (
    normalized.includes("project_city") ||
    normalized.includes("project_state") ||
    (normalized.includes("schema cache") && normalized.includes("projects"))
  );
}

function withLegacyProjectLocation<T extends Record<string, unknown>>(project: T) {
  return {
    ...project,
    project_city: "project_city" in project ? project.project_city : null,
    project_state: "project_state" in project ? project.project_state : null,
  } as T & { project_city: string | null; project_state: string | null };
}

function buildOverviewRow(
  project: {
    id: string;
    project_address: string;
    project_city: string | null;
    project_state: string | null;
    builder_name: string | null;
    subdivision: string | null;
  },
  jobs: { price_cents: number; is_completed: boolean }[],
  expenses: { amount_cents: number; cost_type: string; value_type: string }[],
): AccountingOverviewRow {
  const revenue_cents = jobs
    .filter((j) => j.is_completed)
    .reduce((s, j) => s + (j.price_cents ?? 0), 0);

  const estimated_revenue_cents = jobs.reduce((s, j) => s + (j.price_cents ?? 0), 0);

  const direct_actual_cents = expenses
    .filter((e) => e.cost_type === "direct" && e.value_type === "actual")
    .reduce((s, e) => s + e.amount_cents, 0);

  const direct_total_cents = expenses
    .filter((e) => e.cost_type === "direct")
    .reduce((s, e) => s + e.amount_cents, 0);

  const indirect_actual_cents = expenses
    .filter((e) => e.cost_type === "indirect" && e.value_type === "actual")
    .reduce((s, e) => s + e.amount_cents, 0);

  const indirect_total_cents = expenses
    .filter((e) => e.cost_type === "indirect")
    .reduce((s, e) => s + e.amount_cents, 0);

  const total_expenses_cents  = direct_total_cents + indirect_total_cents;
  const gross_profit_cents    = revenue_cents - direct_actual_cents;
  const net_profit_cents      = revenue_cents - direct_actual_cents - indirect_actual_cents;
  const est_gross_profit_cents = estimated_revenue_cents - direct_total_cents;
  const est_net_profit_cents   = estimated_revenue_cents - direct_total_cents - indirect_total_cents;

  const totalJobs = jobs.length;
  const completedJobs = jobs.filter((j) => j.is_completed).length;
  const status: ProjectStatus =
    totalJobs === 0
      ? "not-started"
      : completedJobs === totalJobs
        ? "completed"
        : "active";

  return {
    project_id: project.id,
    project_address: project.project_address,
    project_city: project.project_city,
    project_state: project.project_state,
    builder_name: project.builder_name,
    subdivision: project.subdivision,
    status,
    revenue_cents,
    estimated_revenue_cents,
    direct_actual_cents,
    direct_total_cents,
    indirect_actual_cents,
    indirect_total_cents,
    gross_profit_cents,
    net_profit_cents,
    est_gross_profit_cents,
    est_net_profit_cents,
    total_expenses_cents,
  };
}

export default async function AccountingOverviewPage() {
  const supabase   = await createClient();
  const companyId  = await getActiveCompanyId();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) redirect("/login");
  if (!companyId)         redirect("/login");

  // Fetch all non-deleted projects for the company
  const projectsRes = await supabase
    .from("projects")
    .select("id, project_address, project_city, project_state, builder_name, subdivision")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  let allProjects = (projectsRes.data ?? []).map(withLegacyProjectLocation);

  if (
    projectsRes.error &&
    isMissingProjectLocationColumnError(projectsRes.error.message)
  ) {
    const legacyProjectsRes = await supabase
      .from("projects")
      .select("id, project_address, builder_name, subdivision")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (legacyProjectsRes.error) {
      return <p className="text-sm text-destructive">{legacyProjectsRes.error.message}</p>;
    }

    allProjects = (legacyProjectsRes.data ?? []).map(withLegacyProjectLocation);
  } else if (projectsRes.error) {
    return <p className="text-sm text-destructive">{projectsRes.error.message}</p>;
  }
  if (allProjects.length === 0) {
    return (
      <div className="space-y-6">
        <BreadcrumbSetter crumbs={[{ label: "Accounting", href: "/accounting" }]} />
        <div>
          <h1 className="text-2xl font-semibold text-primary">Accounting</h1>
          <p className="text-sm text-muted-foreground">Project profitability overview</p>
        </div>
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">
            No projects found. Create a project to start tracking expenses and profitability.
          </p>
        </div>
      </div>
    );
  }

  const projectIds = allProjects.map((p) => p.id);

  // Fetch jobs + expenses in parallel, scoped to this company's projects
  const [jobsRes, expensesRes, invoicesRes] = await Promise.all([
    supabase
      .from("jobs")
      .select("project_id, price_cents, is_completed, created_at, completed_at, scheduled_completion")
      .in("project_id", projectIds)
      .is("deleted_at", null),
    supabase
      .from("project_expenses")
      .select("project_id, amount_cents, cost_type, value_type, expense_date, created_at")
      .eq("company_id", companyId)
      .in("project_id", projectIds),
    supabase
      .from("invoices")
      .select("project_id, subtotal_cents, invoice_date, due_date, is_paid, created_at")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .in("project_id", projectIds),
  ]);

  if (jobsRes.error) {
    return <p className="text-sm text-destructive">{jobsRes.error.message}</p>;
  }

  if (expensesRes.error) {
    return <p className="text-sm text-destructive">{expensesRes.error.message}</p>;
  }

  if (invoicesRes.error) {
    return <p className="text-sm text-destructive">{invoicesRes.error.message}</p>;
  }

  const jobsByProject    = new Map<string, typeof jobsRes.data>();
  const expensesByProject = new Map<string, typeof expensesRes.data>();

  for (const job of jobsRes.data ?? []) {
    const list = jobsByProject.get(job.project_id) ?? [];
    list.push(job);
    jobsByProject.set(job.project_id, list);
  }

  for (const exp of expensesRes.data ?? []) {
    const list = expensesByProject.get(exp.project_id) ?? [];
    list.push(exp);
    expensesByProject.set(exp.project_id, list);
  }

  const jobs = (jobsRes.data ?? []) as AccountingOverviewJob[];
  const expenses = (expensesRes.data ?? []) as AccountingOverviewExpense[];
  const invoices = (invoicesRes.data ?? []) as AccountingOverviewInvoice[];

  const rows: AccountingOverviewRow[] = allProjects.map((project) =>
    buildOverviewRow(
      project,
      jobsByProject.get(project.id) ?? [],
      expensesByProject.get(project.id) ?? [],
    ),
  );

  return (
    <div className="space-y-6">
      <BreadcrumbSetter crumbs={[{ label: "Accounting", href: "/accounting" }]} />

      <div>
        <h1 className="text-2xl font-semibold text-primary">Accounting</h1>
        <p className="text-sm text-muted-foreground">
          Project profitability across {allProjects.length} project
          {allProjects.length === 1 ? "" : "s"}
        </p>
      </div>

      <AccountingOverviewClient
        rows={rows}
        jobs={jobs}
        expenses={expenses}
        invoices={invoices}
        todayKey={format(new Date(), "yyyy-MM-dd")}
      />
    </div>
  );
}
