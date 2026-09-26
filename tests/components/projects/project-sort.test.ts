import { describe, expect, it } from "vitest";
import {
  nextProjectSort,
  sortProjects,
} from "@/components/projects/project-sort";
import type { ProjectListItem } from "@/components/projects/types";

function project(overrides: Partial<ProjectListItem>): ProjectListItem {
  return {
    id: "project",
    project_address: "100 Main St",
    project_city: null,
    project_state: null,
    builder_name: null,
    subdivision: null,
    builder_id: null,
    subdivision_id: null,
    created_at: "2026-01-01T00:00:00Z",
    job_count: 0,
    open_job_count: 0,
    last_activity_at: null,
    status: "not-started",
    billing_statuses: [],
    invoiced_job_count: 0,
    paid_job_count: 0,
    crew_names: [],
    ...overrides,
  };
}

describe("project list sorting", () => {
  it("sorts street addresses naturally", () => {
    const rows = [
      project({ id: "ten", project_address: "10 Main St" }),
      project({ id: "two", project_address: "2 Main St" }),
    ];
    expect(sortProjects(rows, { key: "address", direction: "asc" }).map((row) => row.id)).toEqual(["two", "ten"]);
  });

  it("uses location to break an address tie", () => {
    const rows = [
      project({ id: "z", project_address: "100 Main St", project_city: "Zion" }),
      project({ id: "a", project_address: "100 Main St", project_city: "Austin" }),
    ];
    expect(sortProjects(rows, { key: "address", direction: "asc" }).map((row) => row.id)).toEqual(["a", "z"]);
  });

  it("sorts subdivision then builder", () => {
    const rows = [
      project({ id: "b", subdivision: "Oak", builder_name: "Zenith" }),
      project({ id: "a", subdivision: "Oak", builder_name: "Acme" }),
      project({ id: "c", subdivision: "Pine", builder_name: "Acme" }),
    ];
    expect(sortProjects(rows, { key: "group", direction: "asc" }).map((row) => row.id)).toEqual(["a", "b", "c"]);
  });

  it("sorts job progress by completion rate", () => {
    const rows = [
      project({ id: "half", job_count: 10, open_job_count: 5 }),
      project({ id: "done", job_count: 2, open_job_count: 0 }),
      project({ id: "none", job_count: 2, open_job_count: 2 }),
    ];
    expect(sortProjects(rows, { key: "progress", direction: "desc" }).map((row) => row.id)).toEqual(["done", "half", "none"]);
  });

  it("sorts lifecycle statuses in workflow order", () => {
    const rows = [
      project({ id: "completed", status: "completed" }),
      project({ id: "active", status: "active" }),
      project({ id: "waiting", status: "not-started" }),
    ];
    expect(sortProjects(rows, { key: "status", direction: "asc" }).map((row) => row.id)).toEqual(["waiting", "active", "completed"]);
  });

  it("sorts last activity newest first by default and keeps missing dates last", () => {
    const rows = [
      project({ id: "old", last_activity_at: "2026-01-02T00:00:00Z" }),
      project({ id: "missing" }),
      project({ id: "new", last_activity_at: "2026-01-03T00:00:00Z" }),
    ];
    expect(sortProjects(rows, { key: "updated", direction: "desc" }).map((row) => row.id)).toEqual(["new", "old", "missing"]);
    expect(sortProjects(rows, { key: "updated", direction: "asc" }).map((row) => row.id)).toEqual(["old", "new", "missing"]);
    expect(rows.map((row) => row.id)).toEqual(["old", "missing", "new"]);
  });

  it("reverses direction when the active column is clicked again", () => {
    expect(nextProjectSort({ key: "address", direction: "asc" }, "address")).toEqual({ key: "address", direction: "desc" });
  });

  it("reverses a descending column back to ascending", () => {
    expect(nextProjectSort({ key: "address", direction: "desc" }, "address")).toEqual({ key: "address", direction: "asc" });
  });

  it("starts a newly selected text column ascending", () => {
    expect(nextProjectSort({ key: "updated", direction: "desc" }, "address")).toEqual({ key: "address", direction: "asc" });
  });

  it("sorts a text column descending", () => {
    const rows = [
      project({ id: "oak", subdivision: "Oak" }),
      project({ id: "pine", subdivision: "Pine" }),
    ];
    expect(sortProjects(rows, { key: "group", direction: "desc" }).map((row) => row.id)).toEqual(["pine", "oak"]);
  });

  it("places projects without activity last even when sorting oldest first", () => {
    const rows = [
      project({ id: "none-a" }),
      project({ id: "dated", last_activity_at: "2026-01-03T00:00:00Z" }),
      project({ id: "none-b" }),
    ];
    expect(sortProjects(rows, { key: "updated", direction: "asc" }).map((row) => row.id)).toEqual(["dated", "none-a", "none-b"]);
  });

  it("starts a newly selected date column with newest first", () => {
    expect(nextProjectSort({ key: "address", direction: "desc" }, "updated")).toEqual({ key: "updated", direction: "desc" });
  });
});
