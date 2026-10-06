// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { getActiveCompanyId } from "@/lib/active-company";
import { createClient } from "@/lib/supabase/server";
import { addProjectNote, deleteProjectNote } from "@/app/(jobsyte-app)/projects/[id]/note-actions";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/active-company", () => ({ getActiveCompanyId: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

function lookup(data: object | null) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.is.mockReturnValue(query);
  return query;
}

describe("addProjectNote", () => {
  const membership = lookup({ company_id: "company-1" });
  const project = lookup({ id: "project-1" });
  const job = lookup({ id: "job-1" });
  const deleteQuery = {
    eq: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: "note-1" }, error: null }),
  };
  deleteQuery.eq.mockReturnValue(deleteQuery);
  deleteQuery.select.mockReturnValue(deleteQuery);
  const notes = {
    insert: vi.fn().mockResolvedValue({ error: null }),
    delete: vi.fn().mockReturnValue(deleteQuery),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    membership.maybeSingle.mockResolvedValue({ data: { company_id: "company-1" }, error: null });
    project.maybeSingle.mockResolvedValue({ data: { id: "project-1" }, error: null });
    job.maybeSingle.mockResolvedValue({ data: { id: "job-1" }, error: null });
    notes.insert.mockResolvedValue({ error: null });
    notes.delete.mockReturnValue(deleteQuery);
    deleteQuery.maybeSingle.mockResolvedValue({ data: { id: "note-1" }, error: null });
    vi.mocked(getActiveCompanyId).mockResolvedValue("company-1");
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }) },
      from: vi.fn((table: string) => ({
        company_members: membership,
        projects: project,
        jobs: job,
        project_notes: notes,
      })[table as "company_members" | "projects" | "jobs" | "project_notes"]),
    } as never);
  });

  it("saves a project note with the authenticated author and refreshes the page", async () => {
    expect(await addProjectNote("project-1", null, "  Site access changed  ")).toEqual({ ok: true });
    expect(notes.insert).toHaveBeenCalledWith({
      company_id: "company-1",
      project_id: "project-1",
      job_id: null,
      author_id: "user-1",
      body: "Site access changed",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/projects/project-1");
  });

  it("rejects a job note when the job is outside this project", async () => {
    job.maybeSingle.mockResolvedValue({ data: null, error: null });

    expect(await addProjectNote("project-1", "job-2", "Check framing")).toEqual({
      ok: false,
      message: "Job not found in this project.",
    });
    expect(job.eq).toHaveBeenCalledWith("project_id", "project-1");
    expect(notes.insert).not.toHaveBeenCalled();
  });

  it("saves a note for a job in the selected project", async () => {
    expect(await addProjectNote("project-1", "job-1", "Check framing")).toEqual({ ok: true });
    expect(job.eq).toHaveBeenCalledWith("project_id", "project-1");
    expect(notes.insert).toHaveBeenCalledWith(expect.objectContaining({
      project_id: "project-1",
      job_id: "job-1",
      body: "Check framing",
    }));
  });

  it("rejects users outside the active company", async () => {
    membership.maybeSingle.mockResolvedValue({ data: null, error: null });

    expect((await addProjectNote("project-1", null, "Check access")).ok).toBe(false);
    expect(notes.insert).not.toHaveBeenCalled();
  });

  it("rejects empty and oversized notes before contacting the database", async () => {
    expect((await addProjectNote("project-1", null, "   ")).ok).toBe(false);
    expect((await addProjectNote("project-1", null, "a".repeat(5001))).ok).toBe(false);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("deletes only the authenticated author's note in the selected project", async () => {
    expect(await deleteProjectNote("project-1", "note-1")).toEqual({ ok: true });
    expect(deleteQuery.eq).toHaveBeenCalledWith("id", "note-1");
    expect(deleteQuery.eq).toHaveBeenCalledWith("project_id", "project-1");
    expect(deleteQuery.eq).toHaveBeenCalledWith("company_id", "company-1");
    expect(deleteQuery.eq).toHaveBeenCalledWith("author_id", "user-1");
    expect(revalidatePath).toHaveBeenCalledWith("/projects/project-1");
  });

  it("does not report success when the author cannot delete the note", async () => {
    deleteQuery.maybeSingle.mockResolvedValue({ data: null, error: null });

    expect(await deleteProjectNote("project-1", "someone-elses-note")).toEqual({
      ok: false,
      message: "Note not found or cannot be deleted.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects deletion outside the active company", async () => {
    membership.maybeSingle.mockResolvedValue({ data: null, error: null });

    expect((await deleteProjectNote("project-1", "note-1")).ok).toBe(false);
    expect(notes.delete).not.toHaveBeenCalled();
  });
});
