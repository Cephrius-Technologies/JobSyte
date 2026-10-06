import type { createClient } from "@/lib/supabase/server";
import type { JobRow } from "@/components/jobs/jobs-table";

export const JOBS_PAGE_SIZE = 100;
export type JobsStatusFilter = "all" | "open" | "completed";
export type JobsSortKey = "job" | "project" | "status" | "price" | "scheduled_start" | "scheduled_completion" | "superintendent";
export type JobsSort = { key: JobsSortKey; direction: "asc" | "desc" };

const jobsSortColumns: Record<JobsSortKey, string> = {
  job: "title",
  project: "project_sort(project_address)",
  status: "is_completed",
  price: "price_cents",
  scheduled_start: "scheduled_start",
  scheduled_completion: "scheduled_completion",
  superintendent: "superintendent",
};

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

export function parseJobsStatus(raw: string | undefined): JobsStatusFilter {
  return raw === "open" || raw === "completed" ? raw : "all";
}

export function parseJobsSort(rawKey: string | undefined, rawDirection: string | undefined): JobsSort | null {
  if (!rawKey || !Object.hasOwn(jobsSortColumns, rawKey)) return null;
  return { key: rawKey as JobsSortKey, direction: rawDirection === "desc" ? "desc" : "asc" };
}

export function nextJobsSort(current: JobsSort | null, key: JobsSortKey): JobsSort {
  return { key, direction: current?.key === key && current.direction === "asc" ? "desc" : "asc" };
}

export function getJobsHref(page: number, status: JobsStatusFilter, sort: JobsSort | null = null): string {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (status !== "all") params.set("status", status);
  if (sort) {
    params.set("sort", sort.key);
    params.set("dir", sort.direction);
  }
  const query = params.toString();
  return query ? `/jobs?${query}` : "/jobs";
}

export async function getCompanyJobsPageData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  page: number,
  status: JobsStatusFilter = "all",
  sort: JobsSort | null = null,
): Promise<{ jobs: CompanyJob[]; total: number }> {
  const first = (page - 1) * JOBS_PAGE_SIZE;
  const jobColumns = "id, project_id, title, price_cents, scheduled_start, scheduled_completion, is_completed, superintendent, completed_by_type, completed_by_id, completed_by_name, is_invoiced, is_paid, created_at";
  let query = supabase
    .from("jobs")
    .select(
      sort?.key === "project" ? `${jobColumns}, project_sort:projects(project_address)` : jobColumns,
      { count: "exact" },
    )
    .eq("company_id", companyId)
    .is("deleted_at", null);

  if (status !== "all") query = query.eq("is_completed", status === "completed");

  if (sort) {
    query = query.order(jobsSortColumns[sort.key], { ascending: sort.direction === "asc", nullsFirst: false });
  }
  query = query.order("created_at", { ascending: false }).order("id", { ascending: true });

  const { data, count, error } = await query.range(first, first + JOBS_PAGE_SIZE - 1);

  if (error) throw new Error(error.message);

  // The conditional relation select is valid at runtime but exceeds supabase-js's select type parser.
  const jobs = (data ?? []) as unknown as DatabaseJob[];
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
