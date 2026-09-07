// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CreateInvoiceByBuilder } from "@/components/invoices/create-invoice-by-builder";

const mocks = vi.hoisted(() => ({ createInvoice: vi.fn(), from: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from: mocks.from }) }));
vi.mock("@/app/(jobsyte-app)/invoices/actions", () => ({ createInvoiceForBuilder: mocks.createInvoice }));
vi.mock("@/components/projects/createable-combobox", () => ({
  CreatableCombobox: ({ label, items, onChange }: { label: string; items: { id: string; name: string }[]; onChange: (item: { id: string; name: string } | null) => void }) => (
    <label>{label}<select aria-label={label} defaultValue="" onChange={(event) => onChange(items.find((item) => item.id === event.target.value) ?? null)}>
      <option value="">Select</option>{items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select></label>
  ),
}));

describe("builder invoice job selection", () => {
  afterEach(() => vi.unstubAllGlobals());
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
    localStorage.clear();
    vi.clearAllMocks();
    mocks.createInvoice.mockResolvedValue({ ok: true, invoiceId: "invoice-one" });
    mocks.from.mockImplementation((table: string) => {
      const data = table === "projects"
        ? [{ id: "p1", project_address: "10 Oak Drive", subdivision: "Oak" }, { id: "p2", project_address: "20 Pine Drive", subdivision: "Pine" }]
        : table === "jobs"
          ? [{ id: "j1", title: "Framing", price_cents: 10000, project_id: "p1" }, { id: "j2", title: "Roofing", price_cents: 20000, project_id: "p2" }]
          : [];
      const query = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), in: vi.fn(), then: (resolve: (result: { data: unknown[] }) => unknown) => Promise.resolve({ data }).then(resolve) };
      query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.is.mockReturnValue(query); query.in.mockReturnValue(query);
      return query;
    });
  });

  it("starts unchecked, totals explicit choices across projects, and submits only those choices", async () => {
    render(<CreateInvoiceByBuilder builders={[{ id: "b1", name: "Oak Builders" }]} initialContractor={{ company_name: "Contractor", address: "Office", phone: "555-0100" }} defaultDueDays={30} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Builder" }), { target: { value: "b1" } });
    await screen.findByText("Framing");
    const checkboxes = screen.getAllByRole("checkbox");
    checkboxes.forEach((checkbox) => expect(checkbox).not.toBeChecked());
    screen.getAllByRole("button", { name: "Create Invoice" }).forEach((button) => expect(button).toBeDisabled());
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    expect(screen.getAllByText("$300.00").length).toBeGreaterThan(0);
    fireEvent.click(checkboxes[0]);
    fireEvent.change(screen.getByLabelText("Billing Address"), { target: { value: "Builder office" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Create Invoice" })[0]);
    await waitFor(() => expect(mocks.createInvoice).toHaveBeenCalledOnce());
    expect((mocks.createInvoice.mock.calls[0][0] as FormData).getAll("job_ids")).toEqual(["j2"]);
  });
});
