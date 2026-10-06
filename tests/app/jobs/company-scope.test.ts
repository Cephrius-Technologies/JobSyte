// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import { getActiveCompanyId } from "@/lib/active-company";
import { deleteJob, editJob, toggleJobComplete } from "@/app/(jobsyte-app)/projects/[id]/actions";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/active-company", () => ({ getActiveCompanyId: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

describe("job mutations require an active company", () => {
  const from = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActiveCompanyId).mockResolvedValue(null);
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }) },
      from,
    } as never);
  });

  it("does not edit a job without an active company", async () => {
    const data = new FormData();
    data.set("job_id", "job-1");
    data.set("title", "Site Prep");
    data.set("price", "100");
    expect(await editJob(data)).toEqual({ ok: false, message: "No active company found." });
    expect(from).not.toHaveBeenCalled();
  });

  it("does not complete a job without an active company", async () => {
    expect(await toggleJobComplete("job-1", true)).toEqual({ ok: false, message: "No active company found." });
    expect(from).not.toHaveBeenCalled();
  });

  it("does not delete a job without an active company", async () => {
    expect(await deleteJob("job-1")).toEqual({ ok: false, message: "No active company found." });
    expect(from).not.toHaveBeenCalled();
  });
});
