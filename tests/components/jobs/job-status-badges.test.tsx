// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JobStatusBadges } from "@/components/jobs/job-status-badges";

const baseJob = {
  is_completed: false,
  scheduled_start: null,
  scheduled_completion: null,
  is_invoiced: false,
  is_paid: false,
};

describe("JobStatusBadges", () => {
  it("renders no lifecycle badge for an undated job", () => {
    const { container } = render(<JobStatusBadges job={baseJob} today="2026-09-26" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows Not Started for a future start date", () => {
    render(<JobStatusBadges job={{ ...baseJob, scheduled_start: "2026-09-27" }} today="2026-09-26" />);
    expect(screen.getByText("Not Started")).toBeInTheDocument();
  });

  it("shows In progress on the scheduled start day", () => {
    render(<JobStatusBadges job={{ ...baseJob, scheduled_start: "2026-09-26" }} today="2026-09-26" />);
    expect(screen.getByText("In progress")).toBeInTheDocument();
  });

  it("shows Completed for a finished job", () => {
    render(<JobStatusBadges job={{ ...baseJob, is_completed: true }} today="2026-09-26" />);
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("keeps an invoice badge independent of lifecycle status", () => {
    render(<JobStatusBadges job={{ ...baseJob, is_invoiced: true }} today="2026-09-26" />);
    expect(screen.getByText("Invoiced")).toBeInTheDocument();
    expect(screen.queryByText("In progress")).not.toBeInTheDocument();
  });

  it("keeps a paid badge independent of lifecycle status", () => {
    render(<JobStatusBadges job={{ ...baseJob, is_paid: true }} today="2026-09-26" />);
    expect(screen.getByText("Paid")).toBeInTheDocument();
  });

  it("shows Late for an overdue incomplete job", () => {
    render(<JobStatusBadges job={{ ...baseJob, scheduled_completion: "2026-09-25" }} today="2026-09-26" />);
    expect(screen.getByText("Late")).toBeInTheDocument();
  });
});
