// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteCompany } from "@/app/(jobsyte-app)/settings/company-actions";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

describe("deleteCompany", () => {
  const deleted: string[] = [];
  let invoicesRemaining: boolean;

  beforeEach(() => {
    vi.clearAllMocks();
    deleted.length = 0;
    invoicesRemaining = true;

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { role: "owner" } }),
            }),
          }),
        }),
      }),
    } as never);

    vi.mocked(createAdminClient).mockReturnValue({
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            limit: () => ({
              then: (resolve: (value: unknown) => void) => resolve({
                data: table === "invoices" && invoicesRemaining ? [{ id: "invoice-1" }] : [],
                error: null,
              }),
              maybeSingle: async () => ({
                data: { company_id: "other-company" },
                error: null,
              }),
            }),
            maybeSingle: async () => ({
              data: { company_id: "other-company" },
              error: null,
            }),
            then: (resolve: (value: unknown) => void) => resolve({
              data: [{ id: "project-1" }],
              error: null,
            }),
          }),
        }),
        delete: () => ({
          in: async () => {
            deleted.push(table);
            if (table === "invoices") invoicesRemaining = false;
            return { error: null };
          },
          eq: async () => {
            deleted.push(table);
            return { error: null };
          },
        }),
      }),
    } as never);
  });

  it("deletes invoice items and invoices before jobs", async () => {
    await expect(deleteCompany("company-1")).resolves.toEqual({
      ok: true,
      message: "Company and all associated data deleted.",
      fallbackCompanyId: "other-company",
    });

    expect(deleted).toEqual([
      "invoice_items",
      "invoices",
      "jobs",
      "projects",
      "company_members",
      "companies",
    ]);
  });
});
