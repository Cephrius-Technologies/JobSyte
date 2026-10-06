// Onboarding: server entry for the Projects module. It scopes data with
// `lib/active-company.ts`, then hands typed rows to
// `components/projects/projects-page.tsx` for the interactive workbench.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveCompanyId } from "@/lib/active-company";
import { BreadcrumbSetter } from "@/components/app-shell/breadcrumb-setter";
import { ProjectsPageClient } from "@/components/projects/projects-page";
import type {
  LookupItem,
  ProjectBillingStatus,
  ProjectListItem,
} from "@/components/projects/types";

type ProjectRow = {
  id: string;
  project_address: string;
  project_city: string | null;
  project_state: string | null;
  builder_name: string | null;
  subdivision: string | null;
  builder_id: string | null;
  subdivision_id: string | null;
  created_at: string;
};

type ProjectJobRow = {
  id: string;
  project_id: string;
  is_completed: boolean | null;
  is_invoiced: boolean | null;
  is_paid: boolean | null;
  superintendent: string | null;
  created_at: string | null;
};

function normalizeName(value: string | null): string {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

function toStatus(
  jobCount: number,
  openJobCount: number,
): ProjectListItem["status"] {
  if (jobCount === 0) return "not-started";
  if (openJobCount === 0) return "completed";
  return "active";
}

function toBillingStatuses(
  invoicedJobCount: number,
  paidJobCount: number,
): ProjectBillingStatus[] {
  const statuses: ProjectBillingStatus[] = [];

  // Billing is independent from lifecycle, so keep these as additive badges
  // instead of replacing "Completed" with "Invoiced" or "Paid".
  if (invoicedJobCount > 0 || paidJobCount > 0) statuses.push("invoiced");
  if (paidJobCount > 0) statuses.push("paid");

  return statuses;
}

function isMissingProjectLocationColumnError(message: string | undefined) {
  const normalized = (message ?? "").toLowerCase();
  return (
    normalized.includes("project_city") ||
    normalized.includes("project_state") ||
    (normalized.includes("schema cache") && normalized.includes("projects"))
  );
}

async function getProjectsPageData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
) {
  const projectsRes = await supabase
    .from("projects")
    // Include location metadata when the database migration has been applied.
    .select("id, project_address, project_city, project_state, builder_name, subdivision, builder_id, subdivision_id, created_at")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

  let projectsData: ProjectRow[];

  if (
    projectsRes.error &&
    isMissingProjectLocationColumnError(projectsRes.error.message)
  ) {
    const legacyProjectsRes = await supabase
      .from("projects")
      // Backward-compatible fallback: keep existing projects visible before the
      // nullable city/state columns are deployed.
      .select("id, project_address, builder_name, subdivision, builder_id, subdivision_id, created_at")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    projectsData = ((legacyProjectsRes.data ?? []) as Omit<
      ProjectRow,
      "project_city" | "project_state"
    >[]).map((project) => ({
      ...project,
      project_city: null,
      project_state: null,
    }));
  } else {
    projectsData = (projectsRes.data ?? []) as ProjectRow[];
  }

  const [buildersRes, subdivisionsRes, jobsRes] = await Promise.all([
    supabase.from("builders").select("id, name").order("name"),
    supabase.from("subdivisions").select("id, name").order("name"),
    supabase
      .from("jobs")
      .select(
        "id, project_id, is_completed, is_invoiced, is_paid, superintendent, created_at",
      )
      .eq("company_id", companyId)
      .is("deleted_at", null),
  ]);

  const jobs = (jobsRes.data ?? []) as ProjectJobRow[];
  const projectStats = new Map<
    string,
    {
      job_count: number;
      open_job_count: number;
      invoiced_job_count: number;
      paid_job_count: number;
      last_activity_at: string | null;
      crew_names: Set<string>;
    }
  >();

  for (const job of jobs) {
    const projectId = job.project_id;
    if (!projectId) continue;

    const stat = projectStats.get(projectId) ?? {
      job_count: 0,
      open_job_count: 0,
      invoiced_job_count: 0,
      paid_job_count: 0,
      last_activity_at: null,
      crew_names: new Set<string>(),
    };

    stat.job_count += 1;
    if (job.is_completed !== true) stat.open_job_count += 1;
    if (job.is_invoiced === true) stat.invoiced_job_count += 1;
    if (job.is_paid === true) stat.paid_job_count += 1;

    if (job.created_at) {
      if (!stat.last_activity_at || job.created_at > stat.last_activity_at) {
        stat.last_activity_at = job.created_at;
      }
    }

    const crewName = normalizeName(job.superintendent);
    if (crewName) stat.crew_names.add(crewName);

    projectStats.set(projectId, stat);
  }

  const projects = projectsData.map((project) => {
    const stat = projectStats.get(project.id);
    const jobCount = stat?.job_count ?? 0;
    const openJobCount = stat?.open_job_count ?? 0;

    return {
      ...project,
      project_city: project.project_city ?? null,
      project_state: project.project_state ?? null,
      job_count: jobCount,
      open_job_count: openJobCount,
      invoiced_job_count: stat?.invoiced_job_count ?? 0,
      paid_job_count: stat?.paid_job_count ?? 0,
      last_activity_at: stat?.last_activity_at ?? project.created_at ?? null,
      status: toStatus(jobCount, openJobCount),
      billing_statuses: toBillingStatuses(
        stat?.invoiced_job_count ?? 0,
        stat?.paid_job_count ?? 0,
      ),
      crew_names: Array.from(stat?.crew_names ?? []).sort((a, b) =>
        a.localeCompare(b),
      ),
    };
  });

  return {
    projects: projects as ProjectListItem[],
    builders: (buildersRes.data ?? []) as LookupItem[],
    subdivisions: (subdivisionsRes.data ?? []) as LookupItem[],
  };
}

export default async function ProjectsPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) redirect("/login");

  const companyId = await getActiveCompanyId();
  if (!companyId) redirect("/login");

  const { projects, builders, subdivisions } =
    await getProjectsPageData(supabase, companyId);

  return (
    <div className="space-y-6">
      <BreadcrumbSetter crumbs={[{ label: "Projects", href: "/projects" }]} />
      <ProjectsPageClient
        projects={projects}
        builders={builders}
        subdivisions={subdivisions}
      />
    </div>
  );
}
