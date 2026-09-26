import { describe, expect, it, vi } from "vitest";
import { getCompanyJobsPageData, parseJobsPage } from "@/lib/jobs/company-jobs";

describe("company jobs data", () => {
  it("clamps invalid page numbers to the first page", () => {
    expect(parseJobsPage("-5")).toBe(1);
    expect(parseJobsPage("abc")).toBe(1);
    expect(parseJobsPage("1.5")).toBe(1);
  });

  it("fetches only active-company jobs and their active-company projects", async () => {
    const job = {
      id: "job-1",
      project_id: "project-1",
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
    const jobsQuery = {
      select: vi.fn(), eq: vi.fn(), is: vi.fn(), order: vi.fn(), range: vi.fn(),
    };
    jobsQuery.select.mockReturnValue(jobsQuery);
    jobsQuery.eq.mockReturnValue(jobsQuery);
    jobsQuery.is.mockReturnValue(jobsQuery);
    jobsQuery.order.mockReturnValue(jobsQuery);
    jobsQuery.range.mockResolvedValue({ data: [job], count: 1, error: null });

    const projectsQuery = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), in: vi.fn() };
    projectsQuery.select.mockReturnValue(projectsQuery);
    projectsQuery.eq.mockReturnValue(projectsQuery);
    projectsQuery.is.mockReturnValue(projectsQuery);
    projectsQuery.in.mockResolvedValue({ data: [{ id: "project-1", project_address: "100 Main St" }], error: null });

    const client = { from: vi.fn((table: string) => table === "jobs" ? jobsQuery : projectsQuery) };
    const result = await getCompanyJobsPageData(client as never, "company-1", 1);

    expect(jobsQuery.eq).toHaveBeenCalledWith("company_id", "company-1");
    expect(projectsQuery.eq).toHaveBeenCalledWith("company_id", "company-1");
    expect(jobsQuery.range).toHaveBeenCalledWith(0, 99);
    expect(result.jobs[0].project_address).toBe("100 Main St");
  });

  it("does not fetch projects when the page has no jobs", async () => {
    const jobsQuery = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), order: vi.fn(), range: vi.fn() };
    jobsQuery.select.mockReturnValue(jobsQuery);
    jobsQuery.eq.mockReturnValue(jobsQuery);
    jobsQuery.is.mockReturnValue(jobsQuery);
    jobsQuery.order.mockReturnValue(jobsQuery);
    jobsQuery.range.mockResolvedValue({ data: [], count: 0, error: null });
    const client = { from: vi.fn(() => jobsQuery) };

    const result = await getCompanyJobsPageData(client as never, "company-1", 1);

    expect(client.from).toHaveBeenCalledTimes(1);
    expect(result.jobs).toEqual([]);
  });

  it("uses the requested result window for later pages", async () => {
    const jobsQuery = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), order: vi.fn(), range: vi.fn() };
    jobsQuery.select.mockReturnValue(jobsQuery);
    jobsQuery.eq.mockReturnValue(jobsQuery);
    jobsQuery.is.mockReturnValue(jobsQuery);
    jobsQuery.order.mockReturnValue(jobsQuery);
    jobsQuery.range.mockResolvedValue({ data: [], count: 150, error: null });

    await getCompanyJobsPageData({ from: vi.fn(() => jobsQuery) } as never, "company-1", 2);

    expect(jobsQuery.range).toHaveBeenCalledWith(100, 199);
  });

  it("surfaces database errors instead of showing an empty list", async () => {
    const jobsQuery = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), order: vi.fn(), range: vi.fn() };
    jobsQuery.select.mockReturnValue(jobsQuery);
    jobsQuery.eq.mockReturnValue(jobsQuery);
    jobsQuery.is.mockReturnValue(jobsQuery);
    jobsQuery.order.mockReturnValue(jobsQuery);
    jobsQuery.range.mockResolvedValue({ data: null, count: null, error: { message: "database unavailable" } });

    await expect(getCompanyJobsPageData({ from: vi.fn(() => jobsQuery) } as never, "company-1", 1)).rejects.toThrow("database unavailable");
  });
});
