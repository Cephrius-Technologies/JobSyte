import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearNotifications, getNotificationClearState } from "@/components/app-shell/notification-actions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

function setup({ userId = "user-1", member = true } = {}) {
  const getUser = vi.fn(async () => ({ data: { user: userId ? { id: userId } : null }, error: null }));
  vi.mocked(createClient).mockResolvedValue({ auth: { getUser } } as never);

  const membershipQuery = {
    eq: vi.fn(),
    maybeSingle: vi.fn(async () => ({ data: member ? { user_id: userId } : null, error: null })),
  };
  membershipQuery.eq.mockReturnValue(membershipQuery);
  const clearQuery = {
    eq: vi.fn(),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
  };
  clearQuery.eq.mockReturnValue(clearQuery);
  const upsert = vi.fn(async () => ({ error: null }));
  const from = vi.fn((table: string) => table === "company_members"
    ? { select: vi.fn(() => membershipQuery) }
    : { select: vi.fn(() => clearQuery), upsert });
  vi.mocked(createAdminClient).mockReturnValue({ from } as never);
  return { membershipQuery, clearQuery, upsert };
}

describe("notification clear actions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not read or write without a signed-in user", async () => {
    const { upsert } = setup({ userId: "" });

    expect(await getNotificationClearState("company-1")).toMatchObject({ ok: false });
    expect(await clearNotifications("company-1", "2026-09-30")).toMatchObject({ ok: false });
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("does not write for a user outside the company", async () => {
    const { upsert } = setup({ member: false });

    expect(await clearNotifications("company-1", "2026-09-30")).toMatchObject({ ok: false });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("scopes reads and writes to the authenticated user and company", async () => {
    const { membershipQuery, clearQuery, upsert } = setup();

    expect(await getNotificationClearState("company-1")).toEqual({ ok: true, cutoffs: null });
    const result = await clearNotifications("company-1", "2026-09-30");

    expect(result.ok).toBe(true);
    expect(membershipQuery.eq).toHaveBeenCalledWith("company_id", "company-1");
    expect(membershipQuery.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(clearQuery.eq).toHaveBeenCalledWith("company_id", "company-1");
    expect(clearQuery.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      company_id: "company-1",
      user_id: "user-1",
      overdue_cleared_through: "2026-09-30",
    }), { onConflict: "company_id,user_id" });
  });
});
