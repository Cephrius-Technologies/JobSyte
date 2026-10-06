// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ProjectsLoadingView } from "@/components/projects/projects-loading-view";
import { PROJECTS_VIEW_STORAGE_KEY } from "@/components/projects/projects-view";

describe("Projects loading view preference", () => {
  beforeEach(() => localStorage.clear());

  it.each(["list", "grouped"])("uses the saved %s view while project data loads", (view) => {
    localStorage.setItem(PROJECTS_VIEW_STORAGE_KEY, view);
    render(<ProjectsLoadingView grouped={<div>Grouped placeholder</div>}><div>List placeholder</div></ProjectsLoadingView>);
    expect(screen.getByText(view === "grouped" ? "Grouped placeholder" : "List placeholder")).toBeInTheDocument();
    expect(screen.queryByText(view === "grouped" ? "List placeholder" : "Grouped placeholder")).not.toBeInTheDocument();
    expect(localStorage.getItem(PROJECTS_VIEW_STORAGE_KEY)).toBe(view);
  });

  it("uses the page's list default for an invalid saved preference", () => {
    localStorage.setItem(PROJECTS_VIEW_STORAGE_KEY, "unknown");
    render(<ProjectsLoadingView grouped={<div>Grouped placeholder</div>}><div>List placeholder</div></ProjectsLoadingView>);
    expect(screen.getByText("List placeholder")).toBeInTheDocument();
  });
});
