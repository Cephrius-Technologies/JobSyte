// Onboarding: payroll server page. It combines completed job assignments,
// employees, crews, and payments into the client model consumed by
// `components/payroll/payroll-page.tsx`.
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { BreadcrumbSetter } from "@/components/app-shell/breadcrumb-setter";
import { createClient } from "@/lib/supabase/server";
import { getActiveCompanyId } from "@/lib/active-company";
import {
  PayrollPageClient,
  type PayrollAssignment,
  type PayrollPayment,
} from "@/components/payroll/payroll-page";

function isMissingColumnError(message: string | undefined) {
  const normalized = (message ?? "").toLowerCase();
  return normalized.includes("column") && normalized.includes("does not exist");
}

export default async function PayrollPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) redirect("/login");

  const companyId = await getActiveCompanyId();
  if (!companyId) redirect("/login");

  const [jobsRes, projectsRes, employeesRes, crewsRes, paymentsRes] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, project_id, title, price_cents, is_completed, completed_at, completed_by_type, completed_by_id, completed_by_name")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .not("completed_by_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("projects")
      .select("id, project_address")
      .eq("company_id", companyId)
      .is("deleted_at", null),
    supabase
      .from("employees")
      .select("id, name")
      .eq("company_id", companyId)
      .is("deleted_at", null),
    supabase
      .from("crews")
      .select("id, name")
      .eq("company_id", companyId)
      .is("deleted_at", null),
    supabase
      .from("payments")
      .select("id, job_id, paid_to_type, paid_to_id, amount_cents, payment_method, reference_number, paid_at, refunded_at, refund_reason")
      .eq("company_id", companyId)
      .order("paid_at", { ascending: false })
      .limit(250),
  ]);

  const resolvedPaymentsRes =
    paymentsRes.error && isMissingColumnError(paymentsRes.error.message)
      ? await supabase
          .from("payments")
          .select("id, job_id, paid_to_type, paid_to_id, amount_cents, payment_method, reference_number, paid_at")
          .eq("company_id", companyId)
          .order("paid_at", { ascending: false })
          .limit(250)
      : paymentsRes;

  if (jobsRes.error) return <p className="text-sm text-destructive">{jobsRes.error.message}</p>;
  if (projectsRes.error) return <p className="text-sm text-destructive">{projectsRes.error.message}</p>;
  if (employeesRes.error) return <p className="text-sm text-destructive">{employeesRes.error.message}</p>;
  if (crewsRes.error) return <p className="text-sm text-destructive">{crewsRes.error.message}</p>;
  if (resolvedPaymentsRes.error) return <p className="text-sm text-destructive">{resolvedPaymentsRes.error.message}</p>;

  const projectAddressById = new Map((projectsRes.data ?? []).map((project) => [project.id, project.project_address]));
  const employeeNameById = new Map((employeesRes.data ?? []).map((employee) => [employee.id, employee.name]));
  const crewNameById = new Map((crewsRes.data ?? []).map((crew) => [crew.id, crew.name]));
  const jobById = new Map((jobsRes.data ?? []).map((job) => [job.id, job]));

  const assignments: PayrollAssignment[] = (jobsRes.data ?? []).map((job) => {
    const assignedType = job.completed_by_type === "crew" ? "crew" : "employee";
    const fallbackName = job.completed_by_name?.trim() || "Unassigned";
    const assigneeName =
      assignedType === "crew"
        ? crewNameById.get(job.completed_by_id ?? "") ?? fallbackName
        : employeeNameById.get(job.completed_by_id ?? "") ?? fallbackName;

    return {
      id: job.id,
      project_id: job.project_id,
      project_address: projectAddressById.get(job.project_id) ?? "Unknown project",
      title: job.title,
      price_cents: job.price_cents ?? 0,
      is_completed: Boolean(job.is_completed),
      completed_at: job.completed_at,
      completed_by_type: assignedType,
      completed_by_id: job.completed_by_id ?? "",
      completed_by_name: assigneeName,
    };
  });

  const payments: PayrollPayment[] = (resolvedPaymentsRes.data ?? []).map((payment) => {
    const paymentWithOptionalRefunds = payment as {
      refunded_at?: string | null;
      refund_reason?: string | null;
    };
    const relatedJob = jobById.get(payment.job_id);
    const assignedType = payment.paid_to_type === "crew" ? "crew" : "employee";
    const payeeName =
      assignedType === "crew"
        ? crewNameById.get(payment.paid_to_id ?? "") ?? "Crew"
        : employeeNameById.get(payment.paid_to_id ?? "") ?? "Employee";

    return {
      id: payment.id,
      job_id: payment.job_id,
      job_title: relatedJob?.title ?? "Unknown job",
      project_address: relatedJob?.project_id ? projectAddressById.get(relatedJob.project_id) ?? "Unknown project" : "Unknown project",
      paid_to_type: assignedType,
      paid_to_name: payeeName,
      amount_cents: payment.amount_cents,
      payment_method: payment.payment_method,
      reference_number: payment.reference_number,
      paid_at: payment.paid_at,
      refunded_at: paymentWithOptionalRefunds.refunded_at ?? null,
      refund_reason: paymentWithOptionalRefunds.refund_reason ?? null,
    };
  });

  return (
    <div className="space-y-6">
      <BreadcrumbSetter crumbs={[{ label: "Payroll", href: "/payroll" }]} />
      <PayrollPageClient
        assignments={assignments}
        payments={payments}
        todayKey={format(new Date(), "yyyy-MM-dd")}
      />
    </div>
  );
}
