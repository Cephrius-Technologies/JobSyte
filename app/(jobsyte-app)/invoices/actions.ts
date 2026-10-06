"use server";

// Onboarding: invoice create/edit/delete logic. The large client flows are in
// `components/invoices/create-invoice-dialog.tsx`,
// `components/invoices/create-invoice-by-builder.tsx`, and
// `components/invoices/edit-invoice-dialog.tsx`.
import { createClient } from "@/lib/supabase/server";
import { getActiveCompanyId } from "@/lib/active-company";
import { resolveInvoiceDueDate } from "@/lib/settings/preferences";
import { getProjectStreetTitle } from "@/components/projects/project-location";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

function formatInvoiceNumber() {
  const d = new Date();
  const ymd = d.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `INV-${ymd}-${rand}`;
}

function parsePriceToCents(input: string) {
  const cleaned = input.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num * 100);
}

export async function createInvoiceForBuilder(formData: FormData) {
  const supabase = createClient();

  const {
    data: { user },
    error: userError,
  } = await (await supabase).auth.getUser();

  if (userError || !user) redirect("/login");

  const contractor_name = String(formData.get("contractor_name") || "").trim();
  const contractor_address = String(
    formData.get("contractor_address") || "",
  ).trim();
  const contractor_phone = String(
    formData.get("contractor_phone") || "",
  ).trim();

  const bill_to_name = String(formData.get("bill_to_name") || "").trim();
  const bill_to_address = String(formData.get("bill_to_address") || "").trim();

  const invoice_date = String(formData.get("invoice_date") || "").trim(); // yyyy-mm-dd
  const due_date_raw = String(formData.get("due_date") || "").trim(); // optional

  const builder_id = String(formData.get("builder_id") || "").trim();
  const jobIds = formData.getAll("job_ids").map(String).filter(Boolean);

  if (!contractor_name)
    return { ok: false, message: "Contractor company name is required." };
  if (!bill_to_name)
    return { ok: false, message: "Builder name (bill to) is required." };
  if (!bill_to_address)
    return { ok: false, message: "Billing address is required." };
  if (!invoice_date) return { ok: false, message: "Invoice date is required." };
  if (!builder_id) return { ok: false, message: "Builder is required." };
  if (jobIds.length === 0)
    return { ok: false, message: "Select at least one completed job." };

  const due_date = resolveInvoiceDueDate(
    invoice_date,
    due_date_raw,
    user.user_metadata,
  );

  const invoice_number = formatInvoiceNumber();
  const companyId = await getActiveCompanyId();
  if (!companyId) return { ok: false, message: "No active company found." };

  // PostgreSQL functions run inside the caller's transaction. The RPC locks
  // and revalidates the selected jobs, creates the invoice and snapshots, and
  // updates the jobs as one atomic operation.
  const { data: invoiceId, error: createError } = await (await supabase).rpc(
    "create_invoice_for_builder_atomic",
    {
      p_company_id: companyId,
      p_builder_id: builder_id,
      p_invoice_number: invoice_number,
      p_invoice_date: invoice_date,
      p_due_date: due_date || null,
      p_contractor_name: contractor_name,
      p_contractor_address: contractor_address,
      p_contractor_phone: contractor_phone,
      p_bill_to_name: bill_to_name,
      p_bill_to_address: bill_to_address,
      p_job_ids: jobIds,
    },
  );

  if (createError || !invoiceId) {
    return {
      ok: false,
      message: createError?.message ?? "Failed to create invoice.",
    };
  }

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);

  return { ok: true, invoiceId: invoiceId as string };
}

export async function deleteInvoice(invoiceId: string) {
  const supabase = createClient();

  const {
    data: { user },
    error: userError,
  } = await (await supabase).auth.getUser();

  if (userError || !user) return { ok: false, message: "Session Expired." };

  const { data: invoice, error: invoiceCheckErr } = await (await supabase)
    .from("invoices")
    .select("id")
    .eq("id", invoiceId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (invoiceCheckErr) return { ok: false, message: invoiceCheckErr.message };
  if (!invoice) return { ok: false, message: "Invoice not found." };

  // Fetch all job_ids tied to this invoice before deleting it.
  const { data: items } = await (await supabase)
    .from("invoice_items")
    .select("job_id")
    .eq("invoice_id", invoiceId);

  const allJobIds = (items ?? [])
    .map((i) => i.job_id)
    .filter((id): id is string => Boolean(id));

  // Soft-delete the invoice.
  const { error } = await (await supabase)
    .from("invoices")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", invoiceId)
    .eq("user_id", user.id)
    .is("deleted_at", null);

  if (error) {
    return { ok: false, message: error.message };
  }

  // Hard-delete all invoice_items rows for this invoice.
  const { error: deleteItemsError } = await (await supabase)
    .from("invoice_items")
    .delete()
    .eq("invoice_id", invoiceId);

  if (deleteItemsError) {
    return { ok: false, message: deleteItemsError.message };
  }

  // Reset all associated jobs back to plain "completed" status —
  // clear both is_invoiced and is_paid so they appear as just completed
  // and can be added to a new invoice.
  if (allJobIds.length > 0) {
    const { error: resetJobsError } = await (await supabase)
      .from("jobs")
      .update({ is_invoiced: false, is_paid: false, paid_at: null })
      .in("id", allJobIds);

    if (resetJobsError) {
      return { ok: false, message: resetJobsError.message };
    }
  }

  revalidatePath("/invoices", "layout");
  revalidatePath("/projects", "layout");

  return { ok: true };
}


export async function editInvoice(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return { ok: false, message: "Session expired." };

  const invoiceId = String(formData.get("invoice_id") || "").trim();
  const contractor_name = String(formData.get("contractor_name") || "").trim();
  const contractor_address = String(formData.get("contractor_address") || "").trim();
  const contractor_phone = String(formData.get("contractor_phone") || "").trim();
  const bill_to_name = String(formData.get("bill_to_name") || "").trim();
  const bill_to_address = String(formData.get("bill_to_address") || "").trim();
  const invoice_date = String(formData.get("invoice_date") || "").trim();
  const due_date = String(formData.get("due_date") || "").trim();
  const itemIds = formData.getAll("item_id").map((value) => String(value).trim());
  const itemTitles = formData
    .getAll("item_title")
    .map((value) => String(value).trim());
  const itemPrices = formData
    .getAll("item_price")
    .map((value) => String(value).trim());
  const itemProjectAddresses = formData
    .getAll("item_project_address")
    .map((value) => String(value).trim());
  const itemSubdivisions = formData
    .getAll("item_subdivision")
    .map((value) => String(value).trim());
  const itemBuilders = formData
    .getAll("item_builder_name")
    .map((value) => String(value).trim());

  if (!invoiceId) return { ok: false, message: "Invoice id is required." };
  if (!contractor_name) return { ok: false, message: "Contractor name is required." };
  if (!bill_to_name) return { ok: false, message: "Bill to name is required." };
  if (!bill_to_address) return { ok: false, message: "Bill to address is required." };
  if (!invoice_date) return { ok: false, message: "Invoice date is required." };
  if (itemIds.length === 0) {
    return { ok: false, message: "At least one invoice item is required." };
  }
  if (
    itemTitles.length !== itemIds.length ||
    itemPrices.length !== itemIds.length ||
    itemProjectAddresses.length !== itemIds.length ||
    itemSubdivisions.length !== itemIds.length ||
    itemBuilders.length !== itemIds.length
  ) {
    return { ok: false, message: "Invoice items payload is invalid." };
  }

  const { data: existing, error: existingErr } = await supabase
    .from("invoices")
    .select("id")
    .eq("id", invoiceId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (existingErr) return { ok: false, message: existingErr.message };
  if (!existing) return { ok: false, message: "Invoice not found." };

  const normalizedItems = itemIds.map((id, index) => {
    const title = itemTitles[index] ?? "";
    const priceRaw = itemPrices[index] ?? "";
    const projectAddress = itemProjectAddresses[index] ?? "";
    const subdivisionRaw = itemSubdivisions[index] ?? "";
    const builderNameRaw = itemBuilders[index] ?? "";
    const priceCents = parsePriceToCents(priceRaw);
    return {
      id,
      title,
      priceRaw,
      priceCents,
      projectAddress,
      subdivisionRaw,
      builderNameRaw,
    };
  });

  for (const item of normalizedItems) {
    if (!item.id) return { ok: false, message: "Invoice item id is required." };
    if (!item.title) return { ok: false, message: "Invoice item title is required." };
    if (item.priceCents === null) {
      return { ok: false, message: `Enter a valid price for "${item.title}".` };
    }
  }

  const { data: existingItems, error: itemsErr } = await supabase
    .from("invoice_items")
    .select("id")
    .eq("invoice_id", invoiceId);

  if (itemsErr) return { ok: false, message: itemsErr.message };

  const existingItemIds = new Set(
    (existingItems ?? []).map((item) => String(item.id)),
  );
  const submittedItemIds = new Set(normalizedItems.map((item) => item.id));
  for (const item of normalizedItems) {
    if (!existingItemIds.has(item.id)) {
      return { ok: false, message: "One or more invoice items were not found." };
    }
  }

  const idsToDelete = Array.from(existingItemIds).filter(
    (id) => !submittedItemIds.has(id),
  );

  const subtotal_cents = normalizedItems.reduce(
    (sum, item) => sum + (item.priceCents ?? 0),
    0,
  );

  const { error: updateErr } = await supabase
    .from("invoices")
    .update({
      contractor_name,
      contractor_address: contractor_address || null,
      contractor_phone: contractor_phone || null,
      bill_to_name,
      bill_to_address,
      invoice_date,
      due_date: due_date || null,
      subtotal_cents,
    })
    .eq("id", invoiceId)
    .eq("user_id", user.id)
    .is("deleted_at", null);

  if (updateErr) return { ok: false, message: updateErr.message };

  if (idsToDelete.length > 0) {
    const { error: deleteItemsErr } = await supabase
      .from("invoice_items")
      .delete()
      .eq("invoice_id", invoiceId)
      .in("id", idsToDelete);

    if (deleteItemsErr) return { ok: false, message: deleteItemsErr.message };
  }

  for (const item of normalizedItems) {
    const subdivisionNameRawSnapshot =
      item.subdivisionRaw.trim() || "Unassigned";
    const builderNameSnapshot = item.builderNameRaw.trim() || "Unknown";
    const projectAddressSnapshot = item.projectAddress.trim() || "—";

    const { error: updateItemErr } = await supabase
      .from("invoice_items")
      .update({
        job_title_snapshot: item.title,
        job_price_cents_snapshot: item.priceCents,
        project_address_snapshot: projectAddressSnapshot,
        subdivision_name_raw_snapshot: subdivisionNameRawSnapshot,
        builder_name_snapshot: builderNameSnapshot,
      })
      .eq("invoice_id", invoiceId)
      .eq("id", item.id);

    if (updateItemErr) return { ok: false, message: updateItemErr.message };
  }

  return { ok: true };
}

//  invoice line-item snapshots

// // const project_address_snapshot = String(formData.get("project_address_snapshot") || "").trim();
// const builder_name_snapshot = String(formData.get("builder_name_snapshot") || "").trim();
// const subdivision_snapshot = String(formData.get("subdivision_snapshot") || "").trim();

// if (project_address_snapshot || builder_name_snapshot || subdivision_snapshot) {
//   const { error: itemsErr } = await supabase
//     .from("invoice_items")
//     .update({
//       ...(project_address_snapshot ? { project_address_snapshot } : {}),
//       ...(builder_name_snapshot ? { builder_name_snapshot } : {}),
//       // use ONE key based on your schema:
//       // subdivision_name_raw_snapshot OR subdivision_snapshot
//       ...(subdivision_snapshot ? { subdivision_name_raw_snapshot: subdivision_snapshot } : {}),
//     })
//     .eq("invoice_id", invoiceId);

//   if (itemsErr) return { ok: false, message: itemsErr.message };
// }

/**
 * Fully refactored invoice edit:
 * - Updates header fields (contractor, bill-to, dates)
 * - Removes items not in keepItemIds (un-marks those jobs as invoiced)
 * - Adds new jobs from addJobIds (marks them as invoiced)
 * - Recalculates subtotal automatically
 */
export async function editInvoiceWithJobs({
  invoiceId,
  contractorName,
  contractorAddress,
  contractorPhone,
  billToName,
  billToAddress,
  invoiceDate,
  dueDate,
  keepItemIds,
  addJobIds,
}: {
  invoiceId: string;
  contractorName: string;
  contractorAddress: string;
  contractorPhone: string;
  billToName: string;
  billToAddress: string;
  invoiceDate: string;
  dueDate: string;
  keepItemIds: string[];
  addJobIds: string[];
}) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) redirect("/login");

  // Verify ownership
  const { data: invoice, error: invoiceFetchErr } = await supabase
    .from("invoices")
    .select("id")
    .eq("id", invoiceId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (invoiceFetchErr) return { ok: false, message: invoiceFetchErr.message };
  if (!invoice) return { ok: false, message: "Invoice not found." };

  // Get current items
  const { data: currentItems, error: currentItemsErr } = await supabase
    .from("invoice_items")
    .select("id, job_id, is_paid")
    .eq("invoice_id", invoiceId);

  if (currentItemsErr) return { ok: false, message: currentItemsErr.message };

  const keepSet = new Set(keepItemIds);
  const itemsToRemove = (currentItems ?? []).filter(
    (item) => !keepSet.has(item.id) && !item.is_paid, // never remove paid items
  );

  // Remove items + un-mark their jobs as invoiced
  if (itemsToRemove.length > 0) {
    const removeIds = itemsToRemove.map((i) => i.id);
    const removeJobIds = itemsToRemove
      .map((i) => i.job_id)
      .filter((id): id is string => Boolean(id));

    const { error: deleteItemsErr } = await supabase
      .from("invoice_items")
      .delete()
      .in("id", removeIds);

    if (deleteItemsErr) return { ok: false, message: deleteItemsErr.message };

    if (removeJobIds.length > 0) {
      await supabase
        .from("jobs")
        .update({ is_invoiced: false })
        .in("id", removeJobIds);
    }
  }

  // Add new jobs
  if (addJobIds.length > 0) {
    const { data: newJobs, error: newJobsErr } = await supabase
      .from("jobs")
      .select("id, title, price_cents, project_id, is_completed, is_paid, paid_at")
      .in("id", addJobIds)
      .is("deleted_at", null);

    if (newJobsErr) return { ok: false, message: newJobsErr.message };

    const completedJobs = (newJobs ?? []).filter((j) => j.is_completed);
    const projectIds = Array.from(
      new Set(completedJobs.map((j) => j.project_id)),
    );

    const { data: projects, error: projectsErr } = await supabase
      .from("projects")
      .select("id, project_address, builder_name, subdivision")
      .in("id", projectIds);

    if (projectsErr) return { ok: false, message: projectsErr.message };

    const projectMap = new Map((projects ?? []).map((p) => [p.id, p]));

    const newItems = completedJobs.map((j) => {
      const p = projectMap.get(j.project_id);
      const itemPaidAt = new Date().toISOString();
      return {
        invoice_id: invoiceId,
        job_id: j.id,
        project_id_snapshot: j.project_id,
        project_address_snapshot: p ? getProjectStreetTitle(p) : "",
        subdivision_name_raw_snapshot:
          (p?.subdivision ?? "").trim() || "Unassigned",
        builder_name_snapshot: p?.builder_name ?? "",
        job_title_snapshot: j.title,
        job_price_cents_snapshot: j.price_cents,
        // Preserve payment state when a completed job was paid from Projects
        // before being added to this invoice.
        is_paid: j.is_paid === true,
        paid_at: j.is_paid === true ? j.paid_at ?? itemPaidAt : null,
      };
    });

    if (newItems.length > 0) {
      const { error: insertItemsErr } = await supabase
        .from("invoice_items")
        .upsert(newItems, { onConflict: "job_id" });

      if (insertItemsErr) return { ok: false, message: insertItemsErr.message };

      await supabase
        .from("jobs")
        .update({ is_invoiced: true })
        .in("id", addJobIds);
    }
  }

  // Recalculate subtotal from all remaining items
  const { data: allItems, error: allItemsErr } = await supabase
    .from("invoice_items")
    .select("job_price_cents_snapshot, is_paid")
    .eq("invoice_id", invoiceId);

  if (allItemsErr) return { ok: false, message: allItemsErr.message };

  const subtotalCents = (allItems ?? []).reduce(
    (sum, i) => sum + (i.job_price_cents_snapshot ?? 0),
    0,
  );
  const allItemsPaid =
    (allItems ?? []).length > 0 && (allItems ?? []).every((i) => i.is_paid);
  const paidAt = new Date().toISOString();

  // Update header
  const { error: updateErr } = await supabase
    .from("invoices")
    .update({
      contractor_name: contractorName,
      contractor_address: contractorAddress || null,
      contractor_phone: contractorPhone || null,
      bill_to_name: billToName,
      bill_to_address: billToAddress,
      invoice_date: invoiceDate,
      due_date: dueDate || null,
      subtotal_cents: subtotalCents,
      is_paid: allItemsPaid,
      paid_at: allItemsPaid ? paidAt : null,
    })
    .eq("id", invoiceId)
    .eq("user_id", user.id);

  if (updateErr) return { ok: false, message: updateErr.message };

  revalidatePath("/invoices", "layout");
  revalidatePath("/projects", "layout");

  return { ok: true };
}
