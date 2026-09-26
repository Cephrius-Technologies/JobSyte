// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectSortHeader } from "@/components/projects/project-sort-header";

describe("ProjectSortHeader", () => {
  it("announces and toggles the active sort column", () => {
    const onSort = vi.fn();
    render(<table><thead><tr><ProjectSortHeader label="Project Address" sortKey="address" sort={{ key: "address", direction: "asc" }} onSort={onSort} /></tr></thead></table>);

    expect(screen.getByRole("columnheader", { name: /Project Address/ })).toHaveAttribute("aria-sort", "ascending");
    fireEvent.click(screen.getByRole("button", { name: /Project Address/ }));
    expect(onSort).toHaveBeenCalledWith("address");
  });

  it("announces descending order", () => {
    render(<table><thead><tr><ProjectSortHeader label="Last Updated" sortKey="updated" sort={{ key: "updated", direction: "desc" }} onSort={() => {}} /></tr></thead></table>);
    expect(screen.getByRole("columnheader", { name: /Last Updated/ })).toHaveAttribute("aria-sort", "descending");
  });

  it("announces an inactive column as unsorted", () => {
    render(<table><thead><tr><ProjectSortHeader label="Status" sortKey="status" sort={{ key: "updated", direction: "desc" }} onSort={() => {}} /></tr></thead></table>);
    expect(screen.getByRole("columnheader", { name: /Status/ })).toHaveAttribute("aria-sort", "none");
  });
});
