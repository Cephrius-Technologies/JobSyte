import { redirect } from "next/navigation";
import { format } from "date-fns";
import { BreadcrumbSetter } from "@/components/app-shell/breadcrumb-setter";
import {
  JobsCalendarPageClient,
  type CalendarPageJob,
} from "@/components/calendar/jobs-calendar-page";
import { getActiveCompanyId } from "@/lib/active-company";
import { createClient } from "@/lib/supabase/server";

type ProjectRow = {
  id: string;
  project_address: string;
  builder_name: string | null;
  subdivision: string | null;
};

type JobRow = {
  id: string;
  title: string;
  scheduled_completion: string | null;
  is_completed: boolean;
  project_id: string;
  superintendent: string | null;
  price_cents: number | null;
};

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function CalendarPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) redirect("/login");

  const companyId = await getActiveCompanyId();
  if (!companyId) redirect("/login");

  const [projectsRes, jobsRes] = await Promise.all([
    supabase
      .from("projects")
      .select("id, project_address, builder_name, subdivision")
      .eq("company_id", companyId)
      .is("deleted_at", null),
    supabase
      .from("jobs")
      .select(
        "id, title, scheduled_completion, is_completed, project_id, superintendent, price_cents",
      )
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .not("scheduled_completion", "is", null)
      .order("scheduled_completion", { ascending: true }),
  ]);

  const firstError = projectsRes.error ?? jobsRes.error;
  if (firstError) {
    return (
      <div className="space-y-6">
        <BreadcrumbSetter crumbs={[{ label: "Calendar", href: "/calendar" }]} />
        <div className="rounded-lg border p-6 text-sm text-muted-foreground">
          Failed to load calendar: {firstError.message}
        </div>
      </div>
    );
  }

  const projects = (projectsRes.data ?? []) as ProjectRow[];
  const projectMap = new Map(projects.map((project) => [project.id, project]));

  const jobs = ((jobsRes.data ?? []) as JobRow[])
    .filter((job) => Boolean(job.scheduled_completion))
    .map((job) => ({
      id: job.id,
      title: job.title,
      scheduled_completion: job.scheduled_completion!,
      is_completed: job.is_completed,
      project_id: job.project_id,
      superintendent: job.superintendent,
      price_cents: job.price_cents ?? null,
      project_address:
        projectMap.get(job.project_id)?.project_address ?? "Unknown project",
      builder_name: projectMap.get(job.project_id)?.builder_name ?? null,
      subdivision: projectMap.get(job.project_id)?.subdivision ?? null,
    })) as CalendarPageJob[];
  const todayKey = format(new Date(), "yyyy-MM-dd");

  return (
    <div className="space-y-6">
      <BreadcrumbSetter crumbs={[{ label: "Calendar", href: "/calendar" }]} />
      <JobsCalendarPageClient jobs={jobs} todayKey={todayKey} />
    </div>
  );
}
