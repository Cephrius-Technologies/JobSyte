import type { createClient } from "@/lib/supabase/server";
import type { JobRow } from "@/components/jobs/jobs-table";

export const JOBS_PAGE_SIZE = 100;

type DatabaseJob = JobRow & {
  project_id: string;
  created_at: string;
};

export type CompanyJob = DatabaseJob & {
  project_address: string | null;
};

export function parseJobsPage(raw: string | undefined): number {
  const page = Number(raw);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

export async function getCompanyJobsPageData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  page: number,
): Promise<{ jobs: CompanyJob[]; total: number }> {
  const first = (page - 1) * JOBS_PAGE_SIZE;
  const { data, count, error } = await supabase
    .from("jobs")
    .select(
      "id, project_id, title, price_cents, scheduled_start, scheduled_completion, is_completed, superintendent, completed_by_type, completed_by_id, completed_by_name, is_invoiced, is_paid, created_at",
      { count: "exact" },
    )
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(first, first + JOBS_PAGE_SIZE - 1);

  if (error) throw new Error(error.message);

  const jobs = (data ?? []) as DatabaseJob[];
  if (jobs.length === 0) return { jobs: [], total: count ?? 0 };

  const projectIds = [...new Set(jobs.map((job) => job.project_id))];
  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("id, project_address")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .in("id", projectIds);

  if (projectsError) throw new Error(projectsError.message);

  const projectAddressById = new Map(
    (projects ?? []).map((project) => [project.id, project.project_address]),
  );

  return {
    jobs: jobs.map((job) => ({
      ...job,
      project_address: projectAddressById.get(job.project_id) ?? null,
    })),
    total: count ?? 0,
  };
}
