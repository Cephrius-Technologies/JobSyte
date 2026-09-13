import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getActiveCompanyId } from "@/lib/active-company";
import { BreadcrumbSetter } from "@/components/app-shell/breadcrumb-setter";
import { ProjectAccountingClient } from "@/components/accounting/project-accounting-client";
import {
  getProjectLocationSubtitle,
  getProjectStreetTitle,
} from "@/components/projects/project-location";
import type { ProjectExpense, ProjectProfitability, ProjectStatus } from "@/components/accounting/types";

function isMissingProjectLocationColumnError(message: string | undefined) {
  const normalized = (message ?? "").toLowerCase();
  return (
    normalized.includes("project_city") ||
    normalized.includes("project_state") ||
    (normalized.includes("schema cache") && normalized.includes("projects"))
  );
}

export default async function ProjectAccountingFromProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const companyId = await getActiveCompanyId();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) redirect("/login");
  if (!companyId) redirect("/login");

  let projectRes = await supabase
    .from("projects")
    .select("id, project_address, project_city, project_state, builder_name, subdivision")
    .eq("id", id)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .maybeSingle();

  if (
    projectRes.error &&
    isMissingProjectLocationColumnError(projectRes.error.message)
  ) {
    projectRes = await supabase
      .from("projects")
      .select("id, project_address, builder_name, subdivision")
      .eq("id", id)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .maybeSingle();
  }

  if (projectRes.error) {
    return <p className="text-sm text-destructive">{projectRes.error.message}</p>;
  }

  const project = projectRes.data
    ? {
        ...projectRes.data,
        project_city: "project_city" in projectRes.data ? projectRes.data.project_city : null,
        project_state: "project_state" in projectRes.data ? projectRes.data.project_state : null,
      }
    : null;

  if (!project) {
    return <div className="text-sm text-muted-foreground">Project not found.</div>;
  }

  const [jobsRes, expensesRes] = await Promise.all([
    supabase
      .from("jobs")
      .select("price_cents, is_completed")
      .eq("project_id", id)
      .is("deleted_at", null),
    supabase
      .from("project_expenses")
      .select("id, project_id, company_id, created_by, payment_id, source_type, name, description, category, cost_type, value_type, amount_cents, expense_date, created_at, updated_at")
      .eq("project_id", id)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
  ]);

  const jobs = jobsRes.data ?? [];
  const expenses = (expensesRes.data ?? []) as ProjectExpense[];

  const revenue_cents = jobs
    .filter((job) => job.is_completed)
    .reduce((sum, job) => sum + (job.price_cents ?? 0), 0);

  const estimated_revenue_cents = jobs.reduce(
    (sum, job) => sum + (job.price_cents ?? 0),
    0,
  );

  const direct_actual_cents = expenses
    .filter((expense) => expense.cost_type === "direct" && expense.value_type === "actual")
    .reduce((sum, expense) => sum + expense.amount_cents, 0);

  const direct_total_cents = expenses
    .filter((expense) => expense.cost_type === "direct")
    .reduce((sum, expense) => sum + expense.amount_cents, 0);

  const indirect_actual_cents = expenses
    .filter((expense) => expense.cost_type === "indirect" && expense.value_type === "actual")
    .reduce((sum, expense) => sum + expense.amount_cents, 0);

  const indirect_total_cents = expenses
    .filter((expense) => expense.cost_type === "indirect")
    .reduce((sum, expense) => sum + expense.amount_cents, 0);

  const totalJobs = jobs.length;
  const completedJobs = jobs.filter((job) => job.is_completed).length;
  const status: ProjectStatus =
    totalJobs === 0
      ? "not-started"
      : completedJobs === totalJobs
        ? "completed"
        : "active";

  const profitability: ProjectProfitability = {
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
    gross_profit_cents: revenue_cents - direct_actual_cents,
    net_profit_cents: revenue_cents - direct_actual_cents - indirect_actual_cents,
    est_gross_profit_cents: estimated_revenue_cents - direct_total_cents,
    est_net_profit_cents: estimated_revenue_cents - direct_total_cents - indirect_total_cents,
  };
  const projectStreetTitle = getProjectStreetTitle(project);
  const projectLocationSubtitle = getProjectLocationSubtitle(project);

  return (
    <div className="space-y-6">
      <BreadcrumbSetter
        crumbs={[
          { label: "Projects", href: "/projects" },
          { label: projectStreetTitle, href: `/projects/${id}` },
          { label: "Accounting" },
        ]}
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href={`/projects/${id}`}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-primary"
            >
              <ArrowLeft className="size-3.5" />
              Back to Project
            </Link>
          </div>
          <h1 className="mt-1 text-xl font-semibold">{projectStreetTitle}</h1>
          <p className="text-sm text-muted-foreground">
            Builder: {project.builder_name ?? "—"} • Subdivision: {project.subdivision ?? "—"}
            {projectLocationSubtitle ? ` • Location: ${projectLocationSubtitle}` : ""}
          </p>
        </div>
      </div>

      <ProjectAccountingClient
        projectId={id}
        profitability={profitability}
        expenses={expenses}
      />
    </div>
  );
}
