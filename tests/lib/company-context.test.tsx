// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { CompanyProvider, useCompany, type Company } from "@/lib/company-context";

const companies: Company[] = [
  {
    id: "company-1",
    name: "North Division",
    address: null,
    phone: null,
    logo_url: null,
    role: "owner",
  },
  {
    id: "company-2",
    name: "South Division",
    address: null,
    phone: null,
    logo_url: null,
    role: "manager",
  },
];

function TestConsumer() {
  const { activeCompany, setActiveCompanyId } = useCompany();

  return (
    <div>
      <span data-testid="active-company">{activeCompany?.name ?? "none"}</span>
      <button type="button" onClick={() => setActiveCompanyId("company-2")}>
        Switch
      </button>
    </div>
  );
}

describe("CompanyProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.cookie = "jobsyte:active-company-id=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  });

  it("falls back to the first company when no stored selection exists", () => {
    render(
      <CompanyProvider companies={companies}>
        <TestConsumer />
      </CompanyProvider>,
    );

    expect(screen.getByTestId("active-company")).toHaveTextContent(
      "North Division",
    );
  });

  it("hydrates from localStorage and persists selection changes", () => {
    window.localStorage.setItem("jobsyte:active-company-id", "company-2");

    render(
      <CompanyProvider companies={companies}>
        <TestConsumer />
      </CompanyProvider>,
    );

    expect(screen.getByTestId("active-company")).toHaveTextContent(
      "South Division",
    );

    fireEvent.click(screen.getByRole("button", { name: "Switch" }));

    expect(window.localStorage.getItem("jobsyte:active-company-id")).toBe(
      "company-2",
    );
    expect(document.cookie).toContain("jobsyte:active-company-id=company-2");
  });
});
