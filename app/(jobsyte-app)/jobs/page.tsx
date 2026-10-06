import { redirect } from "next/navigation";
import { BreadcrumbSetter } from "@/components/app-shell/breadcrumb-setter";
import { AllJobsPage } from "@/components/jobs/all-jobs-page";
import { getActiveCompanyId } from "@/lib/active-company";
import { getCompanyJobsPageData, getJobsHref, JOBS_PAGE_SIZE, parseJobsPage, parseJobsSort, parseJobsStatus } from "@/lib/jobs/company-jobs";
import { createClient } from "@/lib/supabase/server";

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; sort?: string; dir?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const companyId = await getActiveCompanyId();
  if (!companyId) redirect("/login");

  const params = await searchParams;
  const page = parseJobsPage(params.page);
  const status = parseJobsStatus(params.status);
  const sort = parseJobsSort(params.sort, params.dir);
  const { jobs, total } = await getCompanyJobsPageData(supabase, companyId, page, status, sort);
  const lastPage = Math.max(1, Math.ceil(total / JOBS_PAGE_SIZE));
  if (page > lastPage) redirect(getJobsHref(lastPage, status, sort));

  return (
    <>
      <BreadcrumbSetter crumbs={[{ label: "Jobs", href: "/jobs" }]} />
      <AllJobsPage jobs={jobs} total={total} page={page} status={status} sort={sort} />
    </>
  );
}
