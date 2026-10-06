// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import { getActiveCompanyId } from "@/lib/active-company";
import { revalidatePath } from "next/cache";
import { createInvoiceForBuilder } from "@/app/(jobsyte-app)/invoices/actions";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/active-company", () => ({
  getActiveCompanyId: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

function invoiceFormData() {
  const formData = new FormData();
  formData.set("builder_id", "22222222-2222-4222-8222-222222222222");
  formData.set("contractor_name", "JobSyte Contractor");
  formData.set("contractor_address", "1 Main Street");
  formData.set("contractor_phone", "555-0100");
  formData.set("bill_to_name", "Oak Builders");
  formData.set("bill_to_address", "2 Builder Way");
  formData.set("invoice_date", "2026-09-07");
  formData.set("due_date", "2026-10-07");
  formData.append("job_ids", "33333333-3333-4333-8333-333333333333");
  formData.append("job_ids", "44444444-4444-4444-8444-444444444444");
  return formData;
}

describe("createInvoiceForBuilder", () => {
  const rpc = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActiveCompanyId).mockResolvedValue(
      "11111111-1111-4111-8111-111111111111",
    );
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1", user_metadata: {} } },
          error: null,
        }),
      },
      rpc,
    } as never);
  });

  it("delegates all invoice writes to the atomic database function", async () => {
    rpc.mockResolvedValue({ data: "invoice-1", error: null });

    await expect(createInvoiceForBuilder(invoiceFormData())).resolves.toEqual({
      ok: true,
      invoiceId: "invoice-1",
    });

    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith(
      "create_invoice_for_builder_atomic",
      expect.objectContaining({
        p_company_id: "11111111-1111-4111-8111-111111111111",
        p_builder_id: "22222222-2222-4222-8222-222222222222",
        p_job_ids: [
          "33333333-3333-4333-8333-333333333333",
          "44444444-4444-4444-8444-444444444444",
        ],
      }),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/invoices");
    expect(revalidatePath).toHaveBeenCalledWith("/invoices/invoice-1");
  });

  it("returns the RPC error without revalidating a partial invoice", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "Invoice item insert failed." },
    });

    await expect(createInvoiceForBuilder(invoiceFormData())).resolves.toEqual({
      ok: false,
      message: "Invoice item insert failed.",
    });

    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
