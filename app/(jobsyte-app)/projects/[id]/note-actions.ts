"use server";

import { revalidatePath } from "next/cache";
import { getActiveCompanyId } from "@/lib/active-company";
import { MAX_PROJECT_NOTE_LENGTH } from "@/lib/projects/notes";
import { createClient } from "@/lib/supabase/server";

export async function addProjectNote(projectId: string, jobId: string | null, body: string) {
  const content = body.trim();
  if (!projectId.trim()) return { ok: false, message: "Project is required." };
  if (!content) return { ok: false, message: "Enter a note before saving." };
  if (content.length > MAX_PROJECT_NOTE_LENGTH) {
    return { ok: false, message: `Notes must be ${MAX_PROJECT_NOTE_LENGTH} characters or fewer.` };
  }

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { ok: false, message: "Session expired. Please log in again." };

  const companyId = await getActiveCompanyId();
  if (!companyId) return { ok: false, message: "No active company found." };

  const { data: membership, error: membershipError } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("company_id", companyId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipError || !membership) return { ok: false, message: "You do not have access to this company." };

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .maybeSingle();
  if (projectError || !project) return { ok: false, message: "Project not found." };

  if (jobId !== null) {
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id")
      .eq("id", jobId)
      .eq("project_id", projectId)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .maybeSingle();
    if (jobError || !job) return { ok: false, message: "Job not found in this project." };
  }

  const { error } = await supabase.from("project_notes").insert({
    company_id: companyId,
    project_id: projectId,
    job_id: jobId,
    author_id: user.id,
    body: content,
  });
  if (error) return { ok: false, message: "Could not save the note. Please try again." };

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function deleteProjectNote(projectId: string, noteId: string) {
  if (!projectId.trim() || !noteId.trim()) {
    return { ok: false, message: "Note not found." };
  }

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { ok: false, message: "Session expired. Please log in again." };

  const companyId = await getActiveCompanyId();
  if (!companyId) return { ok: false, message: "No active company found." };

  const { data: membership, error: membershipError } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("company_id", companyId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipError || !membership) {
    return { ok: false, message: "You do not have access to this company." };
  }

  const { data: deleted, error } = await supabase
    .from("project_notes")
    .delete()
    .eq("id", noteId)
    .eq("project_id", projectId)
    .eq("company_id", companyId)
    .eq("author_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, message: "Could not delete the note. Please try again." };
  if (!deleted) return { ok: false, message: "Note not found or cannot be deleted." };

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}
