// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JobNotesDialog, ProjectNotesCard } from "@/components/projects/project-notes";
import { addProjectNote, deleteProjectNote } from "@/app/(jobsyte-app)/projects/[id]/note-actions";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/app/(jobsyte-app)/projects/[id]/note-actions", () => ({
  addProjectNote: vi.fn(),
  deleteProjectNote: vi.fn(),
}));

describe("ProjectNotesCard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the note time in the device timezone", () => {
    vi.stubEnv("TZ", "America/Chicago");
    try {
      render(
        <ProjectNotesCard
          projectId="project-1"
          currentUserId="user-1"
          notes={[{
            id: "note-time",
            project_id: "project-1",
            job_id: null,
            author_id: "user-1",
            body: "Local time check",
            created_at: "2026-09-29T14:00:00Z",
          }]}
        />,
      );

      expect(screen.getByText(/Sep 29, 2026, 9:00 AM/)).toBeInTheDocument();
      expect(screen.queryByText(/UTC/)).not.toBeInTheDocument();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("shows previous notes and saves a new project note", async () => {
    vi.mocked(addProjectNote).mockResolvedValue({ ok: true });
    render(
      <ProjectNotesCard
        projectId="project-1"
        currentUserId="user-1"
        notes={[{
          id: "note-1",
          project_id: "project-1",
          job_id: null,
          author_id: "user-1",
          body: "Confirm delivery gate",
          created_at: "2026-09-29T14:00:00Z",
        }]}
      />,
    );

    expect(screen.getByText("Confirm delivery gate")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Add project note" }), {
      target: { value: "Bring site plans" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));

    await waitFor(() => expect(addProjectNote).toHaveBeenCalledWith("project-1", null, "Bring site plans"));
    expect(refresh).toHaveBeenCalled();
  });

  it("saves a note for the selected job", async () => {
    vi.mocked(addProjectNote).mockResolvedValue({ ok: true });
    render(
      <JobNotesDialog
        open
        onOpenChange={vi.fn()}
        projectId="project-1"
        jobId="job-1"
        jobTitle="Site Prep"
        notes={[]}
        currentUserId="user-1"
      />,
    );

    expect(screen.getByRole("dialog", { name: "Notes for Site Prep" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Add job note" }), {
      target: { value: "Inspect before pour" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));

    await waitFor(() => expect(addProjectNote).toHaveBeenCalledWith("project-1", "job-1", "Inspect before pour"));
  });

  it("confirms deletion of an owned project note", async () => {
    vi.mocked(deleteProjectNote).mockResolvedValue({ ok: true });
    render(
      <ProjectNotesCard
        projectId="project-1"
        currentUserId="user-1"
        notes={[{
          id: "note-1",
          project_id: "project-1",
          job_id: null,
          author_id: "user-1",
          body: "Old note",
          created_at: "2026-09-29T14:00:00Z",
        }]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete note: Old note" }));
    expect(screen.getByRole("alertdialog", { name: "Delete this note?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(deleteProjectNote).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Delete note: Old note" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete note" }));
    await waitFor(() => expect(deleteProjectNote).toHaveBeenCalledWith("project-1", "note-1"));
    expect(refresh).toHaveBeenCalled();
  });

  it("does not offer deletion of another member's note", () => {
    render(
      <ProjectNotesCard
        projectId="project-1"
        currentUserId="user-1"
        notes={[{
          id: "note-2",
          project_id: "project-1",
          job_id: null,
          author_id: "user-2",
          body: "Shared update",
          created_at: "2026-09-29T14:00:00Z",
        }]}
      />,
    );

    expect(screen.queryByRole("button", { name: /Delete note/ })).not.toBeInTheDocument();
  });

  it("deletes an owned job note from the job dialog", async () => {
    vi.mocked(deleteProjectNote).mockResolvedValue({ ok: true });
    render(
      <JobNotesDialog
        open
        onOpenChange={vi.fn()}
        projectId="project-1"
        jobId="job-1"
        jobTitle="Site Prep"
        currentUserId="user-1"
        notes={[{
          id: "note-3",
          project_id: "project-1",
          job_id: "job-1",
          author_id: "user-1",
          body: "Inspect footing",
          created_at: "2026-09-29T14:00:00Z",
        }]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete note: Inspect footing" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete note" }));

    await waitFor(() => expect(deleteProjectNote).toHaveBeenCalledWith("project-1", "note-3"));
    expect(refresh).toHaveBeenCalled();
  });
});
