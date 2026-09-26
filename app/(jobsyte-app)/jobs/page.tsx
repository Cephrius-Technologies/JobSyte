import { redirect } from "next/navigation";
import { BreadcrumbSetter } from "@/components/app-shell/breadcrumb-setter";
import { AllJobsPage } from "@/components/jobs/all-jobs-page";
import { getActiveCompanyId } from "@/lib/active-company";
import { getCompanyJobsPageData, JOBS_PAGE_SIZE, parseJobsPage } from "@/lib/jobs/company-jobs";
import { createClient } from "@/lib/supabase/server";

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const companyId = await getActiveCompanyId();
  if (!companyId) redirect("/login");

  const page = parseJobsPage((await searchParams).page);
  const { jobs, total } = await getCompanyJobsPageData(supabase, companyId, page);
  const lastPage = Math.max(1, Math.ceil(total / JOBS_PAGE_SIZE));
  if (page > lastPage) redirect(lastPage === 1 ? "/jobs" : `/jobs?page=${lastPage}`);

  return (
    <>
      <BreadcrumbSetter crumbs={[{ label: "Jobs", href: "/jobs" }]} />
      <AllJobsPage jobs={jobs} total={total} page={page} />
    </>
  );
}
