// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NoteNotifications } from "@/components/app-shell/note-notifications";
import { createClient } from "@/lib/supabase/client";
import { clearNotifications, getNotificationClearState } from "@/components/app-shell/notification-actions";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/company-context", () => ({
  useCompany: () => ({ activeCompany: { id: "company-1" } }),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));
vi.mock("@/components/app-shell/notification-actions", () => ({
  clearNotifications: vi.fn(),
  getNotificationClearState: vi.fn(),
}));

function setup({ overdue = false, clearFails = false } = {}) {
  vi.clearAllMocks();
  window.localStorage.clear();
  let cleared = false;
  let newNote = false;
  let filteredByCutoff = false;
  const notification = {
    id: "notification-1",
    project_id: "project-1",
    job_id: "job-1",
    project_label: "12 Oak Street",
    job_label: "Framing",
    preview: "Check the framing before inspection",
    created_at: "2026-09-29T14:00:00Z",
    read_at: null,
  };
  const laterNotification = { ...notification, id: "notification-2", created_at: "2026-10-01T16:00:00Z" };
  const overdueJob = {
    id: "job-2",
    title: "Roof inspection",
    project_id: "project-2",
    scheduled_completion: "2020-01-02",
  };
  const recentQuery = {
    eq: vi.fn(),
    gt: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(async () => ({ data: newNote ? [laterNotification] : cleared || filteredByCutoff ? [] : [notification], error: null })),
  };
  recentQuery.eq.mockReturnValue(recentQuery);
  recentQuery.gt.mockImplementation(() => { filteredByCutoff = true; return recentQuery; });
  recentQuery.order.mockReturnValue(recentQuery);

  const unreadQuery = {
    eq: vi.fn(),
    is: vi.fn(),
    gt: vi.fn(),
    then: (resolve: (value: { count: number; error: null }) => void) => {
      resolve({ count: (!cleared && !filteredByCutoff) || newNote ? 1 : 0, error: null });
    },
  };
  unreadQuery.eq.mockReturnValue(unreadQuery);
  unreadQuery.is.mockReturnValue(unreadQuery);
  unreadQuery.gt.mockReturnValue(unreadQuery);

  const overdueQuery = {
    eq: vi.fn(),
    is: vi.fn(),
    lt: vi.fn(),
    gt: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(async () => ({
      data: overdue && !cleared && !filteredByCutoff ? [overdueJob] : [],
      count: overdue && !cleared && !filteredByCutoff ? 1 : 0,
      error: null,
    })),
  };
  overdueQuery.eq.mockReturnValue(overdueQuery);
  overdueQuery.is.mockReturnValue(overdueQuery);
  overdueQuery.lt.mockReturnValue(overdueQuery);
  overdueQuery.gt.mockReturnValue(overdueQuery);
  overdueQuery.order.mockReturnValue(overdueQuery);

  let savedCutoffs: { notes_cleared_at: string; overdue_cleared_through: string } | null = null;
  vi.mocked(getNotificationClearState).mockImplementation(async () => ({ ok: true, cutoffs: cleared ? savedCutoffs : null }));
  vi.mocked(clearNotifications).mockImplementation(async (_companyId, overdueThrough) => {
    if (clearFails) return { ok: false, message: "Save failed" };
    savedCutoffs = { notes_cleared_at: new Date().toISOString(), overdue_cleared_through: overdueThrough };
    cleared = true;
    return { ok: true, cutoffs: savedCutoffs };
  });
  const updateQuery = {
    eq: vi.fn(),
    then: (resolve: (value: { error: null }) => void) => resolve({ error: null }),
  };
  updateQuery.eq.mockReturnValue(updateQuery);

  vi.mocked(createClient).mockReturnValue({
    from: vi.fn((table: string) => {
      if (table === "jobs") return { select: vi.fn(() => overdueQuery) };
      return {
        select: vi.fn((_columns: string, options?: { head?: boolean }) => options?.head ? unreadQuery : recentQuery),
        update: vi.fn(() => updateQuery),
      };
    }),
  } as never);

  return { recentQuery, unreadQuery, overdueQuery, addNewNote: () => { newNote = true; } };
}

describe("NoteNotifications", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("shows an unread job note and opens its notes after marking it read", async () => {
    setup();
    render(<NoteNotifications userId="user-2" />);

    fireEvent.click(await screen.findByRole("button", { name: "Notifications, 1 unread" }));
    fireEvent.click(await screen.findByRole("button", { name: /New job note · Framing/ }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/projects/project-1?noteJob=job-1"));
    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument();
  });

  it("shows overdue jobs in the bell and links to their project", async () => {
    const { overdueQuery } = setup({ overdue: true });
    render(<NoteNotifications userId="user-2" />);

    fireEvent.click(await screen.findByRole("button", { name: "Notifications, 1 unread, 1 overdue job" }));
    fireEvent.click(await screen.findByRole("button", { name: /Roof inspection/ }));

    expect(push).toHaveBeenCalledWith("/projects/project-2");
    expect(overdueQuery.lt).toHaveBeenCalledWith("scheduled_completion", expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
  });

  it("clears both alert types, persists the cutoffs, and shows later notes", async () => {
    const { recentQuery, unreadQuery, overdueQuery, addNewNote } = setup({ overdue: true });
    render(<NoteNotifications userId="user-2" />);

    fireEvent.click(await screen.findByRole("button", { name: "Notifications, 1 unread, 1 overdue job" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear All" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument());
    expect(screen.getByText("No notifications right now.")).toBeInTheDocument();
    expect(clearNotifications).toHaveBeenCalledWith("company-1", expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
    const saved = JSON.parse(window.localStorage.getItem("jobsyte:notification-clears:company-1:user-2")!);
    expect(recentQuery.gt).toHaveBeenCalledWith("created_at", saved.notes_cleared_at);
    expect(unreadQuery.gt).toHaveBeenCalledWith("created_at", saved.notes_cleared_at);
    expect(overdueQuery.gt).toHaveBeenCalledWith("scheduled_completion", saved.overdue_cleared_through);

    fireEvent(window, new Event("focus"));
    await waitFor(() => expect(recentQuery.gt).toHaveBeenCalledTimes(2));
    addNewNote();
    fireEvent(window, new Event("focus"));
    expect(await screen.findByRole("button", { name: "Notifications, 1 unread" })).toBeInTheDocument();
  });

  it("clears overdue jobs on this device when database saving fails", async () => {
    vi.stubEnv("NODE_ENV", "production");
    setup({ overdue: true, clearFails: true });
    render(<NoteNotifications userId="user-2" />);

    fireEvent.click(await screen.findByRole("button", { name: "Notifications, 1 unread, 1 overdue job" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear All" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument());
    expect(screen.getByText("No notifications right now.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(window.localStorage.getItem("jobsyte:notification-clears:company-1:user-2")).toContain('"pending_sync":true');
    fireEvent(window, new Event("focus"));
    await waitFor(() => expect(screen.getByText("No notifications right now.")).toBeInTheDocument());
  });

  it("shows the local-only warning in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    setup({ clearFails: true });
    render(<NoteNotifications userId="user-2" />);

    fireEvent.click(await screen.findByRole("button", { name: "Notifications, 1 unread" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear All" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Notifications are cleared on this device.");
  });
});
