// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NoteNotifications } from "@/components/app-shell/note-notifications";
import { createClient } from "@/lib/supabase/client";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/company-context", () => ({
  useCompany: () => ({ activeCompany: { id: "company-1" } }),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));

describe("NoteNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    const readQuery = {
      eq: vi.fn(),
      order: vi.fn(),
      limit: vi.fn().mockResolvedValue({ data: [notification], error: null }),
      is: vi.fn().mockResolvedValue({ count: 1, error: null }),
    };
    readQuery.eq.mockReturnValue(readQuery);
    readQuery.order.mockReturnValue(readQuery);
    const updateQuery = {
      eq: vi.fn(),
      then: (resolve: (value: { error: null }) => void) => resolve({ error: null }),
    };
    updateQuery.eq.mockReturnValue(updateQuery);
    vi.mocked(createClient).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => readQuery),
        update: vi.fn(() => updateQuery),
      })),
    } as never);
  });

  it("shows an unread job note and opens its notes after marking it read", async () => {
    render(<NoteNotifications userId="user-2" />);

    const bell = await screen.findByRole("button", { name: "Notifications, 1 unread" });
    fireEvent.click(bell);
    fireEvent.click(await screen.findByRole("button", { name: /New job note · Framing/ }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/projects/project-1?noteJob=job-1"));
    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument();
  });
});
