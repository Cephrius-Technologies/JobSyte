"use server";

// Onboarding: job CRUD for a single project. The Add/Edit Job dialogs live in
// `components/jobs/*`; project-level list and import actions live one directory
// up in `app/(jobsyte-app)/(app)/projects/actions.ts`.
import { createClient } from "@/lib/supabase/server";
import { getActiveCompanyId } from "@/lib/active-company";
import { redirect } from "next/navigation";

type ProjectStatus = "not-started" | "active" | "completed";

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function toTitleCase(value: string) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return "";

  return normalized.replace(/[A-Za-z]+/g, (segment) => {
    return segment[0].toUpperCase() + segment.slice(1).toLowerCase();
  });
}

function parsePriceToCents(input: string) {
  // accepts "1200"  "1200.50" "$1,200.50"  " $ 1,200 "
  const cleaned = input.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num * 100);
}

function isMissingStatusColumnError(message: string | undefined) {
  const normalized = (message ?? "").toLowerCase();
  return normalized.includes("column") && normalized.includes("status");
}

async function syncProjectStatus(projectId: string) {
  const supabase = await createClient();
  const [allJobsRes, completedJobsRes] = await Promise.all([
    supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .is("deleted_at", null),
    supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .eq("is_completed", true),
  ]);

  if (allJobsRes.error) {
    return { ok: false, message: allJobsRes.error.message };
  }

  if (completedJobsRes.error) {
    return { ok: false, message: completedJobsRes.error.message };
  }

  const totalJobs = allJobsRes.count ?? 0;
  const completedJobs = completedJobsRes.count ?? 0;

  let status: ProjectStatus = "active";
  if (totalJobs === 0) status = "not-started";
  else if (completedJobs === totalJobs) status = "completed";

  const { error: projectUpdateError } = await supabase
    .from("projects")
    .update({ status })
    .eq("id", projectId);

  if (
    projectUpdateError &&
    !isMissingStatusColumnError(projectUpdateError.message)
  ) {
    return { ok: false, message: projectUpdateError.message };
  }

  return { ok: true };
}

export async function createJob(projectId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) redirect("/login");

  const title = toTitleCase(String(formData.get("title") || ""));
  const priceRaw = String(formData.get("price") || "").trim();
  const scheduled_completion = String(
    formData.get("scheduled_completion") || "",
  ).trim();
  const scheduledStart = String(formData.get("scheduled_start") || "").trim() || null;
  const superintendentRaw = toTitleCase(
    String(formData.get("superintendent") || ""),
  );
  const completedByTypeRaw = String(formData.get("completed_by_type") || "")
    .trim()
    .toLowerCase();
  const completedByIdRaw = String(formData.get("completed_by_id") || "").trim();
  const completedByNameRaw = toTitleCase(
    String(formData.get("completed_by_name") || ""),
  );
  const superintendent = superintendentRaw || null;
  const scheduledCompletion = scheduled_completion || null;
  const completedByType =
    completedByTypeRaw === "employee" || completedByTypeRaw === "crew"
      ? completedByTypeRaw
      : null;
  const completedById = completedByIdRaw || null;
  const completedByName = completedByNameRaw || null;

  if (!title) return { ok: false, message: "Job title is required." };

  const price_cents = parsePriceToCents(priceRaw);
  if (price_cents === null)
    return { ok: false, message: "Enter a valid price." };

  const companyId = await getActiveCompanyId();
  if (!companyId) return { ok: false, message: "No active company found." };

  const { error } = await supabase.from("jobs").insert({
    project_id: projectId,
    company_id: companyId,
    title,
    price_cents,
    scheduled_start: scheduledStart,
    scheduled_completion: scheduledCompletion,
    superintendent,
    completed_by_type: completedByType,
    completed_by_id: completedById,
    completed_by_name: completedByName,
  });

  if (error) return { ok: false, message: error.message };

  const syncStatus = await syncProjectStatus(projectId);
  if (!syncStatus.ok) return syncStatus;

  return { ok: true };
}

export async function toggleJobComplete(jobId: string, nextCompleted: boolean) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) redirect("/login");

  const { data, error } = await supabase
    .from("jobs")
    .update({
      is_completed: nextCompleted,
      completed_at: nextCompleted ? new Date().toISOString() : null,
    })
    .eq("id", jobId)
    .is("deleted_at", null)
    .select("project_id")
    .maybeSingle();

  if (error) return { ok: false, message: error.message };
  if (!data?.project_id) return { ok: false, message: "Job not found." };

  const syncStatus = await syncProjectStatus(data.project_id);
  if (!syncStatus.ok) return syncStatus;

  return { ok: true };
}

export async function editJob(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) redirect("/login");

  const jobId = String(formData.get("job_id") || "").trim();
  const title = toTitleCase(String(formData.get("title") || ""));
  const priceRaw = String(formData.get("price") || "").trim();
  const scheduled_completion = String(
    formData.get("scheduled_completion") || "",
  ).trim();
  const scheduledStart = String(formData.get("scheduled_start") || "").trim() || null;
  const superintendentRaw = toTitleCase(
    String(formData.get("superintendent") || ""),
  );
  const completedByTypeRaw = String(formData.get("completed_by_type") || "")
    .trim()
    .toLowerCase();
  const completedByIdRaw = String(formData.get("completed_by_id") || "").trim();
  const completedByNameRaw = toTitleCase(
    String(formData.get("completed_by_name") || ""),
  );
  const superintendent = superintendentRaw || null;
  const scheduledCompletion = scheduled_completion || null;
  const completedByType =
    completedByTypeRaw === "employee" || completedByTypeRaw === "crew"
      ? completedByTypeRaw
      : null;
  const completedById = completedByIdRaw || null;
  const completedByName = completedByNameRaw || null;

  if (!jobId) return { ok: false, message: "Job id is required." };
  if (!title) return { ok: false, message: "Job title is required." };

  const price_cents = parsePriceToCents(priceRaw);
  if (price_cents === null)
    return { ok: false, message: "Enter a valid price." };

  const { error } = await supabase
    .from("jobs")
    .update({
      title,
      price_cents,
      scheduled_start: scheduledStart,
      scheduled_completion: scheduledCompletion,
      superintendent,
      completed_by_type: completedByType,
      completed_by_id: completedById,
      completed_by_name: completedByName,
    })
    .eq("id", jobId)
    .is("deleted_at", null);

  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function deleteJob(jobId: string) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) redirect("/login");

  const { data, error } = await supabase
    .from("jobs")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", jobId)
    .is("deleted_at", null)
    .select("id, project_id")
    .maybeSingle();

  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: true, message: "Job already deleted." };

  const syncStatus = await syncProjectStatus(data.project_id);
  if (!syncStatus.ok) return syncStatus;

  return { ok: true };
}
