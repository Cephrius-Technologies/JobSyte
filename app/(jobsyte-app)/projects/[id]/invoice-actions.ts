"use server";

import { createClient } from "@/lib/supabase/server";
import { getActiveCompanyId } from "@/lib/active-company";
import { resolveInvoiceDueDate } from "@/lib/settings/preferences";
import { getProjectStreetTitle } from "@/components/projects/project-location";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

function formatInvoiceNumber() {
  // MVP-safe unique-ish number (no DB sequence needed)
  const d = new Date();
  const ymd = d.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `INV-${ymd}-${rand}`;
}

export async function createInvoice(projectId: string, formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await (await supabase).auth.getUser();
  if (userError || !user) redirect("/login");

  // Contractor info (snapshots)
  const contractor_name = String(formData.get("contractor_name") || "").trim();
  const contractor_address = String(
    formData.get("contractor_address") || "",
  ).trim();
  const contractor_phone = String(
    formData.get("contractor_phone") || "",
  ).trim();

  // Bill-to
  const bill_to_name = String(formData.get("bill_to_name") || "").trim();
  const bill_to_address = String(formData.get("bill_to_address") || "").trim();

  // Invoice dates
  const invoice_date = String(formData.get("invoice_date") || "").trim(); // yyyy-mm-dd
  const due_date_raw = String(formData.get("due_date") || "").trim(); // optional

  // Selected job ids
  const jobIds = formData.getAll("job_ids").map(String).filter(Boolean);

  if (!contractor_name)
    return { ok: false, message: "Contractor company name is required." };
  if (!bill_to_name)
    return { ok: false, message: "Builder name (bill to) is required." };
  if (!bill_to_address)
    return { ok: false, message: "Billing address is required." };
  if (!invoice_date) return { ok: false, message: "Invoice date is required." };
  if (jobIds.length === 0)
    return { ok: false, message: "Select at least one completed job." };

  const due_date = resolveInvoiceDueDate(
    invoice_date,
    due_date_raw,
    user.user_metadata,
  );

  // Pull project + jobs for snapshots and totals
  const { data: project, error: projectErr } = await (await supabase)
    .from("projects")
    .select("id, project_address, builder_name, subdivision")
    .eq("id", projectId)
    .single();

  if (projectErr || !project)
    return { ok: false, message: "Project not found." };

  // Fetch selected jobs (ensure they belong to this project and are completed)
  const { data: jobs, error: jobsErr } = await (await supabase)
    .from("jobs")
    .select("id, title, price_cents, is_completed, is_paid, paid_at")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .in("id", jobIds);

  if (jobsErr || !jobs)
    return { ok: false, message: jobsErr?.message ?? "Failed to fetch jobs." };

  const selected = jobs.filter((j) => j.is_completed);
  if (selected.length !== jobIds.length) {
    return { ok: false, message: "Only completed jobs can be invoiced." };
  }

  const subtotal_cents = selected.reduce(
    (sum, j) => sum + (j.price_cents ?? 0),
    0,
  );

  // Create invoice
  const invoice_number = formatInvoiceNumber();
  const paidAt = new Date().toISOString();
  const allSelectedJobsPaid =
    selected.length > 0 && selected.every((job) => job.is_paid === true);

  const companyId = await getActiveCompanyId();
  if (!companyId) return { ok: false, message: "No active company found." };

  const { data: invoice, error: invErr } = await (
    await supabase
  )
    .from("invoices")
    .insert({
      project_id: projectId,
      user_id: user.id,
      company_id: companyId,
      invoice_number,
      invoice_date,
      due_date,
      contractor_name,
      contractor_address: contractor_address || null,
      contractor_phone: contractor_phone || null,
      bill_to_name,
      bill_to_address,
      subtotal_cents,
      is_paid: allSelectedJobsPaid,
      paid_at: allSelectedJobsPaid ? paidAt : null,
    })
    .select("id")
    .single();

  if (invErr || !invoice)
    return {
      ok: false,
      message: invErr?.message ?? "Failed to create invoice.",
    };


  // Insert invoice items (snapshots)
  const items = selected.map((j) => ({
    invoice_id: invoice.id,
    job_id: j.id,
    project_id_snapshot: project.id,
    project_address_snapshot: getProjectStreetTitle(project),
    subdivision_name_raw_snapshot:
      (project.subdivision ?? "").trim() || "Unassigned",
    builder_name_snapshot: project.builder_name,
    job_title_snapshot: j.title,
    job_price_cents_snapshot: j.price_cents,

    // A job can be paid from Projects before invoicing. Carry that state onto
    // the new invoice item so Invoices immediately matches the job status.
    is_paid: j.is_paid === true,
    paid_at: j.is_paid === true ? j.paid_at ?? paidAt : null,
  }));

  const { error: itemsErr } = await (await supabase)
    .from("invoice_items")
    .upsert(items, { onConflict: "job_id" });

  if (itemsErr) {
    return { ok: false, message: itemsErr.message };
  }

  // Mark all jobs on this invoice as invoiced
  await (await supabase)
    .from("jobs")
    .update({ is_invoiced: true })
    .in("id", jobIds);

  revalidatePath(`/invoices/${invoice.id}`);
  return { ok: true, invoiceId: invoice.id as string };
}
