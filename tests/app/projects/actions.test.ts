// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import { getActiveCompanyId } from "@/lib/active-company";
import { revalidatePath } from "next/cache";
import { renameProjectStreetGroup } from "@/app/(jobsyte-app)/projects/actions";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/active-company", () => ({
  getActiveCompanyId: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("renameProjectStreetGroup", () => {
  const updateCalls: Array<{ id: string; project_address: string }> = [];

  beforeEach(() => {
    vi.clearAllMocks();
    updateCalls.length = 0;
    vi.mocked(getActiveCompanyId).mockResolvedValue("company-1");

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          in: vi.fn(() => ({
            eq: vi.fn(() => ({
              is: vi.fn().mockResolvedValue({
                data: [
                  { id: "project-1", project_address: "101 Main Street" },
                  { id: "project-2", project_address: "205 Main Street" },
                ],
                error: null,
              }),
            })),
          })),
        })),
        update: vi.fn((values: { project_address: string }) => ({
          eq: vi.fn((field: string, id: string) => ({
            eq: vi.fn(() => ({
              is: vi.fn().mockImplementation(async () => {
                expect(field).toBe("id");
                updateCalls.push({ id, ...values });
                return { error: null };
              }),
            })),
          })),
        })),
      })),
    } as never);
  });

  it("updates every project in the active-company street group", async () => {
    await expect(
      renameProjectStreetGroup(["project-1", "project-2"], "oak avenue"),
    ).resolves.toEqual({ ok: true, updatedCount: 2 });

    expect(updateCalls).toEqual([
      { id: "project-1", project_address: "101 Oak Avenue" },
      { id: "project-2", project_address: "205 Oak Avenue" },
    ]);
    expect(revalidatePath).toHaveBeenCalledWith("/projects");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
  });

  it("rejects an incomplete group before changing any project", async () => {
    await expect(
      renameProjectStreetGroup(
        ["project-1", "project-2", "missing-project"],
        "Oak Avenue",
      ),
    ).resolves.toEqual({
      ok: false,
      message: "One or more projects in this street could not be found.",
    });

    expect(updateCalls).toHaveLength(0);
  });
});
