export type ProjectsView = "list" | "grouped";

export const PROJECTS_VIEW_STORAGE_KEY = "projects:view";

export function parseProjectsView(raw: string | null): ProjectsView {
  return raw === "grouped" ? "grouped" : "list";
}
