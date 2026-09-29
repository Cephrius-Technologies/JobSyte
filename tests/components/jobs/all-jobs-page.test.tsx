// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AllJobsPage } from "@/components/jobs/all-jobs-page";
import type { CompanyJob } from "@/lib/jobs/company-jobs";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/components/jobs/edit-job-dialog", () => ({
  EditJobDialog: ({ open }: { open: boolean }) => open ? <div role="dialog">Edit job form</div> : null,
}));
vi.mock("@/components/jobs/delete-job-dialog", () => ({
  DeleteJobDialog: () => null,
}));
vi.mock("@/app/(jobsyte-app)/projects/[id]/actions", () => ({
  toggleJobComplete: vi.fn(),
}));
vi.mock("@/components/projects/actions", () => ({
  markProjectJobPaid: vi.fn(),
}));

const job: CompanyJob = {
  id: "123e4567-e89b-12d3-a456-426614174000",
  project_id: "project-1",
  project_address: "100 Main St",
  title: "Site Prep",
  price_cents: 10000,
  scheduled_start: null,
  scheduled_completion: null,
  is_completed: false,
  superintendent: null,
  completed_by_type: null,
  completed_by_id: null,
  completed_by_name: null,
  is_invoiced: false,
  is_paid: false,
  created_at: "2026-09-26T00:00:00Z",
};

describe("AllJobsPage", () => {
  it("shows the display ID and project link", () => {
    render(<AllJobsPage jobs={[job]} total={1} page={1} />);
    expect(screen.getByText("JS337068032")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "100 Main St" })).toHaveAttribute("href", "/projects/project-1");
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Job ID" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Project" })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /JS337068032 Site Prep/ })).toBeInTheDocument();
  });

  it("opens the existing edit job dialog", () => {
    render(<AllJobsPage jobs={[job]} total={1} page={1} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Site Prep" }));
    expect(screen.getByRole("dialog", { name: "" })).toHaveTextContent("Edit job form");
  });

  it("links to the next page when more company jobs exist", () => {
    render(<AllJobsPage jobs={[job]} total={101} page={1} />);
    const pages = screen.getByRole("navigation", { name: "Jobs pages" });
    expect(pages).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Next page" })).toHaveAttribute("href", "/jobs?page=2");
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    expect(pages.compareDocumentPosition(screen.getByRole("table")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps the selected filter when changing pages", () => {
    render(<AllJobsPage jobs={[job]} total={101} page={1} status="open" />);

    expect(screen.getByRole("link", { name: "Incomplete" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Completed" })).toHaveAttribute("href", "/jobs?status=completed");
    expect(screen.getByRole("link", { name: "Next page" })).toHaveAttribute("href", "/jobs?page=2&status=open");
  });

  it("links sortable headers and keeps the sort through filters and pagination", () => {
    render(<AllJobsPage jobs={[job]} total={101} page={1} status="open" sort={{ key: "price", direction: "asc" }} />);

    expect(screen.getByRole("columnheader", { name: "Job ID" })).not.toContainElement(screen.queryByRole("link", { name: "Job ID" }));
    expect(screen.getByRole("columnheader", { name: "Price" })).toHaveAttribute("aria-sort", "ascending");
    expect(screen.getByRole("link", { name: "Price" })).toHaveAttribute("href", "/jobs?status=open&sort=price&dir=desc");
    expect(screen.getByRole("link", { name: "Project" })).toHaveAttribute("href", "/jobs?status=open&sort=project&dir=asc");
    expect(screen.getByRole("link", { name: "Next page" })).toHaveAttribute("href", "/jobs?page=2&status=open&sort=price&dir=asc");
    expect(screen.getByRole("link", { name: "Completed" })).toHaveAttribute("href", "/jobs?status=completed&sort=price&dir=asc");
  });

  it("offers to clear a filter with no matching jobs", () => {
    render(<AllJobsPage jobs={[]} total={0} page={1} status="completed" />);

    expect(screen.getByText("No completed jobs")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View all jobs" })).toHaveAttribute("href", "/jobs");
  });
});
