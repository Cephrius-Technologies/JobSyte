"use server";

// Onboarding: company create/switch/delete actions. These complement the client
// company picker in `components/app-shell/company-switcher.tsx` and the active
// company cookie logic in `lib/company-context.ts`.
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type ActionResult =
  | { ok: true; companyId: string; message?: string }
  | { ok: false; message: string };

type DeleteResult =
  | { ok: true; message?: string; fallbackCompanyId: string | null }
  | { ok: false; message: string };

export async function createCompany(
  name: string,
  address?: string,
  phone?: string
): Promise<ActionResult> {
  // Verify the caller is authenticated (uses session cookies)
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, message: "Session expired. Please log in again." };
  }

  const trimmed = name.trim();
  if (!trimmed) {
    return { ok: false, message: "Company name is required." };
  }

  // Use the admin client to bypass RLS for the insert.
  // This is safe because we've already verified the user above.
  const admin = createAdminClient();

  // 1. Create the company
  const row: Record<string, string> = { name: trimmed };
  if (address?.trim()) row.address = address.trim();
  if (phone?.trim()) row.phone = phone.trim();

  const { data: company, error: companyError } = await admin
    .from("companies")
    .insert(row)
    .select("id")
    .single();

  if (companyError || !company) {
    return {
      ok: false,
      message: companyError?.message ?? "Failed to create company.",
    };
  }

  // 2. Add the current user as owner
  const { error: memberError } = await admin
    .from("company_members")
    .insert({
      company_id: company.id,
      user_id: user.id,
      role: "owner",
    });

  if (memberError) {
    return { ok: false, message: memberError.message };
  }

  return { ok: true, companyId: company.id };
}

export async function deleteCompany(companyId: string): Promise<DeleteResult> {
  // Verify the caller is authenticated
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, message: "Session expired. Please log in again." };
  }

  if (!companyId?.trim()) {
    return { ok: false, message: "Company ID is required." };
  }

  // Verify the user is an owner of this company
  const { data: membership } = await supabase
    .from("company_members")
    .select("role")
    .eq("company_id", companyId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return { ok: false, message: "You don't have access to this company." };
  }

  if (membership.role !== "owner") {
    return { ok: false, message: "Only the company owner can delete it." };
  }

  // Use admin client to bypass RLS for cascading deletes
  const admin = createAdminClient();

  // 1. Remove invoice items before their invoices or referenced jobs.
  // Process in batches because PostgREST caps the rows returned by a select.
  while (true) {
    const { data: invoices, error: loadInvoicesError } = await admin
      .from("invoices")
      .select("id")
      .eq("company_id", companyId)
      .limit(500);

    if (loadInvoicesError) {
      return { ok: false, message: `Failed to load invoices: ${loadInvoicesError.message}` };
    }

    const invoiceIds = (invoices ?? []).map((invoice) => invoice.id);
    if (invoiceIds.length === 0) break;

    const { error: itemsError } = await admin
      .from("invoice_items")
      .delete()
      .in("invoice_id", invoiceIds);

    if (itemsError) {
      return { ok: false, message: `Failed to delete invoice items: ${itemsError.message}` };
    }

    const { error: invoicesError } = await admin
      .from("invoices")
      .delete()
      .in("id", invoiceIds);

    if (invoicesError) {
      return { ok: false, message: `Failed to delete invoices: ${invoicesError.message}` };
    }
  }

  // 2. Get all project IDs for this company so we can delete their jobs
  const { data: projects, error: loadProjectsError } = await admin
    .from("projects")
    .select("id")
    .eq("company_id", companyId);

  if (loadProjectsError) {
    return { ok: false, message: `Failed to load projects: ${loadProjectsError.message}` };
  }

  const projectIds = (projects ?? []).map((p) => p.id);

  // 3. Delete jobs belonging to those projects
  if (projectIds.length > 0) {
    const { error: jobsError } = await admin
      .from("jobs")
      .delete()
      .in("project_id", projectIds);

    if (jobsError) {
      return { ok: false, message: `Failed to delete jobs: ${jobsError.message}` };
    }
  }

  // 4. Delete projects belonging to this company
  if (projectIds.length > 0) {
    const { error: projectsError } = await admin
      .from("projects")
      .delete()
      .eq("company_id", companyId);

    if (projectsError) {
      return { ok: false, message: `Failed to delete projects: ${projectsError.message}` };
    }
  }

  // 5. Delete company memberships
  const { error: membersError } = await admin
    .from("company_members")
    .delete()
    .eq("company_id", companyId);

  if (membersError) {
    return { ok: false, message: `Failed to remove members: ${membersError.message}` };
  }

  // 6. Delete the company itself
  const { error: companyError } = await admin
    .from("companies")
    .delete()
    .eq("id", companyId);

  if (companyError) {
    return { ok: false, message: `Failed to delete company: ${companyError.message}` };
  }

  // 7. Find a fallback company the user still belongs to
  const { data: remaining } = await admin
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  return {
    ok: true,
    message: "Company and all associated data deleted.",
    fallbackCompanyId: remaining?.company_id ?? null,
  };
}
